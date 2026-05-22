import { useState, useEffect } from "react";
import { auth } from "../firebase/client";

const APP_URL = "https://pvgc-league.github.io/PVGC-2026/";
const EMAIL_KEY = "pvgc_signin_email";

const ACTION_CODE_SETTINGS = {
  url: APP_URL,
  handleCodeInApp: true,
};

export default function AuthGate({ children }) {
  const [user, setUser]       = useState(undefined); // undefined = loading
  const [email, setEmail]     = useState("");
  const [step, setStep]       = useState("input");   // input | sent | completing | error
  const [errorMsg, setErrorMsg] = useState("");

  // Complete sign-in if URL contains a magic link
  useEffect(() => {
    if (auth.isSignInWithEmailLink(window.location.href)) {
      setStep("completing");
      let stored = localStorage.getItem(EMAIL_KEY);
      if (!stored) {
        stored = window.prompt("Please enter your email to confirm sign-in:");
      }
      if (stored) {
        auth.signInWithEmailLink(stored, window.location.href)
          .then(() => {
            localStorage.removeItem(EMAIL_KEY);
            window.history.replaceState({}, document.title, APP_URL);
          })
          .catch(err => {
            setErrorMsg("Sign-in link expired or already used. Request a new one.");
            setStep("error");
          });
      } else {
        setStep("input");
      }
    }
  }, []);

  // Track auth state
  useEffect(() => {
    return auth.onAuthStateChanged(u => setUser(u || null));
  }, []);

  async function sendLink(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setStep("sending");
    try {
      await auth.sendSignInLinkToEmail(email.trim(), ACTION_CODE_SETTINGS);
      localStorage.setItem(EMAIL_KEY, email.trim());
      setStep("sent");
    } catch (err) {
      setErrorMsg("Couldn't send email. Check the address and try again.");
      setStep("error");
    }
  }

  // Still loading auth state
  if (user === undefined || step === "completing") {
    return (
      <div style={screen}>
        <div style={spinner}>⛳</div>
        <div style={{ color: "#888", fontSize: "14px", marginTop: "12px" }}>Loading…</div>
      </div>
    );
  }

  // Signed in — show the app
  if (user) return children;

  // Sign-in UI
  return (
    <div style={screen}>
      <div style={card}>
        <div style={{ fontSize: "36px", marginBottom: "8px" }}>⛳</div>
        <div style={{ fontSize: "22px", fontWeight: 800, color: "#1a4d2e", marginBottom: "4px" }}>PVGC League</div>
        <div style={{ fontSize: "13px", color: "#999", marginBottom: "28px" }}>2026 Season</div>

        {step === "sent" ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "32px", marginBottom: "12px" }}>📬</div>
            <div style={{ fontSize: "16px", fontWeight: 700, color: "#1a4d2e", marginBottom: "8px" }}>Check your email</div>
            <div style={{ fontSize: "14px", color: "#666", lineHeight: 1.5 }}>
              We sent a sign-in link to<br />
              <strong>{email}</strong>
            </div>
            <div style={{ fontSize: "12px", color: "#aaa", marginTop: "16px" }}>Tap the link in the email to sign in</div>
            <button onClick={() => setStep("input")} style={linkBtn}>Use a different email</button>
          </div>
        ) : step === "error" ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "13px", color: "#c0392b", marginBottom: "16px", lineHeight: 1.5 }}>{errorMsg}</div>
            <button onClick={() => setStep("input")} style={primaryBtn}>Try Again</button>
          </div>
        ) : (
          <form onSubmit={sendLink} style={{ width: "100%" }}>
            <div style={{ fontSize: "14px", color: "#555", marginBottom: "16px", textAlign: "center", lineHeight: 1.5 }}>
              Enter your email to receive a sign-in link
            </div>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              autoFocus
              style={inputStyle}
            />
            <button type="submit" disabled={step === "sending"} style={primaryBtn}>
              {step === "sending" ? "Sending…" : "Send Sign-In Link"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

const screen = {
  minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
  background: "#f5f3ee", padding: "20px",
};
const card = {
  background: "#fff", borderRadius: "20px", padding: "32px 28px",
  width: "100%", maxWidth: "360px", textAlign: "center",
  boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
};
const inputStyle = {
  width: "100%", padding: "12px 14px", borderRadius: "10px",
  border: "1px solid #ddd", fontSize: "16px", marginBottom: "12px",
  outline: "none", boxSizing: "border-box",
};
const primaryBtn = {
  width: "100%", padding: "13px", borderRadius: "10px", border: "none",
  background: "#1a4d2e", color: "#fff", fontSize: "15px", fontWeight: 700,
  cursor: "pointer",
};
const linkBtn = {
  background: "none", border: "none", color: "#1a4d2e", fontSize: "13px",
  cursor: "pointer", marginTop: "16px", textDecoration: "underline",
};
const spinner = { fontSize: "40px", animation: "pulse 1.5s ease-in-out infinite" };
