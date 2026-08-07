import { useState, useMemo } from "react";
import { TEAMS } from "../constants/league";
import { weeklyHighScorers } from "../lib/leagueLogic";
import { G, GO, R, M, CREAM, GOLD, CARD, CARD2, FB, FD } from "../constants/theme";

// 2026 defaults (editable in the Amounts panel; persisted in league.budget).
const DEFAULT_BUDGET = {
  duesPerPlayer: 60,
  potwPerWeek: 20,
  potyAmount: 50,
  potyTrophy: 85,
  regSeason1st: 200,
  playoff1st: 500,
  playoff2nd: 200,
  playoff3rd: 100,
  engraving: 50,
  food: 300,
  tip: 200,
  exempt: ["Brian Charles", "Jack Carickhoff", "Karl Dagg"],
  // winner overrides — null/empty means "use the auto value from the season data"
  potyWinner: null, // player key "tid-pi" or null
  reg1Winner: null, // team id or null
  po1: null, po2: null, po3: null, // playoff placement team ids
};

const money = (n) => `$${(Math.round((Number(n) || 0) * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const playerName = (key) => { const [t, pi] = String(key).split("-").map(Number); return TEAMS[t]?.[pi === 0 ? "p1" : "p2"] || key; };

export default function BudgetScreen({ league, saveLeague, teamStandings, potyList }) {
  const B = { ...DEFAULT_BUDGET, ...(league.budget || {}) };
  const dues = league.dues || {};
  const [tab, setTab] = useState("summary"); // summary | dues | potw | payouts | amounts

  const setBudget = (patch) => saveLeague({ ...league, budget: { ...B, ...patch } });
  const setDue = (key, paid) => saveLeague({ ...league, dues: { ...dues, [key]: paid } });

  // ── Roster + dues ────────────────────────────────────────────────────────────
  const players = useMemo(() => {
    const out = [];
    for (let t = 1; t <= 18; t++) for (let pi = 0; pi < 2; pi++) {
      const name = TEAMS[t]?.[pi === 0 ? "p1" : "p2"];
      if (name) out.push({ key: `${t}-${pi}`, tid: t, pi, name, team: TEAMS[t]?.name });
    }
    return out;
  }, []);
  const exemptSet = useMemo(() => new Set((B.exempt || []).map((n) => n.trim().toLowerCase())), [B.exempt]);
  const isExempt = (p) => exemptSet.has(p.name.trim().toLowerCase());
  const paying = players.filter((p) => !isExempt(p));
  const paidCount = paying.filter((p) => dues[p.key]).length;
  const expectedIncome = paying.length * B.duesPerPlayer;
  const collected = paidCount * B.duesPerPlayer;

  // ── Player of the Week (weeks 1–18, rainouts return to pot) ───────────────────
  const potw = useMemo(
    () => weeklyHighScorers(league.results, league.handicaps, league.cancelledWeeks, 18),
    [league.results, league.handicaps, league.cancelledWeeks]
  );
  const potwRows = [];
  let potwPaidWeeks = 0, potwReturned = 0;
  for (let w = 1; w <= 18; w++) {
    const r = potw[w] || {};
    if (r.rainout) { potwRows.push({ w, rainout: true }); potwReturned += B.potwPerWeek; continue; }
    if (!r.winners?.length) { potwRows.push({ w, none: true }); continue; }
    potwPaidWeeks++;
    const each = B.potwPerWeek / r.winners.length;
    potwRows.push({ w, pts: r.pts, winners: r.winners.map((x) => ({ key: `${x.tid}-${x.pi}`, name: TEAMS[x.tid]?.[x.pi === 0 ? "p1" : "p2"] || "" })), each });
  }
  const potwSpend = potwPaidWeeks * B.potwPerWeek;

  // ── Season winners (auto with override) ───────────────────────────────────────
  const potyAuto = potyList?.[0] ? `${potyList[0].tid}-${potyList[0].pi}` : null;
  const potyWinner = B.potyWinner || potyAuto;
  const reg1Auto = teamStandings?.[0]?.id ?? null;
  const reg1 = B.reg1Winner ?? reg1Auto;

  // ── Payout roll-up ────────────────────────────────────────────────────────────
  const lines = [
    { id: "potw", label: "Player of the Week", detail: `${potwPaidWeeks} weeks · ${money(B.potwPerWeek)}/wk`, amt: potwSpend, auto: true },
    { id: "poty", label: "Player of the Year", detail: potyWinner ? playerName(potyWinner) : "—", amt: B.potyAmount },
    { id: "potyTrophy", label: "POTY Trophy", detail: "", amt: B.potyTrophy },
    { id: "reg1", label: "Regular Season 1st", detail: reg1 ? TEAMS[reg1]?.name : "—", amt: B.regSeason1st },
    { id: "po1", label: "Playoffs — 1st", detail: B.po1 ? TEAMS[B.po1]?.name : "TBD", amt: B.playoff1st },
    { id: "po2", label: "Playoffs — 2nd", detail: B.po2 ? TEAMS[B.po2]?.name : "TBD", amt: B.playoff2nd },
    { id: "po3", label: "Playoffs — 3rd", detail: B.po3 ? TEAMS[B.po3]?.name : "TBD", amt: B.playoff3rd },
    { id: "engraving", label: "Trophy Engraving", detail: "", amt: B.engraving },
    { id: "food", label: "Food", detail: "", amt: B.food },
    { id: "tip", label: "Krysta — Tip", detail: "", amt: B.tip },
  ];
  const totalPayouts = lines.reduce((s, l) => s + (Number(l.amt) || 0), 0);
  const surplus = expectedIncome - totalPayouts;

  return (
    <div style={{ maxWidth: "860px", margin: "0 auto", padding: "22px 14px" }}>
      <div style={{ fontFamily: FD, fontSize: "30px", fontWeight: 600, color: CREAM, marginBottom: "2px" }}>Winnings &amp; Budget</div>
      <div style={{ fontSize: "13px", color: M, marginBottom: "16px" }}>
        Season pot, payouts, and dues tracking. Winners auto-fill from the scores; amounts are editable.
      </div>

      {/* Summary tiles */}
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "16px" }}>
        <Tile label="Pot (dues)" value={money(expectedIncome)} sub={`${paying.length} × ${money(B.duesPerPlayer)}`} color={G} />
        <Tile label="Collected" value={money(collected)} sub={`${paidCount}/${paying.length} paid`} color={collected >= expectedIncome ? G : GO} />
        <Tile label="Payouts" value={money(totalPayouts)} sub={`incl. ${money(potwSpend)} POTW`} color={GOLD} />
        <Tile label={surplus >= 0 ? "Surplus" : "Over budget"} value={money(Math.abs(surplus))} sub={surplus >= 0 ? "pot − payouts" : "payouts exceed pot"} color={surplus >= 0 ? G : R} />
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "16px" }}>
        {[["summary", "Payouts"], ["dues", `Dues (${paidCount}/${paying.length})`], ["potw", "Player of the Week"], ["amounts", "Amounts"]].map(([id, lbl]) => (
          <Chip key={id} on={tab === id} onClick={() => setTab(id)}>{lbl}</Chip>
        ))}
      </div>

      {tab === "summary" && (
        <Card>
          {lines.map((l, i) => (
            <div key={l.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "11px 4px", borderBottom: i < lines.length - 1 ? `1px solid ${GOLD}18` : "none" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "14px", fontWeight: 600, color: CREAM }}>
                  {l.label}
                  {l.auto && <span style={{ marginLeft: "7px", fontSize: "10px", fontWeight: 700, color: G, background: G + "18", padding: "1px 6px", borderRadius: "5px" }}>AUTO</span>}
                </div>
                {l.detail && <div style={{ fontSize: "12px", color: M, marginTop: "1px" }}>{l.detail}</div>}
              </div>
              <div style={{ fontSize: "16px", fontWeight: 700, color: CREAM, minWidth: "70px", textAlign: "right" }}>{money(l.amt)}</div>
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "center", padding: "12px 4px 2px", borderTop: `2px solid ${GOLD}44`, marginTop: "4px" }}>
            <div style={{ flex: 1, fontSize: "14px", fontWeight: 800, color: CREAM }}>Total payouts</div>
            <div style={{ fontSize: "18px", fontWeight: 800, color: GOLD }}>{money(totalPayouts)}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", padding: "6px 4px 0" }}>
            <div style={{ flex: 1, fontSize: "13px", color: M }}>Pot {money(expectedIncome)} − payouts</div>
            <div style={{ fontSize: "16px", fontWeight: 800, color: surplus >= 0 ? G : R }}>{surplus >= 0 ? "+" : "−"}{money(Math.abs(surplus))}</div>
          </div>
          <div style={{ fontSize: "12px", color: M, marginTop: "12px", lineHeight: 1.5 }}>
            Set the playoff placements and any winner overrides in the <b>Amounts</b> tab. Player of the Week is computed from the scores (rainout weeks return {money(potwReturned)} to the pot).
          </div>
        </Card>
      )}

      {tab === "dues" && (
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: "160px" }}>
              <div style={{ height: "8px", borderRadius: "5px", background: GOLD + "22", overflow: "hidden" }}>
                <div style={{ width: `${paying.length ? (paidCount / paying.length) * 100 : 0}%`, height: "100%", background: G }} />
              </div>
            </div>
            <div style={{ fontSize: "13px", color: M }}><b style={{ color: CREAM }}>{paidCount}</b>/{paying.length} paid · {money(collected)} of {money(expectedIncome)}</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: "6px" }}>
            {players.map((p) => {
              const exempt = isExempt(p);
              const paid = !!dues[p.key];
              return (
                <button key={p.key} onClick={() => !exempt && setDue(p.key, !paid)} disabled={exempt}
                  style={{
                    display: "flex", alignItems: "center", gap: "9px", padding: "9px 11px", borderRadius: "9px", textAlign: "left",
                    border: `1px solid ${exempt ? GOLD + "22" : paid ? G + "55" : "rgba(0,0,0,0.12)"}`,
                    background: exempt ? "rgba(0,0,0,0.02)" : paid ? G + "12" : CARD2,
                    cursor: exempt ? "default" : "pointer", fontFamily: FB,
                  }}>
                  <span style={{ width: "18px", height: "18px", borderRadius: "5px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 800,
                    border: `1.5px solid ${exempt ? "#c9c4b4" : paid ? G : "#bbb"}`, background: paid ? G : "transparent", color: paid ? "#fff" : "transparent" }}>
                    {paid ? "✓" : ""}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: "13px", fontWeight: 600, color: CREAM, display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</span>
                    <span style={{ fontSize: "11px", color: M }}>{p.team}</span>
                  </span>
                  {exempt && <span style={{ fontSize: "10px", fontWeight: 700, color: GOLD, background: GOLD + "18", padding: "2px 6px", borderRadius: "5px" }}>EXEMPT</span>}
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {tab === "potw" && (
        <Card>
          <div style={{ fontSize: "12px", color: M, marginBottom: "10px" }}>
            Highest individual points each week wins {money(B.potwPerWeek)} (split on ties). Rainout weeks return to the pot.
          </div>
          {potwRows.map((r) => (
            <div key={r.w} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 2px", borderBottom: `1px solid ${GOLD}14` }}>
              <span style={{ fontSize: "12px", fontWeight: 700, color: M, minWidth: "34px" }}>W{r.w}</span>
              {r.rainout ? (
                <span style={{ flex: 1, fontSize: "13px", color: GO }}>⛈ Rainout — {money(B.potwPerWeek)} back to pot</span>
              ) : r.none ? (
                <span style={{ flex: 1, fontSize: "13px", color: M }}>— no scores yet —</span>
              ) : (
                <>
                  <span style={{ flex: 1, fontSize: "13px", color: CREAM }}>
                    <b>{r.winners.map((w) => w.name).join(", ")}</b>
                    <span style={{ color: M, fontWeight: 400 }}> · {r.pts} pts{r.winners.length > 1 ? ` · split ${r.winners.length} ways` : ""}</span>
                  </span>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: G }}>{money(B.potwPerWeek)}{r.winners.length > 1 ? ` (${money(r.each)} ea)` : ""}</span>
                </>
              )}
            </div>
          ))}
          <div style={{ display: "flex", padding: "12px 2px 0", marginTop: "4px", borderTop: `2px solid ${GOLD}44` }}>
            <div style={{ flex: 1, fontSize: "13px", fontWeight: 800, color: CREAM }}>{potwPaidWeeks} weeks paid</div>
            <div style={{ fontSize: "16px", fontWeight: 800, color: G }}>{money(potwSpend)}</div>
          </div>
        </Card>
      )}

      {tab === "amounts" && (
        <Card>
          <Section title="Payout amounts">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "10px" }}>
              {[
                ["duesPerPlayer", "Dues / player"], ["potwPerWeek", "Player of the Week / wk"],
                ["potyAmount", "Player of the Year"], ["potyTrophy", "POTY trophy"],
                ["regSeason1st", "Regular season 1st"], ["playoff1st", "Playoff 1st"],
                ["playoff2nd", "Playoff 2nd"], ["playoff3rd", "Playoff 3rd"],
                ["engraving", "Engraving"], ["food", "Food"], ["tip", "Krysta tip"],
              ].map(([k, lbl]) => (
                <label key={k} style={{ fontSize: "12px", color: M }}>
                  {lbl}
                  <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "3px" }}>
                    <span style={{ color: M }}>$</span>
                    <input type="number" min="0" value={B[k]} onChange={(e) => setBudget({ [k]: e.target.value === "" ? 0 : Number(e.target.value) })}
                      style={inputStyle} />
                  </div>
                </label>
              ))}
            </div>
          </Section>

          <Section title="Playoff placements">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "10px" }}>
              {[["po1", "1st place"], ["po2", "2nd place"], ["po3", "3rd place"]].map(([k, lbl]) => (
                <label key={k} style={{ fontSize: "12px", color: M }}>
                  {lbl}
                  <select value={B[k] || ""} onChange={(e) => setBudget({ [k]: e.target.value ? Number(e.target.value) : null })} style={{ ...inputStyle, marginTop: "3px", cursor: "pointer" }}>
                    <option value="">— TBD —</option>
                    {Object.keys(TEAMS).map((t) => <option key={t} value={t}>{TEAMS[t]?.name}</option>)}
                  </select>
                </label>
              ))}
            </div>
          </Section>

          <Section title="Winner overrides">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "10px" }}>
              <label style={{ fontSize: "12px", color: M }}>
                Player of the Year {potyAuto && !B.potyWinner && <span style={{ color: G }}>(auto: {playerName(potyAuto)})</span>}
                <select value={B.potyWinner || ""} onChange={(e) => setBudget({ potyWinner: e.target.value || null })} style={{ ...inputStyle, marginTop: "3px", cursor: "pointer" }}>
                  <option value="">Auto (top total points)</option>
                  {players.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
                </select>
              </label>
              <label style={{ fontSize: "12px", color: M }}>
                Regular season 1st {reg1Auto && !B.reg1Winner && <span style={{ color: G }}>(auto: {TEAMS[reg1Auto]?.name})</span>}
                <select value={B.reg1Winner || ""} onChange={(e) => setBudget({ reg1Winner: e.target.value ? Number(e.target.value) : null })} style={{ ...inputStyle, marginTop: "3px", cursor: "pointer" }}>
                  <option value="">Auto (standings leader)</option>
                  {Object.keys(TEAMS).map((t) => <option key={t} value={t}>{TEAMS[t]?.name}</option>)}
                </select>
              </label>
            </div>
          </Section>

          <Section title="Dues-exempt players">
            <div style={{ fontSize: "12px", color: M, marginBottom: "6px" }}>One name per line (must match the roster exactly).</div>
            <textarea value={(B.exempt || []).join("\n")} onChange={(e) => setBudget({ exempt: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
              rows={4} style={{ ...inputStyle, width: "100%", fontFamily: FB, resize: "vertical", boxSizing: "border-box" }} />
          </Section>
        </Card>
      )}
    </div>
  );
}

function Tile({ label, value, sub, color }) {
  return (
    <div style={{ flex: 1, minWidth: "150px", background: CARD2, border: `1px solid ${GOLD}22`, borderRadius: "12px", padding: "12px 14px" }}>
      <div style={{ fontSize: "11px", letterSpacing: "0.06em", textTransform: "uppercase", color: M, fontWeight: 600 }}>{label}</div>
      <div style={{ fontFamily: FD, fontSize: "26px", fontWeight: 700, color, lineHeight: 1.1, marginTop: "2px" }}>{value}</div>
      {sub && <div style={{ fontSize: "11px", color: M, marginTop: "1px" }}>{sub}</div>}
    </div>
  );
}
function Card({ children }) {
  return <div style={{ background: CARD2, border: `1px solid ${GOLD}22`, borderRadius: "14px", padding: "14px 16px" }}>{children}</div>;
}
function Section({ title, children }) {
  return (
    <div style={{ marginBottom: "18px" }}>
      <div style={{ fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: GOLD, fontWeight: 700, marginBottom: "8px" }}>{title}</div>
      {children}
    </div>
  );
}
function Chip({ on, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding: "7px 14px", borderRadius: "20px", fontFamily: FB, fontSize: "13px", fontWeight: on ? 700 : 500, cursor: "pointer",
      border: `1px solid ${on ? G : "rgba(0,0,0,0.12)"}`, background: on ? G + "18" : "transparent", color: on ? G : M,
    }}>{children}</button>
  );
}
const inputStyle = {
  width: "100%", padding: "8px 10px", borderRadius: "8px", border: `1px solid ${GOLD}44`,
  background: "#fff", color: CREAM, fontFamily: FB, fontSize: "14px", outline: "none", boxSizing: "border-box",
};
