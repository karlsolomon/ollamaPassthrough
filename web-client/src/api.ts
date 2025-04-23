// ---------- web-client/src/api.ts ----------
export async function* chatWithLLM(messages: any[]) {
  try {
    const response = await fetch("http://10.224.174.3:34199/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "cogito:70b",
        messages,
        stream: true,
      }),
    });

    if (!response.ok || !response.body) {
      console.error("Fetch failed", response.status, response.statusText);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n").filter(Boolean);

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          yield parsed.message?.content || "";
        } catch (err) {
          console.error("Failed to parse line:", line);
        }
      }
    }
  } catch (err) {
    console.error("Error while streaming:", err);
  }
}

