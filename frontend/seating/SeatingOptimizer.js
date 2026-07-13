// SeatingOptimizer.js - Seating optimizer with two objectives
//
// Fills the empty (active) seats of a layout with unseated students. It supports
// two objectives, selected by config.objective:
//
// "optimize" (default) -- Least-repeat-pairings. Minimizes the number of
// "repeat pairings" (pairs at the same table who already sat together in a
// completed period). Objective, compared lexicographically:
//   H  count of co-seated pairs that have sat together before
//   M  among repeat pairs, prior co-seatings beyond the first (capped) --
//      when repeats are unavoidable, prefer the least-repeated pairs
//   S  soft rating score: -1 (Avoid) discouraged, +1/+2 (Good/Best) rewarded
//   B  table-size balance (squared deviation from balanced targets)
//
// "choice" -- Student-choice-honoring fill (GH issue #24). Seats students so
// that as many MUTUAL partner requests (pairs whose merged rating is +2) as
// possible end up at the same table. Partnership history is IGNORED ENTIRELY
// (repeats are desirable, not penalized) -- this is the seasonal counterpart to
// optimize: teachers use optimize early in the year to force novel pairings,
// then switch to choice later once students know who they work well with.
// Objective, compared lexicographically:
//   H  count of UNSATISFIED mutual (+2) requests (both placed, not same table)
//   M  unused (always 0)
//   S  soft rating score, same as optimize (-1 penalized, +1/+2 rewarded)
//   B  table-size balance
//
// Hard constraints, enforced by construction and never merely penalized (IDENTICAL
// in both modes):
//   - locked students (everyone already seated when optimize is called) never move
//   - pairs rated -2 (Never Together) never share a table
//   - deactivated seats are never filled
// Infeasibility is reported ({ok: false, ...}); a violating chart is never returned.
//
// Search: multi-restart randomized greedy construction followed by
// steepest-descent local search (cross-table swaps and relocations) over table
// GROUPS -- seat positions within a table don't affect the objective, so seats
// are materialized once at the end (locked students keep their exact seats).
// The construction/local-search/materialization machinery is SHARED by both
// objectives; only the per-pair tier weights and a choice-mode +2-pair seeding
// step differ.

const OPTIMIZER_DEFAULTS = {
  // "optimize" (least repeat pairings, history-aware) or "choice" (honor mutual
  // +2 requests, history ignored). See the header comment.
  objective: "optimize",
  // If true, a +2 (Best) rating exempts a pair from the repeat count H.
  // Default false: ratings are preferences; pre-seating a pair is the
  // teacher's absolute override for "keep them together anyway".
  allowBestPairRepeats: false,
  multiplicityCap: 10, // per-pair cap on the M tier contribution
  ratingScore: { "-1": 40, 1: -25, 2: -60 }, // S tier (lower = better)
  maxRestarts: 400,
  polishRestarts: 30, // extra restarts after a 0-repeat chart is found (improves S)
  timeBudgetMs: 400,
  maxLocalSearchPasses: 60,
  seed: null, // integer for reproducible output; null = random each call
};

// Small deterministic PRNG so a seed reproduces the exact same chart
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function nowMs() {
  return typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
}

class SeatingOptimizer {
  constructor(config = {}) {
    this.config = Object.assign({}, OPTIMIZER_DEFAULTS, config);
  }

  /**
   * @param {Object} assignments - current chart {tableId: {seatNumber: studentId}}
   *   (string keys, editor shape). Every student in it is treated as locked.
   * @param {Array} students - student objects ({id, first_name, last_name,
   *   nickname, ...}) to seat: both the locked ones and the pool.
   * @param {Object} layout - classroom layout with tables[].seats[].seat_number
   * @param {Object} constraints - {
   *     partnershipHistory,  // {studentId: {partnerships: {partnerId: [dates...]}}}
   *     partnershipRatings,  // {grid: {studentId: {ratings: {otherId: -2..2}}}}
   *     deactivatedSeats,    // Set or array of "tableId-seatNumber" strings
   *     lockedSeats,         // optional override, same shape as assignments
   *   }
   * @returns {ok: true, assignments, stats} or {ok: false, error, conflicts?, unplaced?}
   */
  optimize(assignments, students, layout, constraints = {}) {
    const cfg = this.config;
    const start = nowMs();

    const history = constraints.partnershipHistory || {};
    const grid = (constraints.partnershipRatings && constraints.partnershipRatings.grid) || {};
    const deactivated = new Set(constraints.deactivatedSeats || []);
    const lockedChart = constraints.lockedSeats || assignments || {};

    if (!layout || !layout.tables || layout.tables.length === 0) {
      return { ok: false, error: "No layout with tables was provided." };
    }

    // ---- Index students -------------------------------------------------
    const lockedIds = new Set();
    Object.values(lockedChart).forEach((seatMap) => {
      Object.values(seatMap || {}).forEach((sid) => lockedIds.add(Number(sid)));
    });

    const ids = [];
    const idx = new Map(); // studentId -> 0..n-1
    const nameOf = new Map();
    students.forEach((s) => {
      if (!idx.has(s.id)) {
        idx.set(s.id, ids.length);
        ids.push(s.id);
        const nick = s.nickname || s.first_name || "";
        nameOf.set(s.id, `${nick} ${s.last_name || ""}`.trim() || `Student ${s.id}`);
      }
    });
    // Seated students missing from the students array still occupy seats
    lockedIds.forEach((sid) => {
      if (!idx.has(sid)) {
        idx.set(sid, ids.length);
        ids.push(sid);
        nameOf.set(sid, `Student ${sid}`);
      }
    });
    const n = ids.length;
    if (n === 0) return { ok: false, error: "No students to seat." };

    // ---- Pair matrices ---------------------------------------------------
    // Backend shapes: partnerships values are ARRAYS OF DATE STRINGS (count =
    // length); the ratings grid is symmetric, but read both directions anyway.
    const pairCount = new Int32Array(n * n);
    const pairRating = new Int8Array(n * n);
    const forb = new Uint8Array(n * n);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = String(ids[i]);
        const b = String(ids[j]);
        const dates =
          (history[a] && history[a].partnerships && history[a].partnerships[b]) ||
          (history[b] && history[b].partnerships && history[b].partnerships[a]);
        const c = Array.isArray(dates) ? dates.length : 0;
        let r = grid[a] && grid[a].ratings ? grid[a].ratings[b] : undefined;
        if (r === undefined) r = grid[b] && grid[b].ratings ? grid[b].ratings[a] : undefined;
        if (r === undefined) r = 0;
        pairCount[i * n + j] = pairCount[j * n + i] = c;
        pairRating[i * n + j] = pairRating[j * n + i] = r;
        if (r === -2) forb[i * n + j] = forb[j * n + i] = 1;
      }
    }
    const pairH = new Uint8Array(n * n); // 1 = counts as a repeat pairing
    const pairM = new Int32Array(n * n);
    const pairS = new Int32Array(n * n);
    for (let k = 0; k < n * n; k++) {
      if (forb[k]) continue;
      const c = pairCount[k];
      const r = pairRating[k];
      if (c > 0 && !(cfg.allowBestPairRepeats && r === 2)) pairH[k] = 1;
      if (c > 0) pairM[k] = Math.min(c - 1, cfg.multiplicityCap);
      pairS[k] = cfg.ratingScore[String(r)] || 0;
    }

    // ---- Objective selection (which per-pair weights the tiers use) ---------
    // The construction, local search, scoring and materialization below all read
    // tierH / tierM (tier-1 / tier-2 per-pair contributions). "optimize" uses the
    // repeat matrices; "choice" swaps in a +2-request tier and IGNORES history.
    const choiceMode = cfg.objective === "choice";
    // Choice tier 1: a co-seated mutual (+2) pair contributes -1, so summing over
    // co-seated pairs yields -(honored). scoreOf adds baseH (= total mutual pairs)
    // to turn that back into the count of UNSATISFIED requests (>= 0). History
    // (pairH/pairM) is not consulted at all in choice mode.
    const pairChoiceH = choiceMode ? new Int32Array(n * n) : null;
    const zerosM = choiceMode ? new Int32Array(n * n) : null; // tier 2 unused
    const mutualPairs = []; // [i, j] index pairs with merged rating +2
    let baseH = 0;
    if (choiceMode) {
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          if (forb[i * n + j]) continue; // -2 can never also be +2, but be safe
          if (pairRating[i * n + j] === 2) {
            pairChoiceH[i * n + j] = pairChoiceH[j * n + i] = -1;
            mutualPairs.push([i, j]);
          }
        }
      }
      baseH = mutualPairs.length;
    }
    const tierH = choiceMode ? pairChoiceH : pairH;
    const tierM = choiceMode ? zerosM : pairM;

    // ---- Tables: capacities, locked members, free seats ------------------
    // Locked students keep their seats even if that seat was deactivated
    // after they were placed; deactivated EMPTY seats are simply unavailable.
    const tables = [];
    const tableIndexOf = new Map(); // tableId string -> index in tables
    layout.tables.forEach((table) => {
      const tableId = String(table.id);
      const lockedHere = lockedChart[tableId] || {};
      const lockedSeatNums = new Set(Object.keys(lockedHere).map(String));
      const freeSeats = (table.seats || [])
        .map((seat) => String(seat.seat_number))
        .filter((sn) => !lockedSeatNums.has(sn) && !deactivated.has(`${tableId}-${sn}`))
        .sort((x, y) => Number(x) - Number(y));

      const lockedMembers = [];
      const lockedSeatOf = new Map(); // student index -> seat number string
      Object.entries(lockedHere).forEach(([seatNum, sid]) => {
        const si = idx.get(Number(sid));
        lockedMembers.push(si);
        lockedSeatOf.set(si, String(seatNum));
      });

      tableIndexOf.set(tableId, tables.length);
      tables.push({
        tableId,
        freeSeats,
        capacity: lockedMembers.length + freeSeats.length,
        lockedMembers,
        lockedSeatOf,
      });
    });
    const T = tables.length;

    // Locked entries pointing at tables missing from the layout are preserved
    // verbatim in the output but can't participate in optimization.
    const strayLocked = {};
    Object.entries(lockedChart).forEach(([tableId, seatMap]) => {
      if (!tableIndexOf.has(String(tableId))) {
        strayLocked[tableId] = Object.assign({}, seatMap);
        console.warn(
          `SeatingOptimizer: table ${tableId} not in layout; leaving its assignments untouched`
        );
      }
    });

    // ---- Feasibility pre-flight ------------------------------------------
    const conflicts = [];
    tables.forEach((t) => {
      for (let i = 0; i < t.lockedMembers.length; i++) {
        for (let j = i + 1; j < t.lockedMembers.length; j++) {
          const a = t.lockedMembers[i];
          const b = t.lockedMembers[j];
          if (forb[a * n + b]) {
            conflicts.push({
              student1: nameOf.get(ids[a]),
              student2: nameOf.get(ids[b]),
              tableId: t.tableId,
            });
          }
        }
      }
    });
    if (conflicts.length > 0) {
      return {
        ok: false,
        error: "Students rated Never Together are already seated at the same table.",
        conflicts,
      };
    }

    const lockedInLayout = new Set();
    tables.forEach((t) => t.lockedMembers.forEach((si) => lockedInLayout.add(si)));
    const pool = [];
    for (let s = 0; s < n; s++) if (!lockedInLayout.has(s)) pool.push(s);
    // Students locked at stray tables are neither pool nor placeable
    Object.values(strayLocked).forEach((seatMap) =>
      Object.values(seatMap).forEach((sid) => {
        const si = idx.get(Number(sid));
        const at = pool.indexOf(si);
        if (at !== -1) pool.splice(at, 1);
      })
    );

    const freeSeatTotal = tables.reduce((sum, t) => sum + t.freeSeats.length, 0);
    if (pool.length > freeSeatTotal) {
      return {
        ok: false,
        error:
          `Not enough open seats: ${pool.length} unseated students but only ` +
          `${freeSeatTotal} active empty seats. Activate more seats (Shift+click) ` +
          `or use a larger layout.`,
      };
    }

    if (pool.length === 0) {
      return {
        ok: false,
        error: "Everyone is already seated - there are no students in the pool to place.",
      };
    }

    // ---- Balanced size targets -------------------------------------------
    const target = tables.map((t) => t.lockedMembers.length);
    let remaining = pool.length;
    while (remaining > 0) {
      let best = -1;
      for (let t = 0; t < T; t++) {
        if (target[t] >= tables[t].capacity) continue;
        if (best === -1 || target[t] < target[best]) best = t;
      }
      if (best === -1) break; // cannot happen: capacity checked above
      target[best]++;
      remaining--;
    }

    // ---- Difficulty order for construction --------------------------------
    const neverDeg = new Int32Array(n);
    const repSum = new Int32Array(n);
    const avoidDeg = new Int32Array(n);
    const mutualDeg = new Int32Array(n); // count of +2 partners (choice ordering)
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        if (forb[i * n + j]) neverDeg[i]++;
        repSum[i] += pairCount[i * n + j];
        if (pairRating[i * n + j] === -1) avoidDeg[i]++;
        if (pairRating[i * n + j] === 2) mutualDeg[i]++;
      }
    }

    // ---- Solve: multi-restart greedy + steepest-descent local search ------
    const baseSeed =
      cfg.seed !== null && cfg.seed !== undefined
        ? cfg.seed >>> 0
        : (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
    const deadline = start + cfg.timeBudgetMs;

    // Delta of adding student s to table t's members (excluding `skip`).
    // Returns null if a -2 pair would be created.
    const joinDelta = (s, memb, skip) => {
      let dH = 0;
      let dM = 0;
      let dS = 0;
      for (let k = 0; k < memb.length; k++) {
        const o = memb[k];
        if (o === skip) continue;
        const p = s * n + o;
        if (forb[p]) return null;
        dH += tierH[p];
        dM += tierM[p];
        dS += pairS[p];
      }
      return { dH, dM, dS };
    };
    const lexLess = (aH, aM, aS, aB, bH, bM, bS, bB) =>
      aH !== bH ? aH < bH : aM !== bM ? aM < bM : aS !== bS ? aS < bS : aB < bB;

    const construct = (rand) => {
      const memb = tables.map((t) => t.lockedMembers.slice());
      const tableOf = new Int32Array(n).fill(-1);
      tables.forEach((t, ti) => t.lockedMembers.forEach((si) => (tableOf[si] = ti)));

      const jitter = new Map(pool.map((s) => [s, rand()]));
      // Choice mode orders by mutual-request degree (NOT history); optimize mode
      // orders by repeat-history sum. neverDeg (-2 constraints) leads either way.
      const order = pool
        .slice()
        .sort(
          choiceMode
            ? (a, b) =>
                neverDeg[b] - neverDeg[a] ||
                mutualDeg[b] - mutualDeg[a] ||
                avoidDeg[b] - avoidDeg[a] ||
                jitter.get(a) - jitter.get(b)
            : (a, b) =>
                neverDeg[b] - neverDeg[a] ||
                repSum[b] - repSum[a] ||
                avoidDeg[b] - avoidDeg[a] ||
                jitter.get(a) - jitter.get(b)
        );

      // Choice mode: seed mutual (+2) pairs at a shared table first, so both
      // members are considered together (greedy alone can't, since a partner may
      // still be unplaced). Deterministic under seed via a jittered pair order.
      if (choiceMode && mutualPairs.length > 0) {
        const pjit = new Map(mutualPairs.map((_, i) => [i, rand()]));
        const pairSeq = mutualPairs
          .map((_, i) => i)
          .sort((x, y) => pjit.get(x) - pjit.get(y));
        for (const pi of pairSeq) {
          const [a, b] = mutualPairs[pi];
          const aAt = tableOf[a];
          const bAt = tableOf[b];
          if (aAt >= 0 && bAt >= 0) continue; // both settled already
          if (aAt >= 0 || bAt >= 0) {
            // One member is placed (possibly locked): pull the other to its table.
            const one = aAt >= 0 ? a : b;
            const other = aAt >= 0 ? b : a;
            const t = tableOf[one];
            if (memb[t].length < tables[t].capacity && joinDelta(other, memb[t], -1) !== null) {
              memb[t].push(other);
              tableOf[other] = t;
            }
          } else {
            // Neither placed: find the first table with room for both.
            for (let t = 0; t < T; t++) {
              if (memb[t].length + 2 > tables[t].capacity) continue;
              if (joinDelta(a, memb[t], -1) === null) continue;
              memb[t].push(a);
              tableOf[a] = t;
              if (joinDelta(b, memb[t], -1) === null) {
                memb[t].pop();
                tableOf[a] = -1;
                continue;
              }
              memb[t].push(b);
              tableOf[b] = t;
              break;
            }
          }
        }
      }

      for (const s of order) {
        if (tableOf[s] >= 0) continue; // already seeded (choice mode)
        // Two passes: balanced targets first, physical capacity second
        let placedAt = -1;
        for (const cap of [target, tables.map((t) => t.capacity)]) {
          let bestT = [];
          let bH = Infinity;
          let bM = Infinity;
          let bS = Infinity;
          for (let t = 0; t < T; t++) {
            if (memb[t].length >= cap[t]) continue;
            const d = joinDelta(s, memb[t], -1);
            if (d === null) continue;
            if (lexLess(d.dH, d.dM, d.dS, 0, bH, bM, bS, 0)) {
              bH = d.dH;
              bM = d.dM;
              bS = d.dS;
              bestT = [t];
            } else if (d.dH === bH && d.dM === bM && d.dS === bS) {
              bestT.push(t); // tie -> random pick below (restart diversity)
            }
          }
          if (bestT.length > 0) {
            placedAt = bestT[Math.floor(rand() * bestT.length)];
            break;
          }
        }
        if (placedAt === -1) {
          // One-level repair: evict a conflicting unlocked occupant elsewhere
          let repaired = false;
          for (let t = 0; t < T && !repaired; t++) {
            if (memb[t].length >= tables[t].capacity) continue;
            const blockers = memb[t].filter((o) => forb[s * n + o]);
            if (blockers.length !== 1 || lockedInLayout.has(blockers[0])) continue;
            const o = blockers[0];
            for (let t2 = 0; t2 < T; t2++) {
              if (t2 === t || memb[t2].length >= tables[t2].capacity) continue;
              if (joinDelta(o, memb[t2], -1) === null) continue;
              memb[t].splice(memb[t].indexOf(o), 1);
              memb[t2].push(o);
              tableOf[o] = t2;
              memb[t].push(s);
              tableOf[s] = t;
              repaired = true;
              break;
            }
          }
          if (!repaired) return { failed: s };
          continue;
        }
        memb[placedAt].push(s);
        tableOf[s] = placedAt;
      }
      return { memb, tableOf };
    };

    const localSearch = (sol) => {
      const { memb, tableOf } = sol;
      let improved = true;
      let passes = 0;
      while (improved && passes < cfg.maxLocalSearchPasses) {
        improved = false;
        passes++;
        // Relocations into free capacity (re-read tableOf[s] each candidate:
        // an applied move earlier in this pass changes it)
        for (const s of pool) {
          for (let t = 0; t < T; t++) {
            const from = tableOf[s];
            if (t === from || memb[t].length >= tables[t].capacity) continue;
            const add = joinDelta(s, memb[t], -1);
            if (add === null) continue;
            const rem = joinDelta(s, memb[from], s); // never null: s already sits there
            const dFrom = memb[from].length - target[from];
            const dTo = memb[t].length - target[t];
            const dB = (dFrom - 1) ** 2 + (dTo + 1) ** 2 - dFrom ** 2 - dTo ** 2;
            if (lexLess(add.dH - rem.dH, add.dM - rem.dM, add.dS - rem.dS, dB, 0, 0, 0, 0)) {
              memb[from].splice(memb[from].indexOf(s), 1);
              memb[t].push(s);
              tableOf[s] = t;
              improved = true;
            }
          }
        }
        // Cross-table swaps (same-table swaps don't change the grouping)
        for (let i = 0; i < pool.length; i++) {
          for (let j = i + 1; j < pool.length; j++) {
            const a = pool[i];
            const b = pool[j];
            const ta = tableOf[a];
            const tb = tableOf[b];
            if (ta === tb) continue;
            const addA = joinDelta(a, memb[tb], b);
            if (addA === null) continue;
            const addB = joinDelta(b, memb[ta], a);
            if (addB === null) continue;
            const remA = joinDelta(a, memb[ta], a);
            const remB = joinDelta(b, memb[tb], b);
            const dH = addA.dH + addB.dH - remA.dH - remB.dH;
            const dM = addA.dM + addB.dM - remA.dM - remB.dM;
            const dS = addA.dS + addB.dS - remA.dS - remB.dS;
            if (lexLess(dH, dM, dS, 0, 0, 0, 0, 0)) {
              memb[ta][memb[ta].indexOf(a)] = b;
              memb[tb][memb[tb].indexOf(b)] = a;
              tableOf[a] = tb;
              tableOf[b] = ta;
              improved = true;
            }
          }
        }
      }
    };

    const scoreOf = (memb) => {
      let H = 0;
      let M = 0;
      let S = 0;
      let B = 0;
      for (let t = 0; t < T; t++) {
        const m = memb[t];
        const dev = m.length - target[t];
        B += dev * dev;
        for (let i = 0; i < m.length; i++) {
          for (let j = i + 1; j < m.length; j++) {
            const p = m[i] * n + m[j];
            H += tierH[p];
            M += tierM[p];
            S += pairS[p];
          }
        }
      }
      // choice: H starts at -(honored); baseH (= total mutual pairs) turns it into
      // the count of UNSATISFIED requests. optimize: baseH is 0, H is repeat pairs.
      return { H: H + baseH, M, S, B };
    };

    let best = null;
    let bestScore = null;
    let restarts = 0;
    let zeroFoundAt = -1;
    let lastFailure = null;
    for (let r = 0; r < cfg.maxRestarts; r++) {
      if (nowMs() > deadline && best) break;
      if (zeroFoundAt >= 0 && r - zeroFoundAt >= cfg.polishRestarts) break;
      restarts++;
      const rand = mulberry32(baseSeed + r * 7919);
      const sol = construct(rand);
      if (sol.failed !== undefined) {
        lastFailure = sol.failed;
        continue;
      }
      localSearch(sol);
      const sc = scoreOf(sol.memb);
      if (
        !bestScore ||
        lexLess(sc.H, sc.M, sc.S, sc.B, bestScore.H, bestScore.M, bestScore.S, bestScore.B)
      ) {
        best = sol;
        bestScore = sc;
      }
      if (bestScore.H === 0 && zeroFoundAt < 0) zeroFoundAt = r;
    }

    if (!best) {
      const name = lastFailure !== null ? nameOf.get(ids[lastFailure]) : "a student";
      return {
        ok: false,
        error:
          `Could not find any valid seating: ${name} cannot be placed at any table ` +
          `given the Never Together ratings, locked seats, and active-seat capacities.`,
        unplaced: lastFailure !== null ? [nameOf.get(ids[lastFailure])] : [],
      };
    }

    // ---- Materialize seats -------------------------------------------------
    const result = {};
    Object.entries(strayLocked).forEach(([tableId, seatMap]) => {
      result[tableId] = Object.assign({}, seatMap);
    });
    tables.forEach((t, ti) => {
      const seatMap = {};
      t.lockedSeatOf.forEach((seatNum, si) => {
        seatMap[seatNum] = ids[si];
      });
      const newcomers = best.memb[ti].filter((si) => !t.lockedSeatOf.has(si));
      newcomers.forEach((si, k) => {
        seatMap[t.freeSeats[k]] = ids[si];
      });
      if (Object.keys(seatMap).length > 0) result[t.tableId] = seatMap;
    });

    // ---- Post-solve assertions (belt and suspenders) -----------------------
    for (let t = 0; t < T; t++) {
      const m = best.memb[t];
      for (let i = 0; i < m.length; i++) {
        for (let j = i + 1; j < m.length; j++) {
          if (forb[m[i] * n + m[j]]) {
            return {
              ok: false,
              error:
                "Internal error: optimizer produced a Never Together violation. No changes applied.",
            };
          }
        }
      }
    }

    const repeatDetail = [];
    let avoidPairsSeated = 0;
    let bestPairsSeated = 0;
    for (let t = 0; t < T; t++) {
      const m = best.memb[t];
      for (let i = 0; i < m.length; i++) {
        for (let j = i + 1; j < m.length; j++) {
          const p = m[i] * n + m[j];
          if (pairCount[p] > 0) {
            repeatDetail.push({
              student1: nameOf.get(ids[m[i]]),
              student2: nameOf.get(ids[m[j]]),
              timesPaired: pairCount[p],
            });
          }
          if (pairRating[p] === -1) avoidPairsSeated++;
          if (pairRating[p] === 2) bestPairsSeated++;
        }
      }
    }

    // ---- Choice-mode request stats -----------------------------------------
    // Every mutual (+2) pair with both members placed is honored iff they share a
    // table. mutualPairs is empty outside choice mode (honored 0 of 0).
    let honored = 0;
    const unhonored = [];
    for (const [a, b] of mutualPairs) {
      if (best.tableOf[a] >= 0 && best.tableOf[a] === best.tableOf[b]) {
        honored++;
      } else {
        unhonored.push({ student1: nameOf.get(ids[a]), student2: nameOf.get(ids[b]) });
      }
    }

    return {
      ok: true,
      assignments: result,
      stats: {
        placed: pool.length,
        // optimize: H is the repeat-pair count. choice: report the actual repeat
        // pairs present (informational; not part of the choice objective).
        repeatPairs: choiceMode ? repeatDetail.length : bestScore.H,
        repeatDetail,
        avoidPairsSeated,
        bestPairsSeated,
        // choice: H is the count of UNSATISFIED mutual requests; 0 => all honored.
        // optimize: H is repeat pairs; 0 => zero-repeat certificate.
        provablyOptimal: bestScore.H === 0,
        // Choice-mode summary (mutualRequests === honored + unhonored.length).
        mutualRequests: mutualPairs.length,
        honored,
        unhonored,
        restarts,
        ms: Math.round(nowMs() - start),
        seed: baseSeed,
      },
    };
  }
}

// ============ TEST SUITE (asserting) ============
// Browser: open /test_optimizer.html or call runOptimizerTests() in the console.
// Node:    node frontend/seating/SeatingOptimizer.js

function runOptimizerTests() {
  const results = [];
  const check = (name, fn) => {
    try {
      fn();
      results.push({ name, ok: true });
    } catch (e) {
      results.push({ name, ok: false, detail: e.message });
    }
  };
  const assert = (cond, msg) => {
    if (!cond) throw new Error(msg);
  };

  // --- fixture helpers (editor shapes) ---
  const makeStudents = (count) =>
    Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      first_name: `S${i + 1}`,
      last_name: `L${i + 1}`,
    }));
  const makeLayout = (tableCount, seatsPerTable) => ({
    tables: Array.from({ length: tableCount }, (_, t) => ({
      id: 100 + t,
      table_number: t + 1,
      seats: Array.from({ length: seatsPerTable }, (_, s) => ({
        seat_number: s + 1,
      })),
    })),
  });
  // pairs: [[id, id, times]] -> backend partnership_data shape (date arrays)
  const makeHistory = (pairs) => {
    const h = {};
    pairs.forEach(([a, b, times]) => {
      const dates = Array.from({ length: times || 1 }, (_, k) => `2024-0${k + 1}-01`);
      [
        [a, b],
        [b, a],
      ].forEach(([x, y]) => {
        if (!h[String(x)]) h[String(x)] = { partnerships: {} };
        h[String(x)].partnerships[String(y)] = dates;
      });
    });
    return h;
  };
  // ratings: [[id, id, rating]] -> symmetric grid like the backend emits
  const makeRatings = (list) => {
    const grid = {};
    list.forEach(([a, b, r]) => {
      [
        [a, b],
        [b, a],
      ].forEach(([x, y]) => {
        if (!grid[String(x)]) grid[String(x)] = { ratings: {} };
        grid[String(x)].ratings[String(y)] = r;
      });
    });
    return { grid };
  };
  const seatedPairs = (assignments) => {
    const pairs = [];
    Object.values(assignments).forEach((seatMap) => {
      const members = Object.values(seatMap).map(Number);
      for (let i = 0; i < members.length; i++)
        for (let j = i + 1; j < members.length; j++)
          pairs.push([members[i], members[j]].sort((x, y) => x - y));
    });
    return pairs;
  };
  const opt = (over) => new SeatingOptimizer(Object.assign({ seed: 42, timeBudgetMs: 800 }, over));

  check("places every pool student, editor output shape", () => {
    const res = opt().optimize({}, makeStudents(8), makeLayout(2, 4), {});
    assert(res.ok, `expected ok, got: ${res.error}`);
    const seated = Object.values(res.assignments).flatMap((m) => Object.values(m));
    assert(seated.length === 8, `expected 8 seated, got ${seated.length}`);
    assert(new Set(seated).size === 8, "duplicate student in output");
    Object.entries(res.assignments).forEach(([tid, seatMap]) => {
      assert(typeof tid === "string", "table key must be string");
      Object.keys(seatMap).forEach((sn) =>
        assert(typeof sn === "string", "seat key must be string")
      );
    });
    assert(res.stats.placed === 8, "stats.placed wrong");
  });

  check("locked students keep their exact seats", () => {
    const current = { 100: { 2: 1 }, 101: { 3: 5 } };
    const res = opt().optimize(current, makeStudents(8), makeLayout(2, 4), {});
    assert(res.ok, `expected ok, got: ${res.error}`);
    assert(res.assignments["100"]["2"] === 1, "student 1 moved from table 100 seat 2");
    assert(res.assignments["101"]["3"] === 5, "student 5 moved from table 101 seat 3");
  });

  check("-2 pairs never share a table (10 seeds)", () => {
    const ratings = makeRatings([
      [1, 2, -2],
      [3, 4, -2],
      [5, 6, -2],
    ]);
    for (let seed = 1; seed <= 10; seed++) {
      const res = opt({ seed }).optimize({}, makeStudents(12), makeLayout(3, 4), {
        partnershipRatings: ratings,
      });
      assert(res.ok, `seed ${seed}: ${res.error}`);
      seatedPairs(res.assignments).forEach(([a, b]) => {
        assert(
          !((a === 1 && b === 2) || (a === 3 && b === 4) || (a === 5 && b === 6)),
          `seed ${seed}: -2 pair ${a},${b} co-seated`
        );
      });
    }
  });

  check("deactivated seats stay empty", () => {
    const deactivated = new Set(["100-1", "101-4"]);
    const res = opt().optimize({}, makeStudents(6), makeLayout(2, 4), {
      deactivatedSeats: deactivated,
    });
    assert(res.ok, `expected ok, got: ${res.error}`);
    assert(!(res.assignments["100"] || {})["1"], "deactivated seat 100-1 was filled");
    assert(!(res.assignments["101"] || {})["4"], "deactivated seat 101-4 was filled");
  });

  check("finds a zero-repeat chart when one exists (certificate)", () => {
    // Prior chart paired (1,2) (3,4) (5,6) (7,8); splitting odds/evens fixes it
    const history = makeHistory([
      [1, 2, 1],
      [3, 4, 1],
      [5, 6, 1],
      [7, 8, 1],
    ]);
    const res = opt().optimize({}, makeStudents(8), makeLayout(2, 4), {
      partnershipHistory: history,
    });
    assert(res.ok, `expected ok, got: ${res.error}`);
    assert(res.stats.repeatPairs === 0, `expected 0 repeats, got ${res.stats.repeatPairs}`);
    assert(res.stats.provablyOptimal === true, "0 repeats should be provably optimal");
  });

  check("matches brute-force optimum (6 students, 2 tables of 3)", () => {
    const history = makeHistory([
      [1, 2, 3],
      [1, 3, 1],
      [2, 3, 1],
      [4, 5, 2],
      [1, 4, 1],
    ]);
    const counts = { "1-2": 3, "1-3": 1, "2-3": 1, "4-5": 2, "1-4": 1 };
    // Enumerate all 3-of-6 groupings, find true minimum repeat-pair count
    let minH = Infinity;
    const students = [1, 2, 3, 4, 5, 6];
    for (let a = 0; a < 6; a++)
      for (let b = a + 1; b < 6; b++)
        for (let c = b + 1; c < 6; c++) {
          const g1 = [students[a], students[b], students[c]];
          const g2 = students.filter((s) => !g1.includes(s));
          let h = 0;
          [g1, g2].forEach((g) => {
            for (let i = 0; i < 3; i++)
              for (let j = i + 1; j < 3; j++) {
                const key = [g[i], g[j]].sort((x, y) => x - y).join("-");
                if (counts[key]) h++;
              }
          });
          minH = Math.min(minH, h);
        }
    const res = opt().optimize({}, makeStudents(6), makeLayout(2, 3), {
      partnershipHistory: history,
    });
    assert(res.ok, `expected ok, got: ${res.error}`);
    assert(
      res.stats.repeatPairs === minH,
      `optimizer got ${res.stats.repeatPairs} repeats, brute-force optimum is ${minH}`
    );
  });

  check("a +2 rating cannot buy a repeat pairing (default policy)", () => {
    // 1&2 sat together AND are rated +2; a 0-repeat chart exists -> they separate
    const history = makeHistory([[1, 2, 2]]);
    const ratings = makeRatings([[1, 2, 2]]);
    const res = opt().optimize({}, makeStudents(8), makeLayout(2, 4), {
      partnershipHistory: history,
      partnershipRatings: ratings,
    });
    assert(res.ok, `expected ok, got: ${res.error}`);
    assert(res.stats.repeatPairs === 0, "repeat pairing bought by +2 rating");
  });

  check("+2 pairs sit together when history is clean", () => {
    const ratings = makeRatings([[1, 2, 2]]);
    const res = opt().optimize({}, makeStudents(8), makeLayout(2, 4), {
      partnershipRatings: ratings,
    });
    assert(res.ok, `expected ok, got: ${res.error}`);
    const together = seatedPairs(res.assignments).some(([a, b]) => a === 1 && b === 2);
    assert(together, "+2 pair was not seated together despite no history");
  });

  check("locked -2 conflict is reported, not silently accepted", () => {
    const current = { 100: { 1: 1, 2: 2 } };
    const ratings = makeRatings([[1, 2, -2]]);
    const res = opt().optimize(current, makeStudents(6), makeLayout(2, 4), {
      partnershipRatings: ratings,
    });
    assert(res.ok === false, "expected ok:false");
    assert(res.conflicts && res.conflicts.length === 1, "expected 1 named conflict");
    assert(res.conflicts[0].tableId === "100", "conflict table wrong");
  });

  check("capacity shortfall is an error, not a silent drop", () => {
    const res = opt().optimize({}, makeStudents(9), makeLayout(2, 4), {});
    assert(res.ok === false, "expected ok:false for 9 students / 8 seats");
    assert(/Not enough open seats/.test(res.error), `unexpected error: ${res.error}`);
  });

  check("same seed reproduces the identical chart", () => {
    const history = makeHistory([
      [1, 2, 1],
      [3, 4, 2],
    ]);
    const run = () =>
      opt({ seed: 7 }).optimize({}, makeStudents(10), makeLayout(3, 4), {
        partnershipHistory: history,
      });
    const a = run();
    const b = run();
    assert(a.ok && b.ok, "runs failed");
    assert(JSON.stringify(a.assignments) === JSON.stringify(b.assignments), "seeded runs differ");
  });

  check("impossible -2 web reports unplaced instead of dropping", () => {
    // Student 1 is -2 with everyone; tables of 2 force a partner
    const ratings = makeRatings([
      [1, 2, -2],
      [1, 3, -2],
      [1, 4, -2],
    ]);
    const res = opt().optimize({}, makeStudents(4), makeLayout(2, 2), {
      partnershipRatings: ratings,
    });
    // Feasible: 1 alone is impossible (2 tables x 2 seats, 4 students) -> must fail loudly
    assert(res.ok === false, "expected ok:false");
    assert(res.unplaced && res.unplaced.length > 0, "expected unplaced report");
  });

  // ---- Choice-mode tests (GH #24) ----
  const choice = (over) =>
    new SeatingOptimizer(Object.assign({ objective: "choice", seed: 42, timeBudgetMs: 800 }, over));
  const coSeated = (assignments, x, y) =>
    seatedPairs(assignments).some(([a, b]) => (a === x && b === y) || (a === y && b === x));

  check("choice: mutual +2 pair seated together even after sitting together EVERY past period", () => {
    // THE defining behavior vs optimize: history is ignored, so a repeat is fine.
    const history = makeHistory([[1, 2, 5]]); // paired in every prior chart
    const ratings = makeRatings([[1, 2, 2]]);
    const res = choice().optimize({}, makeStudents(8), makeLayout(2, 4), {
      partnershipHistory: history,
      partnershipRatings: ratings,
    });
    assert(res.ok, `expected ok, got: ${res.error}`);
    assert(coSeated(res.assignments, 1, 2), "mutual +2 pair not seated together in choice mode");
    assert(res.stats.mutualRequests === 1, `expected 1 request, got ${res.stats.mutualRequests}`);
    assert(res.stats.honored === 1, `expected 1 honored, got ${res.stats.honored}`);
    assert(res.stats.provablyOptimal === true, "all requests honored should be provablyOptimal");
    // Contrast: optimize mode separates them (a repeat can't be bought by +2)
    const optRes = opt().optimize({}, makeStudents(8), makeLayout(2, 4), {
      partnershipHistory: history,
      partnershipRatings: ratings,
    });
    assert(optRes.ok, `optimize expected ok, got: ${optRes.error}`);
    assert(!coSeated(optRes.assignments, 1, 2), "optimize mode should have separated the repeat");
  });

  check("choice: teacher -2 never co-seated (hard constraint still wins)", () => {
    // -2 is teacher-authored (students can only reach -1); it is never a +2 request.
    const ratings = makeRatings([[1, 2, -2]]);
    for (let seed = 1; seed <= 5; seed++) {
      const res = choice({ seed }).optimize({}, makeStudents(8), makeLayout(2, 4), {
        partnershipRatings: ratings,
      });
      assert(res.ok, `seed ${seed}: ${res.error}`);
      assert(!coSeated(res.assignments, 1, 2), `seed ${seed}: -2 pair co-seated in choice mode`);
    }
  });

  check("choice: locked student stays; mutual partner joins its table", () => {
    const current = { 100: { 1: 1 } }; // student 1 locked at table 100 seat 1
    const ratings = makeRatings([[1, 2, 2]]);
    const res = choice().optimize(current, makeStudents(8), makeLayout(2, 4), {
      partnershipRatings: ratings,
    });
    assert(res.ok, `expected ok, got: ${res.error}`);
    assert(res.assignments["100"]["1"] === 1, "locked student 1 moved");
    assert(
      Object.values(res.assignments["100"]).map(Number).includes(2),
      "mutual partner 2 did not join the locked member's table"
    );
    assert(res.stats.honored === 1, `expected 1 honored, got ${res.stats.honored}`);
  });

  check("choice: unhonorable request is reported, not violated", () => {
    // Table 100 (2 seats) is locked full with 1 and 3; 2 wants 1 (+2) but is -2 with 3,
    // so 2 cannot join table 100 -> request 1-2 is unhonorable and must be reported.
    const current = { 100: { 1: 1, 2: 3 } };
    const ratings = makeRatings([
      [1, 2, 2],
      [2, 3, -2],
    ]);
    const res = choice().optimize(current, makeStudents(4), makeLayout(2, 2), {
      partnershipRatings: ratings,
    });
    assert(res.ok, `expected ok, got: ${res.error}`);
    assert(!coSeated(res.assignments, 1, 2), "unhonorable +2 pair was co-seated");
    assert(!coSeated(res.assignments, 2, 3), "-2 pair co-seated");
    assert(res.stats.mutualRequests === 1, `expected 1 request, got ${res.stats.mutualRequests}`);
    assert(res.stats.honored === 0, `expected 0 honored, got ${res.stats.honored}`);
    assert(res.stats.unhonored.length === 1, "expected 1 unhonored entry");
    const u = res.stats.unhonored[0];
    assert(
      (u.student1 && u.student2) &&
        [u.student1, u.student2].every((nm) => typeof nm === "string"),
      "unhonored entry should carry both names"
    );
  });

  check("choice: same seed reproduces the identical chart", () => {
    const ratings = makeRatings([
      [1, 2, 2],
      [4, 5, 2],
      [7, 8, 1],
    ]);
    const history = makeHistory([[1, 2, 2]]); // ignored, but present
    const run = () =>
      choice({ seed: 7 }).optimize({}, makeStudents(10), makeLayout(3, 4), {
        partnershipHistory: history,
        partnershipRatings: ratings,
      });
    const a = run();
    const b = run();
    assert(a.ok && b.ok, "runs failed");
    assert(JSON.stringify(a.assignments) === JSON.stringify(b.assignments), "seeded runs differ");
  });

  check("choice: clique of 3 mutual pairs at 2-seat tables honors the max and reports the rest", () => {
    // Triangle 1-2, 1-3, 2-3 all +2. With 2-seat tables only ONE edge can be seated.
    const ratings = makeRatings([
      [1, 2, 2],
      [1, 3, 2],
      [2, 3, 2],
    ]);
    const res = choice().optimize({}, makeStudents(4), makeLayout(2, 2), {
      partnershipRatings: ratings,
    });
    assert(res.ok, `expected ok, got: ${res.error}`);
    assert(res.stats.mutualRequests === 3, `expected 3 requests, got ${res.stats.mutualRequests}`);
    assert(res.stats.honored === 1, `expected 1 honored (the max), got ${res.stats.honored}`);
    assert(res.stats.unhonored.length === 2, `expected 2 unhonored, got ${res.stats.unhonored.length}`);
    assert(res.stats.provablyOptimal === false, "2 unsatisfied requests should not be provablyOptimal");
  });

  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  results.forEach((r) =>
    console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? " -- " + r.detail : ""}`)
  );
  console.log(`\n${passed}/${results.length} tests passed`);
  return { passed, failed, results };
}

// Export to browser and Node
if (typeof window !== "undefined") {
  window.SeatingOptimizer = SeatingOptimizer;
  window.runOptimizerTests = runOptimizerTests;
  console.log("SeatingOptimizer module loaded (least-repeat-pairings optimizer)");
}
/* eslint-disable no-undef */
if (typeof module !== "undefined" && module.exports) {
  module.exports = { SeatingOptimizer, runOptimizerTests };
  if (require.main === module) {
    const { failed } = runOptimizerTests();
    process.exit(failed > 0 ? 1 : 0);
  }
}
/* eslint-enable no-undef */
