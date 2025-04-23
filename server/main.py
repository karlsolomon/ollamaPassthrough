import asyncio
import os
import subprocess

import httpx
from fastapi import FastAPI, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from starlette.responses import JSONResponse

app = FastAPI()
current_model = "gemma3:27b"
uploaded_file_context = ""
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Replace with ["https://chat.ezevals.com"] in prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OLLAMA_API = "http://localhost:11434"

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    global uploaded_file_context
    contents = await file.read()
    try:
        uploaded_file_context = contents.decode("utf-8")
    except UnicodeDecodeError:
        return JSONResponse(status_code=400, content={"error": "Invalid UTF-8 encoding."})

    print(f"✅ Uploaded file '{file.filename}' loaded into context.")
    return {"status": "ok", "filename": file.filename}

@app.get("/models")
async def list_models():
    result = subprocess.run(["ollama", "list"], capture_output=True, text=True)
    models = []
    for line in result.stdout.splitlines()[1:]:
        if line.strip():
            models.append(line.split()[0])
    return { "models": models }

@app.post("/model")
async def set_model(request: Request):
    global current_model
    body = await request.json()
    current_model = body["model"]
    return { "status": "ok", "model": current_model }

async def warmup_model():
    try:
        async with httpx.AsyncClient() as client:
            res = await client.post(
                f"{OLLAMA_API}/api/generate",
                json={"model": "cogito:70b", "prompt": "ping", "stream": False},
                timeout=30,
            )
            if res.status_code == 200:
                print("✅ gemma3:27b model warmed up and ready.")
            else:
                print(f"⚠️ Warmup failed: {res.status_code} - {res.text}")
    except Exception as e:
        print(f"🔥 Ollama warmup error: {e}")


@app.on_event("startup")
async def on_startup():
    asyncio.create_task(warmup_model())


@app.post("/v1/chat/completions")
async def stream_response(request: Request):
    global current_model, uploaded_file_context

    payload = await request.json()
    payload["model"] = current_model
    payload["stream"] = True

    if uploaded_file_context:
        payload["messages"] = [
            {
                "role": "system",
                "content": f"The user uploaded the following document:\n\n{uploaded_file_context[:5000]}"
            }
        ] + payload.get("messages", [])
        uploaded_file_context = ""

    async def streamer():
        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream("POST", "http://localhost:11434/api/chat", json=payload) as response:
                async for line in response.aiter_lines():
                    if not line.strip():
                        continue
                    if line.startswith("data:"):
                        try:
                            json_data = json.loads(line[5:].strip())
                            token = json_data.get("message", {}).get("content", "")
                            if token:
                                yield f"data: {token}\n\n"
                        except json.JSONDecodeError:
                            continue

    return StreamingResponse(streamer(), media_type="text/event-stream")

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
