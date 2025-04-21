// ---------- server/main.py ----------
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
import httpx

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Replace with ["https://chat.ezevals.com"] in prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OLLAMA_API = "http://localhost:11434"

@app.post("/v1/chat/completions")
async def proxy_chat(request: Request):
    client = httpx.AsyncClient(timeout=None)
    payload = await request.json()
    stream = payload.get("stream", False)

    if stream:
        async def stream_response():
            async with client.stream("POST", f"{OLLAMA_API}/api/chat", json=payload) as resp:
                async for line in resp.aiter_lines():
                    if line.strip():
                        yield line + "\n"

        return StreamingResponse(stream_response(), media_type="text/event-stream")
    else:
        resp = await client.post(f"{OLLAMA_API}/api/chat", json=payload)
        return JSONResponse(content=resp.json(), status_code=resp.status_code)

