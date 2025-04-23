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
    <div className="bg-gray-900 text-gray-100 flex flex-col h-screen max-w-3xl mx-auto">
      <div ref={chatBoxRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`chat ${msg.role === "user" ? "chat-end" : "chat-start"}`}
          >
            <div className={`chat-bubble ${msg.role === "user" ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-100"}`}>
              {renderMarkdown(msg.content)}
            </div>
          </div>
        ))}
        {isStreaming && (
          <div className="chat chat-start">
            <div className="chat-bubble bg-gray-700 text-blue-400">
              {renderMarkdown(streamedResponse)}
            </div>
          </div>
        )}
      </div>
      <form onSubmit={handleSubmit} className="p-4 flex gap-2 bg-gray-800 border-t border-gray-700">
        <textarea
          className="textarea textarea-bordered textarea-lg w-full bg-gray-900 text-white resize-none"
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
