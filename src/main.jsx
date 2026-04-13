import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: "32px", fontFamily: "monospace", color: "#c00", background: "#fff", maxWidth: "800px", margin: "0 auto" }}>
          <h2>App Error — please send this to Karl:</h2>
          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all", fontSize: "13px", background: "#f5f5f5", padding: "16px", borderRadius: "8px" }}>
            {this.state.error?.toString()}
            {"\n\n"}
            {this.state.error?.stack}
          </pre>
          <button onClick={() => window.location.reload()} style={{ marginTop: "16px", padding: "10px 20px", fontSize: "14px", cursor: "pointer" }}>
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <ErrorBoundary><App /></ErrorBoundary>
);
