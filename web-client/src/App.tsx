// ---------- web-client/src/App.tsx ----------
import {useEffect} from "react";
import ChatBox from "./components/ChatBox";
export default function App() {
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "dark");
  }, []);
  return (
    <div data-theme="dark" className="bg-base-100 text-base-content min-h-screen p-4">
      <ChatBox />
    </div>
  );
}

