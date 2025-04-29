import asyncio
import json
import os
from typing import List

import httpx
from fastapi import FastAPI, File, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

uploaded_file_context = ""

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Replace with ["https://chat.ezevals.com"] in prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OLLAMA_API = "http://localhost:11434"
current_model = "gemma3-ctx:27b"


class UploadPayload(BaseModel):
    content: str


@app.post("/upload")
async def upload(files: List[UploadFile] = File(...)):
    global uploaded_file_context
    contents = []

    for file in files:
        file_content = await file.read()
        text = file_content.decode("utf-8")
        contents.append(f"# File: {file.filename}\n{text}")

    uploaded_file_context = "\n\n".join(contents)
    return {
        "message": f"{len(files)} file(s) uploaded successfully",
        "filenames": [f.filename for f in files],
    }


async def warmup_model():
    try:
        async with httpx.AsyncClient() as client:
            res = await client.post(
                f"{OLLAMA_API}/api/generate",
                json={"model": current_model, "prompt": "ping", "stream": False},
                timeout=30,
            )
            if res.status_code == 200:
                print(f"✅ {current_model} model warmed up and ready.")
            else:
                print(f"⚠️ Warmup failed: {res.status_code} - {res.text}")
    except Exception as e:
        print(f"🔥 Ollama warmup error: {e}")


@app.on_event("startup")
async def on_startup():
    asyncio.create_task(warmup_model())


@app.post("/v1/chat/completions")
async def proxy_chat(request: Request):
    payload = await request.json()
    payload["model"] = current_model
    stream = payload.get("stream", False)

    if uploaded_file_context:
        message = payload.get("messages", [])
        message.insert(0, {"role": "user", "content": uploaded_file_context})
        payload["messages"] = message

    if stream:

        async def stream_response():
            async with httpx.AsyncClient(timeout=None) as client:
                async with client.stream(
                    "POST", f"{OLLAMA_API}/api/chat", json=payload
                ) as resp:
                    async for line in resp.aiter_lines():
                        if line.strip():
                            try:
                                data = json.loads(line)
                                content = data.get("message", {}).get("content")
                                if content:
                                    json_payload = json.dumps(
                                        {"message": {"content": content}}
                                    )
                                    yield f"data: {json_payload}\n\n"
                            except json.JSONDecodeError:
                                continue

        return StreamingResponse(
            stream_response(),
            media_type="text/event-stream",
            headers={"X-Accel-Buffering": "no"},
        )
    else:
        async with httpx.AsyncClient(timeout=None) as client:
            resp = await client.post(f"{OLLAMA_API}/api/chat", json=payload)
            try:
                return JSONResponse(content=resp.json(), status_code=resp.status_code)
            except Exception as e:
                return JSONResponse(
                    content={
                        "error": "Failed to parse Ollama response",
                        "details": str(e),
                    },
                    status_code=500,
                )


@app.get("/models")
async def get_models():
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{OLLAMA_API}/api/tags")
        data = resp.json()
        return {"models": [m["name"] for m in data.get("models", [])]}


@app.post("/model")
async def set_model(request: Request):
    global current_model
    data = await request.json()
    current_model = data.get("model", current_model)
    print(f"🔁 Model switched to: {current_model}")
    await warmup_model()
    return {"status": "ok", "model": current_model}


# Path to your frontend build directory
frontend_path = os.path.join(os.path.dirname(__file__), "../web-client/dist")

# Serve static files like JS/CSS/images
app.mount(
    "/assets",
    StaticFiles(directory=os.path.join(frontend_path, "assets")),
    name="assets",
)


# Serve index.html for all other routes (SPA fallback)
@app.get("/{full_path:path}")
async def serve_spa():
    return FileResponse(os.path.join(frontend_path, "index.html"))
