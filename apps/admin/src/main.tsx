import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./ui/base.css";
import "./ui/themes.css";
import "./ui/compat.css";
import "./ui/editor.css";
import "./ui/command-palette.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
