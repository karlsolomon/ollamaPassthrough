import { useEffect, useRef, useState } from "react";
import { chatWithLLM, fetchModelList, setModel } from "../api";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import { Light as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomOneDark } from "react-syntax-highlighter/dist/esm/styles/hljs";
import "katex/dist/katex.min.css";

export default function ChatBox() {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [model, setCurrentModel] = useState<string>("gemma3:27b");
  const [streaming, setStreaming] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetchModelList().then(setModels);
  }, []);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);

    await setModel(model);

    await chatWithLLM([...messages, userMsg], model, (chunk) => {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1].content += chunk;
        return updated;
      });
    });

    setStreaming(false);
  };

  return (
    <div className="flex flex-col h-screen p-4 bg-base-100 text-base-content">
      <div className="form-control w-full max-w-xs mb-4">
        <label className="label">
          <span className="label-text">Model:</span>
        </label>
        <select
          className="select select-bordered"
          value={model}
          onChange={(e) => setCurrentModel(e.target.value)}
        >
          {models.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto space-y-4 mb-4 bg-base-200 p-4 rounded-lg"
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`chat ${msg.role === "user" ? "chat-end" : "chat-start"}`}
          >
            <div
              className={`chat-bubble whitespace-pre-wrap break-words ${
                msg.role === "user"
                  ? "bg-primary text-primary-content"
                  : "bg-base-300 text-base-content"
              } max-w-xl`}
            >
              <ReactMarkdown
                remarkPlugins={[remarkMath, remarkGfm]}
                rehypePlugins={[rehypeRaw, rehypeKatex]}
                components={{
                  code({ node, inline, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || "");
                    return !inline && match ? (
                      <SyntaxHighlighter
                        style={atomOneDark}
                        language={match[1]}
                        PreTag="div"
                        wrapLongLines
                        {...props}
                      >
                        {String(children).replace(/\n$/, "")}
                      </SyntaxHighlighter>
                    ) : (
                      <code className="bg-base-300 p-1 rounded text-sm" {...props}>
                        {children}
                      </code>
                    );
                  }
                }}
              >
                {msg.content}
              </ReactMarkdown>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <textarea
          className="textarea textarea-bordered w-full"
          placeholder="Ask something..."
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              handleSend();
            }
          }}
        />
        <button
          className="btn btn-primary"
          onClick={handleSend}
          disabled={streaming}
        >
          Send
        </button>
      </div>
    </div>
  );
}

