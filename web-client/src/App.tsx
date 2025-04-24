import { useEffect, useRef, useState } from "react";
import ChatBox, { ChatBoxHandle } from "./components/ChatBox";
import "bootstrap/dist/css/bootstrap.min.css";
import "./chat-theme.css";
import { fetchModelList, setModel, uploadFileToContext } from "./api";

function App() {
  const [models, setModels] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const chatRef = useRef<ChatBoxHandle>(null);

  useEffect(() => {
    fetchModelList().then(setModels);
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    uploadFileToContext(...Array.from(files));
  };

  const handleModelChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    await setModel(selected);

    // Trigger a warmup call immediately after model selection
    try {
      await fetch("/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selected,
          messages: [{ role: "user", content: "ping" }],
          stream: false,
        }),
      });
    } catch (err) {
      console.error("Model warmup failed:", err);
    }
  };

  const handleSend = () => {
    const text = input.trim();
    if (!text || !chatRef.current) return;
    chatRef.current.handleSend(text);
    setInput("");
  };

  return (
    <div className="container-fluid min-vh-100 d-flex flex-column" style={{ backgroundColor: '#2b2d31', color: '#ddd' }}>
      <header className="py-3 sticky-top shadow" style={{ backgroundColor: '#1e1f22', borderBottom: '1px solid #444' }}>
        <div className="container">
          <h1 className="h3 mb-2" style={{ color: '#fff' }}>LLM Chat Interface</h1>
          <div className="d-flex gap-2 flex-wrap">
            <select
              className="form-select form-select-sm w-auto bg-dark text-light border-secondary"
              onChange={handleModelChange}
            >
              {models.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <input
              type="file" multiple
              className="form-control form-control-sm w-auto bg-dark text-light border-secondary"
              onChange={handleFileUpload}
            />
          </div>
        </div>
      </header>

      <main className="flex-grow-1">
        <ChatBox ref={chatRef} />
      </main>

      <footer className="border-top mt-auto sticky-bottom" style={{ backgroundColor: '#1e1f22', borderTop: '1px solid #444' }}>
        <div className="container py-2">
          <div className="d-flex gap-2">
            <textarea
              className="form-control bg-dark text-light border-secondary"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSend())
              }
              placeholder="Type your message..."
            />
            <button
              className="btn btn-primary"
              onClick={handleSend}
              disabled={chatRef.current?.streaming}
            >
              Send
            </button>
          </div>
        </div>
        <div className="container text-center text-muted small pb-2">
          &copy; {new Date().getFullYear()} Ezevals LLM Chat
        </div>
      </footer>
    </div>
  );
}

export default App;

