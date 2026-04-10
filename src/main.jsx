import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

window.onerror = (msg, src, line, col, err) => {
  document.getElementById("root").innerHTML =
    `<div style="padding:20px;font-family:monospace;color:red;background:#fff;white-space:pre-wrap">` +
    `<strong>JS Error:</strong>\n${msg}\n${src}:${line}:${col}\n${err?.stack||""}` +
    `</div>`;
};

window.addEventListener("unhandledrejection", (e) => {
  document.getElementById("root").innerHTML =
    `<div style="padding:20px;font-family:monospace;color:red;background:#fff;white-space:pre-wrap">` +
    `<strong>Unhandled Promise:</strong>\n${e.reason?.stack || e.reason}` +
    `</div>`;
});

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: "20px", fontFamily: "monospace", color: "red", background: "#fff", whiteSpace: "pre-wrap" }}>
          <strong>React Error:</strong>{"\n"}{String(this.state.error)}{"\n"}{this.state.error?.stack}
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <ErrorBoundary><App /></ErrorBoundary>
);
