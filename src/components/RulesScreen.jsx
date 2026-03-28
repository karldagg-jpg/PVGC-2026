import { useState } from "react";
import { CARD, CREAM, G, GO, GOLD, M, FB, FD } from "../constants/theme";

const DEFAULT_RULES = [
  {
    id: "general",
    title: "General",
    items: [
      "Vanguard-related work comes first. This is NOT a Vanguard function and no activities associated with this league are related to Vanguard.",
      "18 teams, 2 players per team. Rounds are played on Wednesday evenings; first tee time 4:10 PM.",
      "All returning players start the season with their final round (Round 18) handicap from last season.",
      "There are 18 regular season rounds plus 3 playoff rounds. All rounds canceled due to weather will not be rescheduled.",
      "Week 18 is the Knockdown Round — pairings based on current standings (1v2, 3v4, 5v6, etc.). The Tie Rule is in effect. There is no rain-out round.",
      "A round is considered official if the final team has finished the 6th hole. For H7 use H1 score, H8 use H4 score, H9 use H3 score.",
      "One-time non-refundable membership fee: $60.00/season payable to Krista (Treasurer). All members must be paid in full by Week 10 or the team is ineligible for playoffs.",
      "Green fees (subject to change): Walking $21.00 · Walking with hand cart $23.00 · Riding $30.00.",
      "If you cannot play, it is your responsibility to arrange a substitute. Missing 3 rounds without a substitute = subject to expulsion pending League Commissioner Committee vote.",
      "The top 8 teams make the playoffs.",
      "Only the winning team's last name can be engraved on the league trophy — no substitutes or replacements.",
    ],
  },
  {
    id: "scoring",
    title: "Scoring (Adjusted Stableford)",
    items: [
      "Double Eagle = 5 points",
      "Eagle = 4 points",
      "Birdie = 3 points",
      "Par = 1 point",
      "Bogey = 0 points",
      "Double Bogey = −1 point",
      "Match points: 2 points awarded per head-to-head competition (low handicap vs. low handicap / high handicap vs. high handicap).",
    ],
  },
  {
    id: "bonus",
    title: "Bonus Points",
    items: [
      "Bonus points are awarded each week once all 9 matches are scored, based on total combined Stableford scoring.",
      "Top 2 teams (and ties): +8 bonus pts",
      "Next 2 teams (and ties): +6 bonus pts",
      "Next 2 teams (and ties): +4 bonus pts",
      "Last 2 teams (and ties): +2 bonus pts",
    ],
  },
  {
    id: "handicaps",
    title: "Handicaps",
    items: [
      "The lowest 7 rounds of the entire season are used to calculate handicaps for all members.",
      "Returning players — staggered percentage for first 4 rounds: R1=60%, R2=70%, R3=75%, R4=80%. All rounds from R5 onward: 90%.",
      "Returning players — handicap cannot increase more than 2 strokes from the previous season's final handicap (cap applies until they shoot low enough to come back down).",
      "New members — 60% for the first 7 rounds played, then 90% from Round 8 onward. Starting handicap is set from the calculated (60%) result of their first round.",
      "Substitute player points: 6 Stableford points (flat). Handicaps are not calculated for subs.",
      "Phantom sub plays with a 12 handicap and scores double bogey on every hole = 2 Stableford points. A phantom counts as a strike against the full-time player's membership eligibility.",
      "Handicaps can be negative. The lowest (easiest) holes will reduce par to allow for a negative handicap.",
      "Playoff subs must use their standard full-time league player handicap. No deduction of points.",
      "Stroke Index (SI) order: 1, 3, 7, 8, 4, 9, 2, 6, 5.",
    ],
  },
  {
    id: "poty",
    title: "Player of the Year",
    items: [
      "WEEKLY: Highest individual point-getter for the week receives a cash payout. Ties split the payout equally.",
      "YEARLY: Highest individual point-getter for the entire season is crowned Player of the Year.",
      "Yearly calculation: throw out the 3 lowest scores, then sum the rest.",
      "If a sub or phantom score is not one of the low 3, that point total is included. If a player has a sub for 5 weeks, the sub total counts twice.",
      "Cash payouts (weekly and yearly) are determined based on league membership count.",
    ],
  },
  {
    id: "teetimes",
    title: "Tee Times",
    items: [
      "Tee times are assigned to each group weekly. First tee time: 4:10 PM.",
      "No guaranteed tee times are accepted throughout the year.",
      "All tee times and matches are distributed at the beginning of the season as part of the schedule.",
      "All teams must play in their scheduled time slots unless approved by commissioners.",
      "If a player must make up holes, the opposing player can replay the hole or keep their original score — if replayed, that score is final.",
      "Any round not played on Wednesday night must be played with a member of the opposite team so the round is attested by the opponent.",
    ],
  },
  {
    id: "eligibility",
    title: "Eligibility",
    items: [
      "All membership and substitute eligibility is voted on by the Rules Committee. All decisions are final.",
      "Playoff eligibility: all members must play at least 66% of the regular season (calculation rounded up). Failure = team is ineligible for playoffs.",
      "Playoff matches are expected to be played as scheduled. Unplanned rescheduling requires Rules Committee approval within 24 hours. Rescheduled matches must be completed before the next scheduled playoff round.",
      "Playoff subs must be a fully paid regular league member who did not qualify for playoffs but met the 66% eligibility requirement. Sub uses their league handicap — no deduction, no max points.",
      "Teams choosing not to use a playoff sub will use the phantom sub rules as in the regular season.",
      "League membership is subject to committee review each year.",
    ],
  },
  {
    id: "playoffs",
    title: "Playoffs",
    items: [
      "Playoff seed is based on finish in the regular season (includes Week 18 Knockdown Round).",
      "Round 1 (Quarterfinals): 1v8, 2v7, 3v6, 4v5.",
      "Round 2 (Semifinals): highest remaining seed vs. lowest remaining seed.",
      "Finals: Championship match + 3rd Place match. League party follows.",
      "All playoff ties: sudden death starting at Hole 1.",
    ],
  },
  {
    id: "tiebreakers",
    title: "Regular Season Tie Breakers",
    items: [
      "Tie breaker 1: Head-to-head match result from the season. If tied or teams didn't play each other, proceed to TB2.",
      "Tie breaker 2: Pull the scorecard from each team's match against the 1st-place team (follow down the standings to find a common playoff-qualified opponent). Highest total points from that match (excluding bonus) wins the spot.",
      "If still tied: random pick.",
      "Two teams tied for 8th seed: 3-hole match play. If still tied: sudden death. If still tied: coin toss.",
      "Three teams tied for 8th: apply tie-breaker order — top team gets a bye while other two play sudden death; winner plays the bye team sudden death.",
      "Three teams tied for 7th: apply tie-breaker order — top team is seeded 7th; remaining two play a 3-hole match play for 8th.",
      "The Rules Committee/Commissioners will make fair and unbiased determinations for scenarios not covered above.",
    ],
  },
  {
    id: "disputes",
    title: "Disputes",
    items: [
      "All disputes must be logged within 24 hours to Chris Coyne, Jack Carickhoff, and Brian Charles.",
      "The Rules Committee's decisions are final.",
      "All other situations not covered by these rules follow USGA rules and interpretations.",
    ],
  },
  {
    id: "courserules",
    title: "Course Rules — Hole by Hole",
    items: [
      "Hole #1: Drives landing right of the tree line bordering the driving range are out of bounds (safety rule). Penalized one stroke, play from the spot where the ball crosses the tree line.",
      "Hole #2: Tee shot landing inside the tree line on the right side is in play. If the ball is lost, stroke and drop apply — no closer to the hole.",
      "Hole #5: Drives going into the road from the tee are out of bounds. Stroke and drop, no closer to hole. Ball must be dropped on the right side of the trees.",
      "Hole #8: Ball ending in the second water hazard — drop area is between the ponds. No cutting the corner from the tee (tee shot left of the second pond, closer to the hole) = 2-stroke penalty. If without question the ball entered the pond from the fairway, play along the line of entry with a 1-stroke penalty.",
    ],
  },
  {
    id: "generalcourse",
    title: "Course Rules — General",
    items: [
      "Lost balls (not otherwise specified): 1-stroke penalty, continue from approximate location where ball was lost.",
      "Balls hit into the woods may be played out of the woods with no penalty. Alternatively, play from the point of entry into the woods with a 1-stroke penalty (e.g., Hole #12 hook into the woods).",
      "Tee box rule: if you tee off from a tee box (white or gold), you cannot move up to an easier tee box during the season. You are allowed to move back if necessary.",
      "Sand trap: you may rake the area underneath your ball and replace it in the same spot. You cannot move the ball to a new location. If the ball is in water in the trap, you may move it to a new location within the trap, no closer to the hole.",
      "Wet conditions / rain: you have the option to lift, clean, and replace your ball.",
      "Search time: players have a full 3 minutes to identify their ball. The opposing team may start a timer and instruct a drop after 3 minutes have expired.",
      "If you tee off in certain tee box (white or gold), you can't move up to another tee-box. You are allowed to move back if necessary.",
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div style={{ color: M, fontSize: "13px" }}>
          Click any rule or section title to edit. Changes save automatically.
        </div>
        <button
          onClick={() => { if (confirm("Reset all rules to the official 2025 rulebook?")) saveRules(DEFAULT_RULES); }}
          style={{
            background: "transparent",
            border: `1px solid ${GOLD}44`,
            borderRadius: "7px",
            color: M,
            fontFamily: FB,
            fontSize: "12px",
            padding: "4px 10px",
            cursor: "pointer",
            whiteSpace: "nowrap",
            marginLeft: "12px",
          }}
        >
          ↺ Reset to defaults
        </button>
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
