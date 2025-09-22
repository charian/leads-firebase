import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// antd의 글로벌 스타일을 import합니다.
import "antd/dist/reset.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
