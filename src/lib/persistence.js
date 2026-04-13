function normalizeScores(s) {
  if (Array.isArray(s)) return s;
  if (s && typeof s === "object" && s.p0 !== undefined) return [s.p0 || [], s.p1 || []];
  return [[], []];
}

function normalizeMatch(raw) {
  if (!raw) return raw;
  let rec = raw;
  if (typeof raw === "string") {
    try {
      rec = JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return {
    ...rec,
    t1scores: normalizeScores(rec.t1scores),
    t2scores: normalizeScores(rec.t2scores),
  };
}

function decodeResults(savedResults = {}) {
  const mergedResults = {};
  for (const w of Object.keys(savedResults || {})) {
    if (typeof savedResults[w] !== "object" || savedResults[w] === null) continue;
    mergedResults[w] = {};
    for (const mk of Object.keys(savedResults[w])) {
      mergedResults[w][mk] = normalizeMatch(savedResults[w][mk]);
    }
  }
  return mergedResults;
}

function encodeResults(results = {}) {
  const encodedResults = {};
  for (const w of Object.keys(results || {})) {
    encodedResults[w] = {};
    for (const mk of Object.keys(results[w] || {})) {
      encodedResults[w][mk] = JSON.stringify(results[w][mk]);
    }
  }
  return encodedResults;
}

// Apply a single weekScores subcollection doc into league state
function applyWeekScoreDoc(prevLeague, docData) {
  const week = parseInt(docData.week);
  const mk = docData.matchKey;
  if (!week || !mk) return prevLeague;
  const normalized = normalizeMatch(docData);
  return {
    ...prevLeague,
    results: {
      ...prevLeague.results,
      [week]: { ...(prevLeague.results[week] || {}), [mk]: normalized },
    },
  };
}

// Remove a single match from league state (doc deleted)
function removeWeekScoreDoc(prevLeague, week, mk) {
  if (!week || !mk || !prevLeague.results[week]) return prevLeague;
  const weekResults = { ...prevLeague.results[week] };
  delete weekResults[mk];
  return { ...prevLeague, results: { ...prevLeague.results, [week]: weekResults } };
}

// Safely convert any value to a Set — handles Array, Set, plain object {}, null, undefined
function toSet(x) {
  if (x instanceof Set) return x;
  if (Array.isArray(x)) return new Set(x);
  return new Set(); // {} from JSON.stringify(Set), null, undefined — all become empty Set
}

function applySnapshotToLeague(prevLeague, payload, defaultHcp) {
  const p = payload || {};
  const decoded = decodeResults(p.results || {});
  decoded[1] = decoded[1] || {};

  return {
    ...prevLeague,
    handicaps: { ...(defaultHcp || {}), ...(p.handicaps || {}) },
    results: decoded,
    hcpOverrides: p.hcpOverrides || {},
    loHiOverrides: p.loHiOverrides || {},
    cancelledWeeks: toSet(p.cancelledWeeks),
    readOnlyWeeks: p.readOnlyWeeks || [],
  };
}

export {
  toSet,
  normalizeMatch,
  decodeResults,
  encodeResults,
  applySnapshotToLeague,
  applyWeekScoreDoc,
  removeWeekScoreDoc,
};
