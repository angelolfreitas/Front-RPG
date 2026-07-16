import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./index.css";

if (typeof window !== "undefined") {
  window.addEventListener("load", () => {
    setTimeout(() => {
      const largura = document.documentElement.clientWidth;
      const suspeitos = [];
      document.querySelectorAll("*").forEach((el) => {
        if (el.scrollWidth > largura + 5) {
          suspeitos.push(`${el.tagName}.${[...el.classList].slice(0, 2).join(".")} → ${el.scrollWidth}px`);
        }
      });

      if (suspeitos.length > 0) {
        const banner = document.createElement("div");
        banner.style.cssText =
          "position:fixed;top:0;left:0;right:0;z-index:99999;background:red;color:white;font-size:10px;padding:8px;max-height:40vh;overflow:auto;font-family:monospace;";
        banner.innerText = "OVERFLOW (" + largura + "px tela):\n" + suspeitos.join("\n");
        document.body.appendChild(banner);
      }
    }, 800);
  });
}
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
