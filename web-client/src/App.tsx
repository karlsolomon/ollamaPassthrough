import { useEffect, useRef, useState } from "react";
import ChatBox, { ChatBoxHandle } from "./components/ChatBox";
import "bootstrap/dist/css/bootstrap.min.css";
import "./chat-theme.css";
import { fetchModelList, setModel, uploadFileToContext } from "./api";

// Data structure to represent a model
export interface Model {
  name: string;
  nickname: string;
  context: number;
}

function App() {
  // Hard-coded initial set of models
  const initialHcModels: Model[] = [
    { name: "gemma3:27b", nickname: "gemma3:27b", context: 50000 },
  ];

  // State for merged hard-coded + fetched models
  const [hcModels, setHcModels] = useState<Model[]>(initialHcModels);
  // Currently selected model name
  const [selectedModel, setSelectedModel] = useState<string>(initialHcModels[0]?.name || "");
  const [input, setInput] = useState("");
  const chatRef = useRef<ChatBoxHandle>(null);

  // Fetch model names and merge into hcModels
  useEffect(() => {
    fetchModelList().then((modelList: string[]) => {
      setHcModels((prev) => {
        const updated = [...prev];
        modelList.forEach((name) => {
          if (!updated.some((m) => m.name === name)) {
            updated.push({ name, nickname: name, context: 2048 });
          }
        });
        return updated;
      });
    });
  }, []);

  const handleModelChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newModel = e.target.value;
    setSelectedModel(newModel);
    await setModel(newModel);
    // Optionally: trigger a warmup call or other logic here
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    uploadFileToContext(...Array.from(files));
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !chatRef.current) return;
    chatRef.current.handleSend(text);
    setInput("");
  };

  return (
    <div
      className="container-fluid min-vh-100 d-flex flex-column"
      style={{ backgroundColor: '#2b2d31', color: '#ddd' }}
    >
      <header
        className="py-3 sticky-top shadow"
        style={{ backgroundColor: '#1e1f22', borderBottom: '1px solid #444' }}
      >
        <div className="container">
          <h1 className="h3 mb-2" style={{ color: '#fff' }}>
            LLM Chat Interface
          </h1>
          <div className="d-flex gap-2 flex-wrap">
            {/* Model selection shows nickname */}
            <select
              className="form-select form-select-sm w-auto bg-dark text-light border-secondary"
              value={selectedModel}
              onChange={handleModelChange}
            >
              {hcModels.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.nickname}
                </option>
              ))}
            </select>

            {/* File upload button */}
            <input
              type="file"
              multiple
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

