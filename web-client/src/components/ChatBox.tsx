import { useEffect, useRef, useState } from "react";
import { chatWithLLM, fetchModelList, setModel } from "../api";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import "katex/dist/katex.min.css";

export default function ChatBox() {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [streamedResponse, setStreamedResponse] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, updateSelectedModel] = useState<string>("");
  const chatBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchModelList().then((m) => {
      setModels(m);
      if (m.length > 0) {
        updateSelectedModel(m[0]);
        setModel(m[0]);
      }
    });
  }, []);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim()) return;

    const newMessages = [...messages, { role: "user", content: input }];
    setMessages(newMessages);
    setInput("");
    setIsStreaming(true);
    setStreamedResponse("");

    let fullReply = "";

    for await (const chunk of chatWithLLM(newMessages)) {
      fullReply += chunk;
      setStreamedResponse(fullReply);
      scrollToBottom();
    }

    setMessages([...newMessages, { role: "assistant", content: fullReply }]);
    setIsStreaming(false);
    setStreamedResponse("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && e.ctrlKey) {
      handleSubmit();
    }
  };

  const scrollToBottom = () => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const model = e.target.value;
    updateSelectedModel(model);
    setModel(model);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/upload", {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "system", content: `📄 File '${file.name}' uploaded and added to context.` }]);
    } else {
      setMessages((prev) => [...prev, { role: "system", content: `❌ Failed to upload file.` }]);
    }
  };

  const renderMarkdown = (content: string) => (
    <ReactMarkdown
      className="whitespace-pre-wrap"
      remarkPlugins={[remarkMath, remarkGfm]}
      rehypePlugins={[rehypeKatex, rehypeRaw]}
      components={{
        code({ node, inline, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || "");
          return !inline && match ? (
            <SyntaxHighlighter style={oneDark} language={match[1]} PreTag="div" {...props}>
              {String(children).replace(/\n$/, "")}
            </SyntaxHighlighter>
          ) : (
            <code className={className} {...props}>
              {children}
            </code>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );

  return (
    <div className="bg-base-200 text-base-content flex flex-col h-screen max-w-3xl mx-auto">
      <div className="p-4 space-y-2">
        <label className="label">
          <span className="label-text">Model:</span>
        </label>
        <select
          className="select select-bordered w-full max-w-xs"
          value={selectedModel}
          onChange={handleModelChange}
        >
          {models.map((model) => (
            <option key={model} value={model}>{model}</option>
          ))}
        </select>

        <label className="label">
          <span className="label-text">Upload UTF-8 File:</span>
        </label>
        <input type="file" accept=".txt" className="file-input file-input-bordered w-full max-w-xs" onChange={handleFileUpload} />
      </div>

      <div ref={chatBoxRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`chat ${msg.role === "user" ? "chat-end" : "chat-start"}`}
          >
            <div className="chat-image avatar">
              <div className="w-8 rounded-full">
                <span>{msg.role === "user" ? "🧑" : msg.role === "assistant" ? "🤖" : "📎"}</span>
              </div>
            </div>
            <div
              className={`chat-bubble ${msg.role === "user" ? "bg-primary text-primary-content" : "bg-base-300 text-base-content"}`}
            >
              {renderMarkdown(msg.content)}
            </div>
          </div>
        ))}
        {isStreaming && (
          <div className="chat chat-start">
            <div className="chat-image avatar">
              <div className="w-8 rounded-full">
                <span>🤖</span>
              </div>
            </div>
            <div className="chat-bubble bg-base-300 text-primary">
              {renderMarkdown(streamedResponse)}
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-4 flex gap-2 bg-base-300 border-t border-base-content/10">
        <textarea
          className="textarea textarea-bordered textarea-lg w-full bg-base-200 text-base-content resize-none"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask something..."
        />
        <button className="btn btn-primary" type="submit" disabled={isStreaming}>
          Send
        </button>
      </form>
    </div>
  );
}

