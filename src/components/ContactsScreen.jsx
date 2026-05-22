import { useState } from "react";
import { G, GO, R, M, CREAM, CARD2, FB, FD } from "../constants/theme";

function formatPhone(val) {
  const d = (val || "").replace(/\D/g, "").slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
}

export default function ContactsScreen({ league, saveLeague, isAdmin }) {
  const subs = league.subs || [];

  const [editing,  setEditing]  = useState(false);
  const [subDraft, setSubDraft] = useState(null);

  function startEdit() {
    setSubDraft(JSON.parse(JSON.stringify(subs)));
    setEditing(true);
  }

  function cancelEdit() {
    setSubDraft(null);
    setEditing(false);
  }

  function saveEdit() {
    saveLeague({ ...league, subs: subDraft });
    setSubDraft(null);
    setEditing(false);
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

  const list = editing ? subDraft : subs;

  return (
    <div style={{ maxWidth: "560px", margin: "0 auto", padding: "20px 14px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "20px" }}>
        <div>
          <div style={{ fontFamily: FD, fontSize: "26px", fontWeight: 600, color: CREAM }}>Subs</div>
          <div style={{ fontSize: "13px", color: M, marginTop: "2px" }}>Available substitutes</div>
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

      {list.length === 0 && !editing && (
        <div style={{ textAlign: "center", padding: "40px 0", color: M, fontSize: "14px" }}>
          No subs on file yet.{isAdmin ? " Click Edit to add." : ""}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {list.map(sub => (
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
                <input type="tel"   value={sub.phone || ""} placeholder="Phone" onChange={e => updateSub(sub.id, "phone", formatPhone(e.target.value))} style={inputStyle} />
                <input type="email" value={sub.email || ""} placeholder="Email" onChange={e => updateSub(sub.id, "email", e.target.value)} style={inputStyle} />
              </div>
            ) : (
              <div>
                <div style={{ fontSize: "15px", fontWeight: 600, color: CREAM, marginBottom: "6px" }}>{sub.name || "—"}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
                  {sub.phone ? (<>
                    <a href={`tel:${sub.phone}`} style={{ fontSize: "13px", color: G, textDecoration: "none", fontWeight: 500 }}>📞 {formatPhone(sub.phone)}</a>
                    <a href={`sms:${sub.phone}`} style={{ fontSize: "13px", color: GO, textDecoration: "none", fontWeight: 500 }}>💬 Text</a>
                  </>) : <span style={{ fontSize: "12px", color: M, opacity: 0.5 }}>no phone</span>}
                  {sub.email && <a href={`mailto:${sub.email}`} style={{ fontSize: "13px", color: GO, textDecoration: "none", fontWeight: 500 }}>✉ {sub.email}</a>}
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
  );
}

const inputStyle = {
  width: "100%", padding: "7px 10px", borderRadius: "7px",
  border: "1px solid #c8d0c0", background: "#fff",
  fontFamily: FB, fontSize: "13px", color: CREAM, outline: "none",
  boxSizing: "border-box",
};
