import asyncio
import os

import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Replace with ["https://chat.ezevals.com"] in prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OLLAMA_API = "http://localhost:11434"


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
async def proxy_chat(request: Request):
    payload = await request.json()
    # print(f"Outgoigng payload to Ollama: {payload}")
    stream = payload.get("stream", False)

    if stream:

        async def stream_response():
            # print("Request sent to Ollama. Awaiting stream...")
            async with httpx.AsyncClient(timeout=None) as client:
                async with client.stream(
                    "POST", f"{OLLAMA_API}/api/chat", json=payload
                ) as resp:
                    async for line in resp.aiter_lines():
                        if line.strip():
                            # print("Line:", line)
                            yield line + "\n"

        return StreamingResponse(stream_response(), media_type="text/event-stream")
    else:
        async with httpx.AsyncClient(timeout=None) as client:
            resp = await client.post(f"{OLLAMA_API}/api/chat", json=payload)
            return JSONResponse(content=resp.json(), status_code=resp.status_code)


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
