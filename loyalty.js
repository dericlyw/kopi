/* =========================================================================
   THE DAILY BREW — loyalty.js
   Shared storage, date and Brew Streak logic. Loaded by both the
   customer page (script.js) and the staff page (staff.js) so streaks,
   stamps and pass status are calculated the same way everywhere.
   ========================================================================= */

const Loyalty = (function () {
  "use strict";

  const KEYS = {
    orders: "dailybrew_orders",
    seq: "dailybrew_order_seq",
    members: "dailybrew_members",
    memberPhone: "dailybrew_member_phone",
  };

  const LOYALTY = CONTENT.loyalty;

  function loadJSON(key, fallback) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
    catch (e) { return fallback; }
  }
  function saveJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage unavailable */ }
  }

  const money = (n) => `${CONTENT.currency} ${n.toFixed(2)}`;

  /* ---- Dates: local calendar days as "YYYY-MM-DD" ---- */
  const pad2 = (n) => String(n).padStart(2, "0");
  const dateKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const parseKey = (key) => { const [y, m, d] = key.split("-").map(Number); return new Date(y, m - 1, d); };
  const addDays = (key, n) => { const d = parseKey(key); d.setDate(d.getDate() + n); return dateKey(d); };
  const daysBetween = (a, b) => Math.round((parseKey(b) - parseKey(a)) / 864e5);
  const todayKey = () => dateKey(new Date());
  const prettyDate = (key) => parseKey(key).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

  /* ---- Members, keyed by the digits of their phone number ---- */
  const phoneKey = (phone) => String(phone || "").replace(/\D/g, "");

  const allMembers = () => loadJSON(KEYS.members, {});
  function getMember(phone) {
    const key = phoneKey(phone);
    return key ? allMembers()[key] || null : null;
  }
  function saveMember(member) {
    const all = allMembers();
    all[phoneKey(member.phone)] = member;
    saveJSON(KEYS.members, all);
  }

  // Walks back day by day from today. Today can't break the streak until
  // it's over, and one missed day per restDayWindow is forgiven — so a
  // single bad day doesn't wipe out weeks of showing up.
  function streakInfo(member) {
    const visits = new Set(member ? member.visitDays : []);
    const today = todayKey();
    const restDays = [];
    let streak = 0;
    let cursor = visits.has(today) ? today : addDays(today, -1);
    for (;;) {
      if (visits.has(cursor)) streak++;
      else if (visits.has(addDays(cursor, -1)) &&
               (restDays.length === 0 || daysBetween(cursor, restDays[restDays.length - 1]) >= LOYALTY.restDayWindow)) restDays.push(cursor);
      else break;
      cursor = addDays(cursor, -1);
    }
    return { streak, restDays, orderedToday: visits.has(today) };
  }

  function stampInfo(member) {
    const stamps = member ? member.visitDays.length : 0;
    const perReward = LOYALTY.stampsForReward;
    const earned = Math.floor(stamps / perReward);
    return {
      stamps,
      progress: stamps % perReward,
      available: Math.max(0, earned - (member ? member.rewardsRedeemed : 0)),
    };
  }

  const passActive = (member) => !!(member && member.passUntil && member.passUntil >= todayKey());
  const passReadyToday = (member) => passActive(member) && member.passLastUsed !== todayKey();

  return {
    KEYS, loadJSON, saveJSON, money,
    dateKey, parseKey, addDays, daysBetween, todayKey, prettyDate,
    phoneKey, allMembers, getMember, saveMember,
    streakInfo, stampInfo, passActive, passReadyToday,
  };
})();
