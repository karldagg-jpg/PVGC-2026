import { useState } from "react";
import { ALL_PLAYERS, TEAMS } from "../constants/league";
import { G, GO, R, M, CREAM, GOLD, CARD2, FB, FD } from "../constants/theme";

export default function ContactsScreen({ league, saveLeague, isAdmin }) {
  const contacts = league.contacts || {};
  const subs     = league.subs     || [];

  const [tab,      setTab]      = useState("players"); // "players" | "subs"
  const [editing,  setEditing]  = useState(false);
  const [draft,    setDraft]    = useState(null);  // copy of contacts while editing
  const [subDraft, setSubDraft] = useState(null);  // copy of subs while editing

  function startEdit() {
    setDraft(JSON.parse(JSON.stringify(contacts)));
    setSubDraft(JSON.parse(JSON.stringify(subs)));
    setEditing(true);
  }

  function cancelEdit() {
    setDraft(null);
    setSubDraft(null);
    setEditing(false);
  }

  function saveEdit() {
    saveLeague({ ...league, contacts: draft, subs: subDraft });
    setDraft(null);
    setSubDraft(null);
    setEditing(false);
  }

  function setContact(key, field, val) {
    setDraft(prev => ({ ...prev, [key]: { ...(prev[key] || {}), [field]: val } }));
  }

  function addSub() {
    setSubDraft(prev => [...prev, { id: Date.now(), name: "", phone: "", email: "" }]);
  }

  function updateSub(id, field, val) {
    setSubDraft(prev => prev.map(s => s.id === id ? { ...s, [field]: val } : s));
  }

  function removeSub(id) {
    setSubDraft(prev => prev.filter(s => s.id !== id));
  }

  const teamIds = Object.keys(TEAMS).map(Number).sort((a, b) => a - b);

  return (
    <div style={{ maxWidth: "680px", margin: "0 auto", padding: "20px 14px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "18px" }}>
        <div>
          <div style={{ fontFamily: FD, fontSize: "26px", fontWeight: 600, color: CREAM }}>Contacts</div>
          <div style={{ fontSize: "13px", color: M, marginTop: "2px" }}>Players & available subs</div>
        </div>
        {isAdmin && !editing && (
          <button onClick={startEdit} style={{ padding: "7px 16px", borderRadius: "8px", border: `1px solid ${G}`, background: "transparent", color: G, fontFamily: FB, fontSize: "13px", cursor: "pointer", fontWeight: 600 }}>
            Edit
          </button>
        )}
        {editing && (
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={cancelEdit} style={{ padding: "7px 14px", borderRadius: "8px", border: `1px solid #c0c8c0`, background: "transparent", color: M, fontFamily: FB, fontSize: "13px", cursor: "pointer" }}>
              Cancel
            </button>
            <button onClick={saveEdit} style={{ padding: "7px 16px", borderRadius: "8px", border: "none", background: G, color: "#fff", fontFamily: FB, fontSize: "13px", cursor: "pointer", fontWeight: 600 }}>
              Save
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "16px" }}>
        {["players", "subs"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "7px 18px", borderRadius: "20px", border: "none", cursor: "pointer", fontFamily: FB,
            fontSize: "13px", fontWeight: tab === t ? 700 : 400,
            background: tab === t ? G : "rgba(255,255,255,0.7)",
            color: tab === t ? "#fff" : M,
          }}>
            {t === "players" ? "Players" : "Subs"}
          </button>
        ))}
      </div>

      {/* Players tab */}
      {tab === "players" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {teamIds.map(tid => {
            const team = TEAMS[tid];
            return (
              <div key={tid} style={{ background: CARD2, borderRadius: "12px", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <div style={{ padding: "9px 14px", background: `${G}12`, borderBottom: `1px solid ${G}22`, fontSize: "12px", fontWeight: 700, color: G, letterSpacing: "0.04em" }}>
                  {team.name}
                </div>
                {[0, 1].map(pi => {
                  const pname = pi === 0 ? team.p1 : team.p2;
                  const key   = `${tid}-${pi}`;
                  const info  = editing ? (draft[key] || {}) : (contacts[key] || {});
                  return (
                    <div key={pi} style={{ padding: "12px 14px", borderBottom: pi === 0 ? `1px solid rgba(0,0,0,0.06)` : "none", display: "flex", alignItems: "flex-start", gap: "12px" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "14px", fontWeight: 600, color: CREAM, marginBottom: "4px" }}>{pname}</div>
                        {editing ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            <input
                              type="tel" value={info.phone || ""} placeholder="Phone"
                              onChange={e => setContact(key, "phone", e.target.value)}
                              style={inputStyle}
                            />
                            <input
                              type="email" value={info.email || ""} placeholder="Email"
                              onChange={e => setContact(key, "email", e.target.value)}
                              style={inputStyle}
                            />
                          </div>
                        ) : (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                            {info.phone ? (
                              <a href={`tel:${info.phone}`} style={linkStyle("#1a6b3a")}>
                                📞 {info.phone}
                              </a>
                            ) : (
                              <span style={{ fontSize: "12px", color: M, opacity: 0.5 }}>no phone</span>
                            )}
                            {info.email && (
                              <a href={`mailto:${info.email}`} style={linkStyle(GO)}>
                                ✉ {info.email}
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* Subs tab */}
      {tab === "subs" && (
        <div>
          {(editing ? subDraft : subs).length === 0 && !editing && (
            <div style={{ textAlign: "center", padding: "40px 0", color: M, fontSize: "14px" }}>
              No subs on file yet.{isAdmin ? " Click Edit to add." : ""}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {(editing ? subDraft : subs).map(sub => (
              <div key={sub.id} style={{ background: CARD2, borderRadius: "12px", padding: "14px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                {editing ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <input
                        type="text" value={sub.name} placeholder="Name"
                        onChange={e => updateSub(sub.id, "name", e.target.value)}
                        style={{ ...inputStyle, flex: 1, fontWeight: 600 }}
                      />
                      <button onClick={() => removeSub(sub.id)} style={{ padding: "6px 10px", borderRadius: "7px", border: `1px solid ${R}44`, background: `${R}10`, color: R, fontFamily: FB, fontSize: "12px", cursor: "pointer" }}>
                        Remove
                      </button>
                    </div>
                    <input type="tel"   value={sub.phone} placeholder="Phone" onChange={e => updateSub(sub.id, "phone", e.target.value)} style={inputStyle} />
                    <input type="email" value={sub.email} placeholder="Email" onChange={e => updateSub(sub.id, "email", e.target.value)} style={inputStyle} />
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: CREAM, marginBottom: "6px" }}>{sub.name || "—"}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                      {sub.phone ? (
                        <a href={`tel:${sub.phone}`} style={linkStyle(G)}>📞 {sub.phone}</a>
                      ) : (
                        <span style={{ fontSize: "12px", color: M, opacity: 0.5 }}>no phone</span>
                      )}
                      {sub.email && <a href={`mailto:${sub.email}`} style={linkStyle(GO)}>✉ {sub.email}</a>}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          {editing && (
            <button onClick={addSub} style={{ marginTop: "12px", width: "100%", padding: "11px", borderRadius: "10px", border: `2px dashed ${G}66`, background: "transparent", color: G, fontFamily: FB, fontSize: "14px", cursor: "pointer", fontWeight: 600 }}>
              + Add Sub
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "7px 10px", borderRadius: "7px",
  border: "1px solid #c8d0c0", background: "#fff",
  fontFamily: FB, fontSize: "13px", color: CREAM, outline: "none",
  boxSizing: "border-box",
};

function linkStyle(color) {
  return { fontSize: "13px", color, textDecoration: "none", fontWeight: 500 };
}
