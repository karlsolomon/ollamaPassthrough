import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { chatWithLLM } from "../api";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypePrism from "rehype-prism-plus";
import "katex/dist/katex.min.css";
import "../chat-theme.css";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface ChatBoxHandle {
  handleSend: (input: string) => void;
  streaming: boolean;
}

const ChatBox = forwardRef<ChatBoxHandle>((_, ref) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);

  async function handleSend(input: string) {
    if (!input.trim()) return;
    const userMessage: Message = { role: "user", content: input };
    const placeholderAssistant: Message = { role: "assistant", content: "" };
    setMessages((prev) => [...prev, userMessage, placeholderAssistant]);
    setStreaming(true);

    const controller = new AbortController();
    setAbortController(controller);

    let accumulated = "";
    try {
      await chatWithLLM(
        [...messages, userMessage],
        undefined,
        (chunk) => {
          accumulated += chunk;
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: "assistant",
              content: accumulated,
            };
            return updated;
          });
        },
        controller.signal
      );
    } catch (err) {
      console.error("Streaming error:", err);
    } finally {
      setStreaming(false);
      setAbortController(null);
    }
  }

  useImperativeHandle(ref, () => ({
    handleSend,
    streaming,
  }));

  return (
    <div className="d-flex flex-column h-100 px-3 pt-3">
      <div className="flex-grow-1 overflow-auto mb-3 border rounded p-3" ref={containerRef}>
        {messages.map((msg, i) => (
          <div key={i} className={`chat-message ${msg.role}`}>
            <div className={`bubble ${msg.role}`}>
              <ReactMarkdown
                children={msg.content}
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeRaw, rehypeKatex, rehypePrism]}
              />
            </div>
          </div>
        ))}
        {streaming && <div className="text-muted text-center">Streaming...</div>}
      </div>
    </div>
  );
});

export default ChatBox;
