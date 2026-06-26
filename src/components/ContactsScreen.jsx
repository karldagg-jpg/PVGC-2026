import { useState } from "react";
import { SCHEDULE } from "../constants/league";
import { G, GO, R, M, CREAM, GOLD, CARD2, FB, FD } from "../constants/theme";

function formatPhone(val) {
  const d = (val || "").replace(/\D/g, "").slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
}

function currentWeekNum() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  for (let w = 1; w <= 17; w++) {
    const d = SCHEDULE[w]?.date;
    if (!d) continue;
    if (today <= new Date(d + "T12:00:00")) return w;
  }
  return 17;
}

// Weeks that are current or future
function upcomingWeeks() {
  const cur = currentWeekNum();
  return Array.from({ length: 17 }, (_, i) => i + 1).filter(w => w >= cur);
}

// Active bookings = current or future weeks only
function activeBookings(bookings = {}) {
  const cur = currentWeekNum();
  return Object.entries(bookings)
    .map(([w, note]) => ({ week: Number(w), note }))
    .filter(b => b.week >= cur)
    .sort((a, b) => a.week - b.week);
}

export default function ContactsScreen({ league, saveLeague, isAdmin }) {
  const subs = league.subs || [];

  const [editing,  setEditing]  = useState(false);
  const [subDraft, setSubDraft] = useState(null);
  // Per-sub "add booking" UI state: { [subId]: { week, note } }
  const [addingBooking, setAddingBooking] = useState({});

  function startEdit() {
    setSubDraft(JSON.parse(JSON.stringify(subs)));
    setEditing(true);
    setAddingBooking({});
  }
  function cancelEdit() { setSubDraft(null); setEditing(false); setAddingBooking({}); }
  function saveEdit()   { saveLeague({ ...league, subs: subDraft }); setSubDraft(null); setEditing(false); setAddingBooking({}); }

  function addSub() {
    setSubDraft(prev => [...prev, { id: Date.now(), name: "", phone: "", email: "", bookings: {} }]);
  }
  function updateSub(id, field, val) {
    setSubDraft(prev => prev.map(s => s.id === id ? { ...s, [field]: val } : s));
  }
  function removeSub(id) {
    setSubDraft(prev => prev.filter(s => s.id !== id));
  }

  function addBooking(id) {
    const { week, note } = addingBooking[id] || {};
    if (!week) return;
    setSubDraft(prev => prev.map(s => s.id === id
      ? { ...s, bookings: { ...(s.bookings || {}), [week]: note || "" } }
      : s
    ));
    setAddingBooking(prev => ({ ...prev, [id]: null }));
  }
  function removeBooking(id, week) {
    setSubDraft(prev => prev.map(s => {
      if (s.id !== id) return s;
      const next = { ...(s.bookings || {}) };
      delete next[week];
      return { ...s, bookings: next };
    }));
  }

  const list = editing ? subDraft : subs;
  const upcoming = upcomingWeeks();

  return (
    <div style={{ maxWidth: "560px", margin: "0 auto", padding: "20px 14px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "20px" }}>
        <div>
          <div style={{ fontFamily: FD, fontSize: "26px", fontWeight: 600, color: CREAM }}>Subs</div>
          <div style={{ fontSize: "13px", color: M, marginTop: "2px" }}>Available substitutes</div>
        </div>
        {!editing && (
          <button onClick={startEdit} style={{ padding: "7px 16px", borderRadius: "8px", border: `1px solid ${G}`, background: "transparent", color: G, fontFamily: FB, fontSize: "13px", cursor: "pointer", fontWeight: 600 }}>
            Edit
          </button>
        )}
        {editing && (
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={cancelEdit} style={{ padding: "7px 14px", borderRadius: "8px", border: `1px solid #c0c8c0`, background: "transparent", color: M, fontFamily: FB, fontSize: "13px", cursor: "pointer" }}>Cancel</button>
            <button onClick={saveEdit}   style={{ padding: "7px 16px", borderRadius: "8px", border: "none", background: G, color: "#fff", fontFamily: FB, fontSize: "13px", cursor: "pointer", fontWeight: 600 }}>Save</button>
          </div>
        )}
      </div>

      {list.length === 0 && !editing && (
        <div style={{ textAlign: "center", padding: "40px 0", color: M, fontSize: "14px" }}>
          No subs on file yet. Click Edit to add.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {list.map(sub => {
          const booked = activeBookings(sub.bookings);
          const isBooked = booked.length > 0;

          return (
            <div key={sub.id} style={{
              background: CARD2, borderRadius: "12px", padding: "14px",
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              border: isBooked && !editing ? `1px solid ${R}33` : "1px solid transparent",
            }}>
              {editing ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                  {/* Name + remove */}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <input type="text" value={sub.name} placeholder="Name"
                      onChange={e => updateSub(sub.id, "name", e.target.value)}
                      style={{ ...inputStyle, flex: 1, fontWeight: 600 }} />
                    <button onClick={() => removeSub(sub.id)} style={{ padding: "6px 10px", borderRadius: "7px", border: `1px solid ${R}44`, background: `${R}10`, color: R, fontFamily: FB, fontSize: "12px", cursor: "pointer" }}>
                      Remove
                    </button>
                  </div>
                  <input type="tel"   value={sub.phone || ""} placeholder="Phone"
                    onChange={e => updateSub(sub.id, "phone", formatPhone(e.target.value))} style={inputStyle} />
                  <input type="email" value={sub.email || ""} placeholder="Email"
                    onChange={e => updateSub(sub.id, "email", e.target.value)} style={inputStyle} />

                  {/* Bookings */}
                  <div style={{ paddingTop: "6px", borderTop: `1px solid rgba(0,0,0,0.07)` }}>
                    <div style={{ fontSize: "11px", color: M, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>Bookings</div>
                    {activeBookings(sub.bookings).map(({ week, note }) => (
                      <div key={week} style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "5px" }}>
                        <span style={{ fontSize: "12px", fontWeight: 700, color: R, background: `${R}12`, padding: "2px 8px", borderRadius: "5px" }}>Wk {week}</span>
                        <span style={{ fontSize: "12px", color: M, flex: 1 }}>{note || "—"}</span>
                        <button onClick={() => removeBooking(sub.id, week)} style={{ fontSize: "11px", color: R, background: "none", border: "none", cursor: "pointer", padding: "2px 6px" }}>✕</button>
                      </div>
                    ))}

                    {/* Add booking row */}
                    {addingBooking[sub.id] !== null && addingBooking[sub.id] !== undefined ? (
                      <div style={{ display: "flex", gap: "6px", alignItems: "center", marginTop: "4px" }}>
                        <select
                          value={addingBooking[sub.id]?.week || ""}
                          onChange={e => setAddingBooking(prev => ({ ...prev, [sub.id]: { ...(prev[sub.id] || {}), week: Number(e.target.value) } }))}
                          style={{ ...inputStyle, width: "90px", padding: "6px 8px" }}>
                          <option value="">Wk</option>
                          {upcoming.filter(w => !sub.bookings?.[w]).map(w => (
                            <option key={w} value={w}>Wk {w}</option>
                          ))}
                        </select>
                        <input type="text"
                          value={addingBooking[sub.id]?.note || ""}
                          placeholder="Team (optional)"
                          onChange={e => setAddingBooking(prev => ({ ...prev, [sub.id]: { ...(prev[sub.id] || {}), note: e.target.value } }))}
                          style={{ ...inputStyle, flex: 1, padding: "6px 8px" }} />
                        <button onClick={() => addBooking(sub.id)} style={{ padding: "6px 10px", borderRadius: "7px", border: "none", background: G, color: "#fff", fontFamily: FB, fontSize: "12px", cursor: "pointer", fontWeight: 600 }}>Add</button>
                        <button onClick={() => setAddingBooking(prev => ({ ...prev, [sub.id]: null }))} style={{ fontSize: "12px", color: M, background: "none", border: "none", cursor: "pointer" }}>✕</button>
                      </div>
                    ) : (
                      upcoming.some(w => !sub.bookings?.[w]) && (
                        <button onClick={() => setAddingBooking(prev => ({ ...prev, [sub.id]: { week: upcoming.find(w => !sub.bookings?.[w]), note: "" } }))}
                          style={{ fontSize: "12px", color: G, background: "none", border: `1px dashed ${G}66`, borderRadius: "6px", padding: "4px 10px", cursor: "pointer", fontFamily: FB }}>
                          + Book a week
                        </button>
                      )
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                    <div style={{ fontSize: "15px", fontWeight: 600, color: CREAM, flex: 1 }}>{sub.name || "—"}</div>
                    {isBooked && (
                      <span style={{ fontSize: "11px", fontWeight: 700, color: R, background: `${R}12`, padding: "2px 8px", borderRadius: "5px", border: `1px solid ${R}33` }}>
                        Booked
                      </span>
                    )}
                  </div>
                  {/* Booking badges */}
                  {booked.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: "8px" }}>
                      {booked.map(({ week, note }) => (
                        <span key={week} style={{ fontSize: "11px", color: R, background: `${R}0d`, padding: "2px 8px", borderRadius: "5px", border: `1px solid ${R}22` }}>
                          Wk {week}{note ? ` · ${note}` : ""}
                        </span>
                      ))}
                    </div>
                  )}
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
          );
        })}
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
