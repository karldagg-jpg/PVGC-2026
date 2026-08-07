import { useState, useMemo } from "react";
import { TEAMS } from "../constants/league";
import { weeklyHighScorers } from "../lib/leagueLogic";
import { G, GO, R, M, CREAM, GOLD, CARD2, FB, FD } from "../constants/theme";

// 2026 defaults (editable in the Amounts tab; persisted in league.budget).
const DEFAULT_BUDGET = {
  duesPerPlayer: 60, potwPerWeek: 20, potyAmount: 50, potyTrophy: 85,
  regSeason1st: 200, playoff1st: 500, playoff2nd: 200, playoff3rd: 100,
  engraving: 50, food: 300, tip: 200,
  exempt: ["Brian Charles", "Jack Carickhoff", "Karl Dagg"],
  potyWinner: null, reg1Winner: null, po1: null, po2: null, po3: null,
};

const money = (n) => `$${(Math.round((Number(n) || 0) * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const pname = (key) => { const [t, pi] = String(key).split("-").map(Number); return TEAMS[t]?.[pi === 0 ? "p1" : "p2"] || key; };

export default function BudgetScreen({ league, saveLeague, teamStandings, potyList }) {
  const B = { ...DEFAULT_BUDGET, ...(league.budget || {}) };
  const dues = league.dues || {};
  const [tab, setTab] = useState("ledger");
  const [potwView, setPotwView] = useState("player");
  const [duesFilter, setDuesFilter] = useState("all");

  const setBudget = (patch) => saveLeague({ ...league, budget: { ...B, ...patch } });
  const setDue = (key, paid) => saveLeague({ ...league, dues: { ...dues, [key]: paid } });

  // Roster + dues
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
  const pot = paying.length * B.duesPerPlayer;
  const collected = paidCount * B.duesPerPlayer;
  const duesPct = paying.length ? (paidCount / paying.length) * 100 : 0;

  // Player of the Week (weeks 1–18; rainouts return to pot)
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
    potwRows.push({ w, pts: r.pts, each: B.potwPerWeek / r.winners.length,
      winners: r.winners.map((x) => ({ key: `${x.tid}-${x.pi}`, name: TEAMS[x.tid]?.[x.pi === 0 ? "p1" : "p2"] || "" })) });
  }
  const potwSpend = potwPaidWeeks * B.potwPerWeek;
  const potwByPlayer = (() => {
    const agg = {};
    for (const r of potwRows) if (r.winners) for (const w of r.winners) {
      const a = (agg[w.key] ||= { key: w.key, name: w.name, weeks: [], total: 0 });
      a.weeks.push(r.w); a.total += r.each;
    }
    return Object.values(agg).sort((a, b) => b.total - a.total || b.weeks.length - a.weeks.length);
  })();

  // Season winners (auto with override)
  const potyAuto = potyList?.[0] ? `${potyList[0].tid}-${potyList[0].pi}` : null;
  const potyWinner = B.potyWinner || potyAuto;
  const reg1Auto = teamStandings?.[0]?.id ?? null;
  const reg1 = B.reg1Winner ?? reg1Auto;

  // Ledger, grouped
  const prizeLines = [
    { label: "Player of the Week", detail: `${potwPaidWeeks} wks · ${money(B.potwPerWeek)}/wk`, amt: potwSpend, auto: true },
    { label: "Player of the Year", detail: potyWinner ? pname(potyWinner) : "—", amt: B.potyAmount, auto: !B.potyWinner && !!potyAuto },
    { label: "Regular Season 1st", detail: reg1 ? TEAMS[reg1]?.name : "—", amt: B.regSeason1st, auto: !B.reg1Winner && reg1Auto != null },
    { label: "Playoffs — 1st", detail: B.po1 ? TEAMS[B.po1]?.name : "TBD", amt: B.playoff1st },
    { label: "Playoffs — 2nd", detail: B.po2 ? TEAMS[B.po2]?.name : "TBD", amt: B.playoff2nd },
    { label: "Playoffs — 3rd", detail: B.po3 ? TEAMS[B.po3]?.name : "TBD", amt: B.playoff3rd },
  ];
  const clubLines = [
    { label: "POTY Trophy", detail: "", amt: B.potyTrophy },
    { label: "Trophy Engraving", detail: "", amt: B.engraving },
    { label: "Food", detail: "", amt: B.food },
    { label: "Krysta — Tip", detail: "", amt: B.tip },
  ];
  const prizeTotal = prizeLines.reduce((s, l) => s + (+l.amt || 0), 0);
  const clubTotal = clubLines.reduce((s, l) => s + (+l.amt || 0), 0);
  const totalPayouts = prizeTotal + clubTotal;
  const surplus = pot - totalPayouts;
  const usedPct = pot > 0 ? Math.min(100, (totalPayouts / pot) * 100) : 0;

  // Projected end-of-season: assume every remaining (non-rainout) week pays POTW.
  const rainoutWeeks = potwRows.filter((r) => r.rainout).length;
  const projPotwWeeks = 18 - rainoutWeeks;
  const weeksRemaining = Math.max(0, projPotwWeeks - potwPaidWeeks);
  const projPayouts = totalPayouts - potwSpend + projPotwWeeks * B.potwPerWeek;
  const projSurplus = pot - projPayouts;

  const shownDues = duesFilter === "unpaid" ? players.filter((p) => !isExempt(p) && !dues[p.key]) : players;

  return (
    <div style={{ maxWidth: "820px", margin: "0 auto", padding: "22px 14px 40px" }}>
      <div style={{ fontFamily: FD, fontSize: "32px", fontWeight: 600, color: CREAM, letterSpacing: "0.01em" }}>Winnings &amp; Budget</div>
      <div style={{ fontSize: "13px", color: M, marginBottom: "18px" }}>2026 season pot, payouts & dues · winners auto-fill from the scores</div>

      {/* ── Hero: the pot ─────────────────────────────────────────── */}
      <div style={{ background: CARD2, border: `1px solid ${GOLD}33`, borderRadius: "16px", overflow: "hidden", marginBottom: "18px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
          <Cell label="The Pot" value={money(pot)} sub={`${paying.length} × ${money(B.duesPerPlayer)}`} big />
          <Cell label="Collected" value={money(collected)} sub={`${paidCount} / ${paying.length} paid`} color={collected >= pot ? G : GO} />
          <Cell label="Payouts" value={money(totalPayouts)} sub={`${money(potwSpend)} POTW`} color={GOLD} />
          <Cell label={surplus >= 0 ? "Cushion" : "Over budget"} value={`${surplus < 0 ? "−" : ""}${money(Math.abs(surplus))}`} sub={surplus >= 0 ? "pot − payouts" : "payouts exceed pot"} color={surplus >= 0 ? G : R} last />
        </div>
        {/* Pot-usage meter */}
        <div style={{ padding: "4px 18px 16px" }}>
          <div style={{ display: "flex", height: "12px", borderRadius: "7px", overflow: "hidden", background: G + "18", gap: "2px" }}>
            <div style={{ width: `${usedPct}%`, background: surplus < 0 ? R : GOLD, transition: "width .3s" }} title={`Committed ${money(totalPayouts)}`} />
            {surplus > 0 && <div style={{ flex: 1, background: G, opacity: 0.55 }} title={`Cushion ${money(surplus)}`} />}
          </div>
          <div style={{ display: "flex", gap: "16px", marginTop: "7px", fontSize: "11.5px", color: M, flexWrap: "wrap" }}>
            <Legend color={surplus < 0 ? R : GOLD} text={`Committed ${money(totalPayouts)} (${Math.round(usedPct)}%)`} />
            {surplus >= 0
              ? <Legend color={G} text={`Cushion ${money(surplus)}`} dim />
              : <span style={{ color: R, fontWeight: 700 }}>Over the pot by {money(-surplus)}</span>}
          </div>
        </div>
      </div>

      {/* ── Sub-nav ───────────────────────────────────────────────── */}
      <SegNav value={tab} onChange={setTab} items={[["ledger", "Ledger"], ["dues", "Dues"], ["potw", "Weekly"], ["amounts", "Amounts"]]} />

      {tab === "ledger" && (
        <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "1fr" }}>
          <Panel title="Player prizes" total={prizeTotal}>
            {prizeLines.map((l, i) => <LedgerRow key={i} {...l} last={i === prizeLines.length - 1} />)}
          </Panel>
          <Panel title="Club expenses" total={clubTotal}>
            {clubLines.map((l, i) => <LedgerRow key={i} {...l} last={i === clubLines.length - 1} />)}
          </Panel>
          <div style={{ background: CREAM, borderRadius: "14px", padding: "14px 18px", color: "#f0ece0" }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: "14px", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: "11px", opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.06em" }}>{surplus >= 0 ? "Cushion now" : "Over now"}</div>
                <div style={{ fontFamily: FD, fontSize: "30px", fontWeight: 700, lineHeight: 1, color: surplus >= 0 ? "#8fd6a6" : "#f0a5a5" }}>{surplus < 0 ? "−" : "+"}{money(Math.abs(surplus))}</div>
                <div style={{ fontSize: "11px", opacity: 0.6, marginTop: "2px" }}>{potwPaidWeeks} of {projPotwWeeks} POTW weeks paid</div>
              </div>
              {weeksRemaining > 0 && (
                <div style={{ marginLeft: "auto", textAlign: "right", paddingLeft: "14px", borderLeft: "1px solid rgba(240,236,224,0.18)" }}>
                  <div style={{ fontSize: "11px", opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.06em" }}>Projected · {weeksRemaining} wk{weeksRemaining > 1 ? "s" : ""} left, no rainouts</div>
                  <div style={{ fontFamily: FD, fontSize: "30px", fontWeight: 700, lineHeight: 1, color: projSurplus >= 0 ? "#8fd6a6" : "#f0a5a5" }}>{projSurplus < 0 ? "−" : "+"}{money(Math.abs(projSurplus))}</div>
                  <div style={{ fontSize: "11px", opacity: 0.6, marginTop: "2px" }}>if the last {weeksRemaining} pay out</div>
                </div>
              )}
            </div>
          </div>
          <div style={{ fontSize: "11.5px", color: M, lineHeight: 1.5, padding: "0 2px" }}>
            <b>AUTO</b> lines fill from the season data. Set playoff placements and any overrides in <b>Amounts</b>. Rainout weeks returned {money(potwReturned)} to the pot.
            {weeksRemaining > 0 && <> Projection assumes the last {weeksRemaining} POTW week{weeksRemaining > 1 ? "s" : ""} all pay ({money(B.potwPerWeek)} each).</>}
          </div>
        </div>
      )}

      {tab === "dues" && (
        <Panel>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "12px" }}>
            <div style={{ flex: 1, minWidth: "150px" }}>
              <div style={{ height: "9px", borderRadius: "6px", background: GOLD + "22", overflow: "hidden" }}>
                <div style={{ width: `${duesPct}%`, height: "100%", background: G, transition: "width .3s" }} />
              </div>
            </div>
            <div style={{ fontSize: "13px", color: M }}><b style={{ color: CREAM }}>{paidCount}</b>/{paying.length} paid · {money(collected)} of {money(pot)}</div>
            <SegNav small value={duesFilter} onChange={setDuesFilter} items={[["all", "All"], ["unpaid", `Unpaid (${paying.length - paidCount})`]]} />
          </div>
          {shownDues.length === 0 ? (
            <div style={{ fontSize: "13px", color: G, fontWeight: 600, padding: "16px 2px" }}>✓ Everyone's paid up.</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "5px" }}>
              {shownDues.map((p) => {
                const exempt = isExempt(p), paid = !!dues[p.key];
                return (
                  <button key={p.key} onClick={() => !exempt && setDue(p.key, !paid)} disabled={exempt}
                    style={{
                      display: "flex", alignItems: "center", gap: "9px", padding: "8px 10px", borderRadius: "9px", textAlign: "left", fontFamily: FB,
                      border: `1px solid ${exempt ? GOLD + "22" : paid ? G + "44" : "rgba(0,0,0,0.10)"}`,
                      background: exempt ? "rgba(0,0,0,0.02)" : paid ? G + "10" : "#fff",
                      cursor: exempt ? "default" : "pointer",
                    }}>
                    <span style={{ width: "17px", height: "17px", borderRadius: "5px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 800,
                      border: `1.5px solid ${exempt ? "#c9c4b4" : paid ? G : "#c0c0b4"}`, background: paid ? G : "transparent", color: "#fff" }}>
                      {paid ? "✓" : ""}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: "13px", fontWeight: 600, color: exempt ? M : CREAM, display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</span>
                      <span style={{ fontSize: "10.5px", color: M }}>{p.team}</span>
                    </span>
                    {exempt && <span style={{ fontSize: "9.5px", fontWeight: 700, color: GOLD, background: GOLD + "18", padding: "2px 6px", borderRadius: "5px" }}>EXEMPT</span>}
                  </button>
                );
              })}
            </div>
          )}
        </Panel>
      )}

      {tab === "potw" && (
        <Panel>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px", flexWrap: "wrap" }}>
            <SegNav small value={potwView} onChange={setPotwView} items={[["player", "By player"], ["week", "By week"]]} />
            <div style={{ marginLeft: "auto", fontSize: "12px", color: M }}>
              {money(B.potwPerWeek)}/wk · {potwPaidWeeks} paid = <b style={{ color: G }}>{money(potwSpend)}</b>
            </div>
          </div>
          {potwView === "player" ? (
            potwByPlayer.length === 0 ? <div style={{ fontSize: "13px", color: M, padding: "8px 2px" }}>No winners yet.</div>
            : potwByPlayer.map((p, i) => (
              <div key={p.key} style={{ display: "flex", alignItems: "center", gap: "11px", padding: "10px 2px", borderBottom: i < potwByPlayer.length - 1 ? `1px solid ${GOLD}14` : "none" }}>
                <span style={{ fontFamily: FD, fontSize: "16px", fontWeight: 700, color: i === 0 ? GO : M, minWidth: "22px", textAlign: "center" }}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: CREAM }}>{p.name}</div>
                  <div style={{ fontSize: "11px", color: M }}>{p.weeks.length} win{p.weeks.length > 1 ? "s" : ""} · W{p.weeks.join(", W")}</div>
                </div>
                <span style={{ fontFamily: FD, fontSize: "19px", fontWeight: 700, color: G }}>{money(p.total)}</span>
              </div>
            ))
          ) : (
            potwRows.map((r) => (
              <div key={r.w} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 2px", borderBottom: `1px solid ${GOLD}12` }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: M, minWidth: "32px" }}>W{r.w}</span>
                {r.rainout ? <span style={{ flex: 1, fontSize: "13px", color: GO }}>⛈ Rainout — {money(B.potwPerWeek)} to pot</span>
                : r.none ? <span style={{ flex: 1, fontSize: "13px", color: M }}>— no scores —</span>
                : <>
                    <span style={{ flex: 1, fontSize: "13px", color: CREAM }}><b>{r.winners.map((w) => w.name).join(", ")}</b><span style={{ color: M, fontWeight: 400 }}> · {r.pts} pts{r.winners.length > 1 ? ` · split ${r.winners.length}` : ""}</span></span>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: G }}>{money(B.potwPerWeek)}{r.winners.length > 1 ? ` (${money(r.each)} ea)` : ""}</span>
                  </>}
              </div>
            ))
          )}
        </Panel>
      )}

      {tab === "amounts" && (
        <Panel>
          <Group title="Payout amounts">
            <Grid>
              {[["duesPerPlayer", "Dues / player"], ["potwPerWeek", "POTW / week"], ["potyAmount", "Player of the Year"], ["potyTrophy", "POTY trophy"],
                ["regSeason1st", "Regular season 1st"], ["playoff1st", "Playoff 1st"], ["playoff2nd", "Playoff 2nd"], ["playoff3rd", "Playoff 3rd"],
                ["engraving", "Engraving"], ["food", "Food"], ["tip", "Krysta tip"]].map(([k, lbl]) => (
                <label key={k} style={lblStyle}>{lbl}
                  <div style={{ display: "flex", alignItems: "center", gap: "3px", marginTop: "3px" }}>
                    <span style={{ color: M }}>$</span>
                    <input type="number" min="0" value={B[k]} onChange={(e) => setBudget({ [k]: e.target.value === "" ? 0 : Number(e.target.value) })} style={inputStyle} />
                  </div>
                </label>
              ))}
            </Grid>
          </Group>
          <Group title="Playoff placements">
            <Grid>
              {[["po1", "1st place"], ["po2", "2nd place"], ["po3", "3rd place"]].map(([k, lbl]) => (
                <label key={k} style={lblStyle}>{lbl}
                  <select value={B[k] || ""} onChange={(e) => setBudget({ [k]: e.target.value ? Number(e.target.value) : null })} style={{ ...inputStyle, marginTop: "3px", cursor: "pointer" }}>
                    <option value="">— TBD —</option>
                    {Object.keys(TEAMS).map((t) => <option key={t} value={t}>{TEAMS[t]?.name}</option>)}
                  </select>
                </label>
              ))}
            </Grid>
          </Group>
          <Group title="Winner overrides">
            <Grid>
              <label style={lblStyle}>Player of the Year {potyAuto && !B.potyWinner && <span style={{ color: G }}>· auto {pname(potyAuto)}</span>}
                <select value={B.potyWinner || ""} onChange={(e) => setBudget({ potyWinner: e.target.value || null })} style={{ ...inputStyle, marginTop: "3px", cursor: "pointer" }}>
                  <option value="">Auto (top points)</option>
                  {players.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
                </select>
              </label>
              <label style={lblStyle}>Regular season 1st {reg1Auto && !B.reg1Winner && <span style={{ color: G }}>· auto {TEAMS[reg1Auto]?.name}</span>}
                <select value={B.reg1Winner || ""} onChange={(e) => setBudget({ reg1Winner: e.target.value ? Number(e.target.value) : null })} style={{ ...inputStyle, marginTop: "3px", cursor: "pointer" }}>
                  <option value="">Auto (standings leader)</option>
                  {Object.keys(TEAMS).map((t) => <option key={t} value={t}>{TEAMS[t]?.name}</option>)}
                </select>
              </label>
            </Grid>
          </Group>
          <Group title="Dues-exempt players">
            <div style={{ fontSize: "11.5px", color: M, marginBottom: "6px" }}>One name per line, matching the roster exactly.</div>
            <textarea value={(B.exempt || []).join("\n")} onChange={(e) => setBudget({ exempt: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
              rows={4} style={{ ...inputStyle, width: "100%", fontFamily: FB, resize: "vertical" }} />
          </Group>
        </Panel>
      )}
    </div>
  );
}

// ── pieces ──────────────────────────────────────────────────────────────────
function Cell({ label, value, sub, color = CREAM, big, last }) {
  return (
    <div style={{ padding: "14px 18px", borderRight: last ? "none" : `1px solid ${GOLD}18` }}>
      <div style={{ fontSize: "10.5px", letterSpacing: "0.07em", textTransform: "uppercase", color: M, fontWeight: 600 }}>{label}</div>
      <div style={{ fontFamily: FD, fontSize: big ? "34px" : "26px", fontWeight: 700, color, lineHeight: 1.05, marginTop: "3px" }}>{value}</div>
      {sub && <div style={{ fontSize: "11px", color: M, marginTop: "2px" }}>{sub}</div>}
    </div>
  );
}
function Legend({ color, text, dim }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
    <span style={{ width: "9px", height: "9px", borderRadius: "3px", background: color, opacity: dim ? 0.55 : 1 }} />{text}
  </span>;
}
function Panel({ title, total, children }) {
  return (
    <div style={{ background: CARD2, border: `1px solid ${GOLD}22`, borderRadius: "14px", padding: "14px 16px" }}>
      {title && (
        <div style={{ display: "flex", alignItems: "baseline", marginBottom: "6px" }}>
          <span style={{ fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: GOLD, fontWeight: 700 }}>{title}</span>
          {total != null && <span style={{ marginLeft: "auto", fontFamily: FD, fontSize: "18px", fontWeight: 700, color: CREAM }}>{money(total)}</span>}
        </div>
      )}
      {children}
    </div>
  );
}
function LedgerRow({ label, detail, amt, auto, last }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 2px", borderBottom: last ? "none" : `1px solid ${GOLD}12` }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: "13.5px", fontWeight: 600, color: CREAM }}>
          {label}
          {auto && <span style={{ marginLeft: "7px", fontSize: "9px", fontWeight: 800, color: G, background: G + "18", padding: "1px 5px", borderRadius: "4px", letterSpacing: "0.04em" }}>AUTO</span>}
        </div>
        {detail && <div style={{ fontSize: "11.5px", color: M, marginTop: "1px" }}>{detail}</div>}
      </div>
      <div style={{ fontSize: "15px", fontWeight: 700, color: CREAM, fontVariantNumeric: "tabular-nums" }}>{money(amt)}</div>
    </div>
  );
}
function SegNav({ value, onChange, items, small }) {
  return (
    <div style={{ display: "inline-flex", border: `1px solid ${GOLD}33`, borderRadius: "9px", overflow: "hidden", marginBottom: small ? 0 : "16px" }}>
      {items.map(([id, lbl]) => (
        <button key={id} onClick={() => onChange(id)} style={{
          padding: small ? "6px 12px" : "8px 16px", border: "none", cursor: "pointer", fontFamily: FB,
          fontSize: small ? "12px" : "13px", fontWeight: value === id ? 700 : 500,
          background: value === id ? G : "transparent", color: value === id ? "#fff" : M,
        }}>{lbl}</button>
      ))}
    </div>
  );
}
function Group({ title, children }) {
  return <div style={{ marginBottom: "18px" }}>
    <div style={{ fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: GOLD, fontWeight: 700, marginBottom: "8px" }}>{title}</div>
    {children}
  </div>;
}
const Grid = ({ children }) => <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: "10px" }}>{children}</div>;
const lblStyle = { fontSize: "12px", color: M, display: "block" };
const inputStyle = { width: "100%", padding: "8px 10px", borderRadius: "8px", border: `1px solid ${GOLD}44`, background: "#fff", color: CREAM, fontFamily: FB, fontSize: "14px", outline: "none", boxSizing: "border-box" };
