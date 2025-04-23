// ---------- web-client/src/api.ts ----------

export async function fetchModelList(): Promise<string[]> {
  const response = await fetch("/models");
  const data = await response.json();
  return data.models; // expects { models: ["model1", "model2", ...] }
}

export async function setModel(model: string) {
  await fetch("/model", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model }),
  });
}

export async function* chatWithLLM(messages: any[]) {
  const response = await fetch("/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });

  const reader = response.body?.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { value, done } = await reader!.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Parse SSE chunks
    const lines = buffer.split("\n\n");
    buffer = lines.pop() || ""; // Save incomplete line for next round

    for (const chunk of lines) {
      if (chunk.startsWith("data: ")) {
        const data = chunk.slice(6).trim(); // remove 'data: '
        if (data) yield data;
      }
    }
  }
}
