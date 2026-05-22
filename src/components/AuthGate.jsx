import { useState, useEffect } from "react";
import { auth, firebase, LEAGUE_DOC } from "../firebase/client";

const APP_URL = "https://pvgc-league.github.io/PVGC-2026/";
const EMAIL_KEY = "pvgc_signin_email";

const ACTION_CODE_SETTINGS = { url: APP_URL, handleCodeInApp: true };

const isIosStandalone = () => window.navigator.standalone === true;

export default function AuthGate({ children }) {
  const [user, setUser]         = useState(undefined);
  const [email, setEmail]       = useState("");
  const [step, setStep]         = useState("input"); // input | sent | completing | error | denied
  const [errorMsg, setErrorMsg] = useState("");

  // After sign-in, check allowedEmails list
  async function checkAccess(u) {
    try {
      const doc = await LEAGUE_DOC.get();
      const allowed = doc.data()?.allowedEmails || [];
      // Empty list = not yet configured, let everyone through
      if (allowed.length === 0 || allowed.map(e => e.toLowerCase()).includes(u.email?.toLowerCase())) {
        setUser(u);
      } else {
        await auth.signOut();
        setErrorMsg(`${u.email} is not authorized. Contact your league admin.`);
        setStep("denied");
      }
    } catch {
      // If we can't fetch the list, allow through (avoids lockout on network error)
      setUser(u);
    }
  }

  // Handle magic link and Google redirect on mount
  useEffect(() => {
    auth.getRedirectResult()
      .then(result => { if (result?.user) setStep("done"); })
      .catch(() => {});

    if (auth.isSignInWithEmailLink(window.location.href)) {
      setStep("completing");
      let stored = localStorage.getItem(EMAIL_KEY);
      if (!stored) stored = window.prompt("Enter your email to confirm sign-in:");
      if (stored) {
        auth.signInWithEmailLink(stored, window.location.href)
          .then(() => {
            localStorage.removeItem(EMAIL_KEY);
            window.history.replaceState({}, document.title, APP_URL);
            setStep("done");
          })
          .catch(() => {
            setErrorMsg("Sign-in link expired or already used. Request a new one.");
            setStep("error");
          });
      } else {
        setStep("input");
      }
    }
  }, []);

  // Track auth state — run access check on sign-in
  useEffect(() => {
    return auth.onAuthStateChanged(u => {
      if (u && !u.isAnonymous) {
        checkAccess(u);
      } else {
        setUser(null);
      }
    });
  }, []);

  async function signInWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
      if (isIosStandalone()) {
        await auth.signInWithRedirect(provider);
      } else {
        await auth.signInWithPopup(provider);
      }
    } catch {
      setErrorMsg("Google sign-in failed. Try the email link below.");
      setStep("error");
    }
  }

  async function sendLink(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setStep("sending");
    try {
      await auth.sendSignInLinkToEmail(email.trim(), ACTION_CODE_SETTINGS);
      localStorage.setItem(EMAIL_KEY, email.trim());
      setStep("sent");
    } catch {
      setErrorMsg("Couldn't send email. Check the address and try again.");
      setStep("error");
    }
  }

  if (user === undefined || step === "completing") {
    return (
      <div style={screen}>
        <div style={{ fontSize: "40px" }}>⛳</div>
        <div style={{ color: "#888", fontSize: "14px", marginTop: "12px" }}>Loading…</div>
      </div>
    );
  }

  if (user) return children;

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
              We sent a sign-in link to<br /><strong>{email}</strong>
            </div>
            <div style={{ fontSize: "12px", color: "#aaa", marginTop: "16px" }}>Tap the link in the email to sign in</div>
            <button onClick={() => setStep("input")} style={linkBtn}>Use a different email</button>
          </div>
        ) : step === "denied" ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "32px", marginBottom: "12px" }}>⛔</div>
            <div style={{ fontSize: "14px", color: "#c0392b", lineHeight: 1.5, marginBottom: "16px" }}>{errorMsg}</div>
            <button onClick={() => setStep("input")} style={emailBtn}>Try a different account</button>
          </div>
        ) : step === "error" ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "13px", color: "#c0392b", marginBottom: "16px", lineHeight: 1.5 }}>{errorMsg}</div>
            <button onClick={() => setStep("input")} style={emailBtn}>Try Again</button>
          </div>
        ) : (
          <>
            <button onClick={signInWithGoogle} style={googleBtn}>
              <svg width="18" height="18" viewBox="0 0 18 18" style={{ marginRight: "10px", flexShrink: 0 }}>
                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"/>
              </svg>
              Sign in with Google
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "16px 0" }}>
              <div style={{ flex: 1, height: "1px", background: "#eee" }} />
              <div style={{ fontSize: "12px", color: "#bbb" }}>or</div>
              <div style={{ flex: 1, height: "1px", background: "#eee" }} />
            </div>
            <form onSubmit={sendLink} style={{ width: "100%" }}>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="Email sign-in link" style={inputStyle} />
              <button type="submit" disabled={step === "sending"} style={emailBtn}>
                {step === "sending" ? "Sending…" : "Send Link"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

const screen = { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f3ee", padding: "20px" };
const card = { background: "#fff", borderRadius: "20px", padding: "32px 28px", width: "100%", maxWidth: "360px", textAlign: "center", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" };
const googleBtn = { width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #ddd", background: "#fff", color: "#333", fontSize: "15px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };
const inputStyle = { width: "100%", padding: "11px 14px", borderRadius: "10px", border: "1px solid #ddd", fontSize: "15px", marginBottom: "8px", outline: "none", boxSizing: "border-box" };
const emailBtn = { width: "100%", padding: "11px", borderRadius: "10px", border: "none", background: "#1a4d2e", color: "#fff", fontSize: "14px", fontWeight: 700, cursor: "pointer" };
const linkBtn = { background: "none", border: "none", color: "#1a4d2e", fontSize: "13px", cursor: "pointer", marginTop: "16px", textDecoration: "underline" };
