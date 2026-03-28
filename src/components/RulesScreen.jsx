import { useState } from "react";
import { CARD, CREAM, G, GO, GOLD, M, FB, FD } from "../constants/theme";

const DEFAULT_RULES = [
  {
    id: "format",
    title: "Format",
    items: [
      "18 teams of 2 players each, playing 9 holes every Wednesday.",
      "Scoring is Modified Stableford: players earn points on each hole based on net score vs par.",
      "Each match pairs two teams against each other. The team with more total stableford points wins.",
      "Match points: Win = 2 pts, Tie = 1 pt each, Loss = 0 pts.",
    ],
  },
  {
    id: "stableford",
    title: "Stableford Points",
    items: [
      "Net Eagle or better = 4 pts",
      "Net Birdie = 3 pts",
      "Net Par = 2 pts",
      "Net Bogey = 1 pt",
      "Net Double Bogey or worse = 0 pts",
      "Maximum gross score per hole = 2× par.",
    ],
  },
  {
    id: "handicaps",
    title: "Handicaps",
    items: [
      "Handicaps are calculated from the 7 best rounds of the season (rolling basis).",
      "Returning players: 90% of net differential, all rounds.",
      "New members: 65% of net differential, no cap on increase.",
      "Handicap cap: returning players cannot increase more than 2 strokes from their starting handicap.",
      "Stroke Index (SI) order: 1, 3, 7, 8, 4, 9, 2, 6, 5.",
      "Low player in a match receives strokes on the appropriate holes per SI.",
    ],
  },
  {
    id: "rainouts",
    title: "Rainouts",
    items: [
      "If weather forces a stoppage, the round is scored on holes played only.",
      "Minimum 5 holes must be completed for the round to count.",
      "Rainout substitution holes: H7→H1, H8→H4, H9→H3.",
      "Cancelled weeks (full washouts) are marked as such and excluded from standings.",
    ],
  },
  {
    id: "subs",
    title: "Substitutes & Phantoms",
    items: [
      "A substitute may play in place of a regular player on any given week.",
      "Substitute scores count for match purposes but not for the regular player's handicap.",
      "If a player has no sub, they receive a Phantom score equal to their current handicap stableford total.",
      "Phantom scores count for match results but not for bonus points or individual standings.",
    ],
  },
  {
    id: "bonus",
    title: "Bonus Points",
    items: [
      "Bonus points are awarded each week once all 9 matches are scored.",
      "Teams are ranked by their total stableford points for the week.",
      "Top 2 score groups: +8 bonus pts each.",
      "Next 2 score groups: +6 bonus pts each.",
      "Next 2 score groups: +4 bonus pts each.",
      "Next 2 score groups: +2 bonus pts each.",
      "Teams with the same stableford total share the same score group (tie handling).",
    ],
  },
  {
    id: "playoffs",
    title: "Playoffs",
    items: [
      "Week 18: Knockdown round — top 8 teams by total points advance.",
      "Knockdown seeding: 1 vs 2, 3 vs 4, 5 vs 6, 7 vs 8.",
      "Week 19: Quarterfinals — 1 vs 8, 2 vs 7, 3 vs 6, 4 vs 5.",
      "Week 20: Semifinals.",
      "Week 21: Championship and 3rd Place matches.",
      "Playoff matches use the final regular-season handicaps.",
    ],
  },
];

function RulesScreen({ rules, saveRules }) {
  const [editing, setEditing] = useState(null); // { sectionId, itemIdx } or { sectionId, titleEdit }
  const [draftText, setDraftText] = useState("");
  const [draftTitle, setDraftTitle] = useState("");

  const sections = rules && rules.length > 0 ? rules : DEFAULT_RULES;

  function startEditItem(sectionId, itemIdx) {
    const section = sections.find(s => s.id === sectionId);
    setDraftText(section.items[itemIdx]);
    setEditing({ sectionId, itemIdx });
  }

  function startEditTitle(sectionId) {
    const section = sections.find(s => s.id === sectionId);
    setDraftTitle(section.title);
    setEditing({ sectionId, titleEdit: true });
  }

  function commitItem() {
    if (!editing) return;
    const { sectionId, itemIdx, titleEdit } = editing;
    const next = sections.map(s => {
      if (s.id !== sectionId) return s;
      if (titleEdit) return { ...s, title: draftTitle };
      const newItems = [...s.items];
      if (draftText.trim() === "") {
        newItems.splice(itemIdx, 1);
      } else {
        newItems[itemIdx] = draftText;
      }
      return { ...s, items: newItems };
    });
    saveRules(next);
    setEditing(null);
  }

  function addItem(sectionId) {
    const next = sections.map(s =>
      s.id === sectionId ? { ...s, items: [...s.items, "New rule"] } : s
    );
    saveRules(next);
    const section = next.find(s => s.id === sectionId);
    setDraftText("New rule");
    setEditing({ sectionId, itemIdx: section.items.length - 1 });
  }

  function addSection() {
    const id = "section-" + Date.now();
    const next = [...sections, { id, title: "New Section", items: ["New rule"] }];
    saveRules(next);
    setDraftTitle("New Section");
    setEditing({ sectionId: id, titleEdit: true });
  }

  function removeSection(sectionId) {
    saveRules(sections.filter(s => s.id !== sectionId));
  }

  function moveSection(sectionId, dir) {
    const idx = sections.findIndex(s => s.id === sectionId);
    if (idx < 0) return;
    const next = [...sections];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    saveRules(next);
  }

  return (
    <div style={{ maxWidth: "780px", margin: "0 auto", padding: "24px 14px" }}>
      <div style={{
        fontFamily: `'Cormorant Garamond','Georgia',serif`,
        fontSize: "28px",
        fontWeight: 600,
        letterSpacing: "0.02em",
        color: CREAM,
        marginBottom: "4px",
      }}>
        League Rules
      </div>
      <div style={{ color: M, fontSize: "13px", marginBottom: "24px" }}>
        Click any rule or section title to edit. Changes save automatically.
      </div>

      <div style={{ display: "grid", gap: "14px" }}>
        {sections.map((section, si) => (
          <div key={section.id} style={{
            background: CARD,
            border: `1px solid rgba(26,61,36,0.08)`,
            borderRadius: "14px",
            overflow: "hidden",
          }}>
            {/* Section header */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px 10px",
              borderBottom: `1px solid rgba(26,61,36,0.07)`,
              background: G + "08",
            }}>
              {editing?.sectionId === section.id && editing?.titleEdit ? (
                <input
                  autoFocus
                  value={draftTitle}
                  onChange={e => setDraftTitle(e.target.value)}
                  onBlur={commitItem}
                  onKeyDown={e => { if (e.key === "Enter") commitItem(); if (e.key === "Escape") setEditing(null); }}
                  style={{
                    flex: 1,
                    fontFamily: FD,
                    fontSize: "16px",
                    fontWeight: 700,
                    color: CREAM,
                    background: "rgba(26,61,36,0.1)",
                    border: `1px solid ${G}55`,
                    borderRadius: "6px",
                    padding: "3px 8px",
                    outline: "none",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                />
              ) : (
                <div
                  onClick={() => startEditTitle(section.id)}
                  title="Click to edit section title"
                  style={{
                    fontFamily: FD,
                    fontSize: "13px",
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: G,
                    cursor: "pointer",
                    flex: 1,
                  }}
                >
                  {section.title}
                </div>
              )}
              <div style={{ display: "flex", gap: "4px", marginLeft: "10px" }}>
                <button
                  onClick={() => moveSection(section.id, -1)}
                  disabled={si === 0}
                  title="Move up"
                  style={iconBtn(si === 0)}
                >↑</button>
                <button
                  onClick={() => moveSection(section.id, 1)}
                  disabled={si === sections.length - 1}
                  title="Move down"
                  style={iconBtn(si === sections.length - 1)}
                >↓</button>
                <button
                  onClick={() => { if (confirm(`Remove section "${section.title}"?`)) removeSection(section.id); }}
                  title="Remove section"
                  style={iconBtn(false, true)}
                >✕</button>
              </div>
            </div>

            {/* Rules list */}
            <div style={{ padding: "6px 0" }}>
              {section.items.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    borderBottom: idx < section.items.length - 1 ? `1px solid rgba(26,61,36,0.05)` : "none",
                  }}
                >
                  {editing?.sectionId === section.id && editing?.itemIdx === idx ? (
                    <div style={{ padding: "6px 16px 8px" }}>
                      <textarea
                        autoFocus
                        value={draftText}
                        onChange={e => setDraftText(e.target.value)}
                        onBlur={commitItem}
                        onKeyDown={e => { if (e.key === "Escape") setEditing(null); }}
                        rows={2}
                        style={{
                          width: "100%",
                          fontFamily: FB,
                          fontSize: "13px",
                          color: CREAM,
                          background: "rgba(26,61,36,0.08)",
                          border: `1px solid ${G}44`,
                          borderRadius: "7px",
                          padding: "7px 10px",
                          outline: "none",
                          resize: "vertical",
                          lineHeight: "1.5",
                        }}
                      />
                      <div style={{ fontSize: "11px", color: M, marginTop: "3px" }}>
                        Click outside or press Esc to save · Leave blank to delete
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => startEditItem(section.id, idx)}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "10px",
                        padding: "9px 16px",
                        cursor: "pointer",
                        transition: "background 0.1s",
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(26,61,36,0.04)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      <span style={{
                        minWidth: "20px",
                        fontSize: "11px",
                        color: GOLD,
                        fontWeight: 700,
                        marginTop: "1px",
                        flexShrink: 0,
                      }}>
                        {idx + 1}.
                      </span>
                      <span style={{ fontSize: "13px", color: CREAM, lineHeight: "1.55", flex: 1 }}>
                        {item}
                      </span>
                      <span style={{ fontSize: "11px", color: M, opacity: 0, transition: "opacity 0.1s" }}
                        className="edit-hint">✎</span>
                    </div>
                  )}
                </div>
              ))}

              {/* Add rule button */}
              <div style={{ padding: "6px 16px 10px" }}>
                <button
                  onClick={() => addItem(section.id)}
                  style={{
                    background: "transparent",
                    border: `1px dashed ${G}44`,
                    borderRadius: "7px",
                    color: G,
                    fontFamily: FB,
                    fontSize: "12px",
                    padding: "4px 12px",
                    cursor: "pointer",
                    letterSpacing: "0.06em",
                  }}
                >
                  + Add rule
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add section */}
      <div style={{ marginTop: "16px", textAlign: "center" }}>
        <button
          onClick={addSection}
          style={{
            background: G + "12",
            border: `1px solid ${G}44`,
            borderRadius: "9px",
            color: G,
            fontFamily: FB,
            fontSize: "13px",
            padding: "8px 20px",
            cursor: "pointer",
            letterSpacing: "0.06em",
          }}
        >
          + Add Section
        </button>
      </div>
    </div>
  );
}

function iconBtn(disabled, danger = false) {
  return {
    background: "transparent",
    border: "none",
    color: disabled ? "rgba(26,61,36,0.2)" : danger ? "#c0392b" : M,
    fontSize: "13px",
    cursor: disabled ? "default" : "pointer",
    padding: "2px 5px",
    borderRadius: "4px",
    lineHeight: 1,
    opacity: disabled ? 0.4 : 1,
  };
}

export default RulesScreen;
