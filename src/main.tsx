import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./App.css";
import "./components/Header.css";
import "./components/TodoItem.css";
import "./components/Canvas.css";

createRoot(document.getElementById("root")!).render(<App />);
