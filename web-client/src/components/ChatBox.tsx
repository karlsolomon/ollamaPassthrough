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

// Define types for better type safety
interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatBox() {
  const [messages, setMessages] = useState<Message[]>([]);
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

  const handleSend: React.FormEventHandler<HTMLButtonElement> = async () => {
    if (!input.trim()) return;

    // Create new message and add placeholder for assistant response
    const userMsg: Message = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setStreaming(true);

    try {
      await setModel(model);
      
      // Handle chat with LLM and streaming responses
      await chatWithLLM([...messages, userMsg], model, (chunk) => {
        setMessages((prev) => {
          const updated = [...prev];
          if (updated.length > 0 && updated[updated.length - 1].role === 'assistant') {
            updated[updated.length - 1].content += chunk;
          } else {
            updated.push({ role: 'assistant', content: chunk });
          }
          return updated;
        });
      });
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setStreaming(false);
    }
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSend();
    }
  };

  return (
    <div className="min-h-screen bg-base-100">
      {/* Chat Header */}
      <header className="bg-primary text-white p-4 shadow-md">
        <h1 className="text-xl font-bold">AI Chat Interface</h1>
      </header>

      {/* Model Selector */}
      {models.length > 0 && (
        <div className="p-4 bg-base-200">
          <label htmlFor="model" className="block text-sm font-medium text-gray-700 mb-2">
            Select Model:
          </label>
          <select
            id="model"
            value={model}
            onChange={(e) => setCurrentModel(e.target.value)}
            className="w-full max-w-xs bg-white rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Chat Container */}
      <div className="flex-grow p-4 overflow-y-auto">
        {messages.map((message, index) => {
          const isUser = message.role === 'user';
          return (
            <div
              key={index}
              className={`mb-4 ${isUser ? 'text-right' : ''}`}
            >
              <div
                className={`inline-block p-2 rounded-md ${
                  isUser
                    ? 'bg-primary text-white'
                    : 'bg-base-200 text-gray-700'
                }`}
              >
                <ReactMarkdown
                  components={{
                    code: ({ node, inline, className, children, ...props }) => {
                      const match = /language-(\w+)/.exec(className || '');
                      return !inline && match ? (
                        <SyntaxHighlighter
                          style={atomOneDark}
                          language={match[1]}
                          PreTag="div"
                          {...props}
                        >
                          {String(children).replace(/\n$/, '')}
                        </SyntaxHighlighter>
                      ) : (
                        <code className={className} {...props}>
                          {children}
                        </code>
                      );
                    },
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-base-200 flex items-center gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message..."
          rows={3}
          className="flex-grow w-full resize-none rounded-md p-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <button
          onClick={handleSend}
          disabled={streaming}
          className={`btn ${streaming ? 'loading' : ''} btn-primary`}
        >
          Send
        </button>
      </div>
    </div>
  );
}
