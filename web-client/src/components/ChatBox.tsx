// ---------- web-client/src/components/ChatBox.tsx ----------
import { useEffect, useRef, useState } from "react";
import { chatWithLLM } from "../api";
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
  const chatBoxRef = useRef<HTMLDivElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    }

    setMessages([...newMessages, { role: "assistant", content: fullReply }]);
    setIsStreaming(false);
    setStreamedResponse("");
  };

  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [messages, streamedResponse]);

  const renderMarkdown = (content: string) => (
    <ReactMarkdown
      className="whitespace-pre-wrap inline-block"
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
    <div className="p-4 max-w-xl mx-auto">
      <div ref={chatBoxRef} className="border rounded p-4 mb-4 h-96 overflow-y-scroll">
        {messages.map((msg, idx) => (
          <div key={idx} className={`mb-2 ${msg.role === "user" ? "text-right" : "text-left"}`}>
            <b>{msg.role === "user" ? "You" : "Bot"}:</b>{" "}
            {renderMarkdown(msg.content)}
          </div>
        ))}
        {isStreaming && (
          <div className="text-left text-blue-600 whitespace-pre-wrap">
            {renderMarkdown(streamedResponse)}
          </div>
        )}
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          className="border rounded p-2 flex-1"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask something..."
        />
        <button className="bg-blue-500 text-white px-4 rounded" type="submit" disabled={isStreaming}>
          Send
        </button>
      </form>
    </div>
  );
}
