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
import { uploadFileToContext } from "../api";

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
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
  
    setUploading(true);
    setUploadStatus(null);
  
    try {
      await uploadFileToContext(file);
      setUploadStatus(`✅ Uploaded: ${file.name}`);
    } catch (err) {
      console.error("File upload failed:", err);
      setUploadStatus("❌ Upload failed. See console.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

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

    const userMsg: Message = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setStreaming(true);

    try {
      await setModel(model);
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
    <div className="min-h-screen bg-base-100 flex flex-col">
      {/* Banner */}
	  <div className="bg-primary bg-gradient-to-r from-primary to-secondary flex items-center justify-center py-8 shadow-lg">
	    <div className="text-center">
	      <h1 className="md:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-wide text-neutral">🤖 AI Chat Assistant</h1>
	      <p className="text-lg text-neutral text-opacity-80 max-w-md mx-auto">
	        Have a conversation with an AI assistant. Ask questions, get answers, and explore possibilities!
	      </p>
	    </div>
	  </div>

      {/* Sticky Model Selector */}
      {models.length > 0 && (
        <div className="sticky top-0 z-10 bg-base-200 p-4 shadow-md">
          <label htmlFor="model" className="block text-sm font-medium text-gray-300 mb-2">
            Select Model:
          </label>
          <select
            id="model"
            value={model}
            onChange={(e) => setCurrentModel(e.target.value)}
            className="select select-bordered w-full max-w-xs"
          >
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Chat Messages */}
      <div className="flex-grow p-4 overflow-y-auto" ref={containerRef}>
        {messages.map((message, index) => {
          const isUser = message.role === 'user';
          return (
            <div
              key={index}
              className={`chat ${isUser ? 'chat-end' : 'chat-start'} mb-4`}
            >
              <div className={`chat-bubble ${isUser ? 'chat-bubble-primary' : 'chat-bubble-base-300'} max-w-2xl`}>
                <ReactMarkdown
                  rehypePlugins={[rehypeRaw, rehypeKatex]}
                  remarkPlugins={[remarkGfm, remarkMath]}
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

      {/* File Upload Section */}
      <div className="flex items-center gap-2">
        <input
          type="file"
          className="file-input file-input-bordered w-full max-w-xs"
          onChange={handleFileUpload}
          ref={fileInputRef}
          disabled={uploading}
        />
        {uploading && <span className="loading loading-spinner text-primary"></span>}
        {uploadStatus && <span className="text-sm text-success">{uploadStatus}</span>}
      </div> 

      {/* Input Area */}
      <div className="bg-base-200 p-4 flex gap-2 items-end">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message..."
          rows={3}
          className="textarea textarea-bordered flex-grow resize-none"
        />
        <button
          onClick={handleSend}
          disabled={streaming}
          className={`btn btn-primary ${streaming ? 'loading' : ''}`}
        >
          Send
        </button>
      </div>
    </div>
  );
}
