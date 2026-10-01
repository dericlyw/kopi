/* =========================================================================
   THE DAILY BREW — staff.js
   Staff page: order queue (advance NEW → PREPARING → READY → COMPLETED),
   pilot KPIs, member list, CSV export. Reads the same localStorage data
   the customer page writes, so it must run on the same device/browser
   (e.g. the counter tablet in another tab).
   ========================================================================= */

(function () {
  "use strict";

  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));
  const escapeHtml = (str) => String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const { KEYS, loadJSON, saveJSON, money, dateKey, addDays, todayKey, prettyDate, allMembers, streakInfo, stampInfo, passActive } = Loyalty;
  const STATUSES = CONTENT.orderStatuses;
  const PASS = CONTENT.pass;

  const loadOrders = () => loadJSON(KEYS.orders, []);
  const orderDay = (o) => dateKey(new Date(o.createdAt));
  const timeOf = (o) => new Date(o.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  function toast(message) {
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = message;
    $("#toast-container").appendChild(el);
    setTimeout(() => el.remove(), 2400);
  }

  /* ---------------- Order queue ---------------- */
  function orderCardHTML(o) {
    const i = STATUSES.indexOf(o.status);
    const next = STATUSES[i + 1];
    const items = o.items.map((it) => `<li>${it.qty} × ${escapeHtml(it.name)}</li>`).join("");
    const perks = (o.discounts || []).map((d) => `<li class="perk">${escapeHtml(d.label)}</li>`).join("");
    return `
      <article class="queue-card">
        <div class="queue-card-head"><strong>${escapeHtml(o.orderNumber)}</strong><span>${timeOf(o)}</span></div>
        <div class="queue-meta">${escapeHtml(o.customerName)} · ${escapeHtml(o.orderType)} · ${escapeHtml(o.paymentMethod)}</div>
        <ul class="queue-items">${items}${perks}</ul>
        <div class="queue-foot">
          <span class="queue-total">${money(o.total)}</span>
          ${next ? `<button class="btn btn-primary" data-advance="${escapeHtml(o.orderNumber)}" type="button">Mark ${next.toLowerCase()}</button>` : ""}
        </div>
      </article>`;
  }

  function renderQueue() {
    const orders = loadOrders();
    const open = STATUSES.slice(0, -1);
    $("#queue-cols").innerHTML = open.map((s) => {
      const list = orders.filter((o) => o.status === s);
      return `<div class="queue-col">
        <h2>${s} <span>${list.length}</span></h2>
        <div class="queue-list">${list.map(orderCardHTML).join("") || `<p class="queue-empty">Nothing here</p>`}</div>
      </div>`;
    }).join("");
    const today = todayKey();
    const done = orders.filter((o) => o.status === STATUSES[STATUSES.length - 1] && orderDay(o) === today).reverse();
    $("#done-count").textContent = `(${done.length})`;
    $("#done-list").innerHTML = done.map(orderCardHTML).join("");
  }

  function advance(orderNumber) {
    const orders = loadOrders();
    const o = orders.find((x) => x.orderNumber === orderNumber);
    if (!o) return;
    const i = STATUSES.indexOf(o.status);
    if (i < STATUSES.length - 1) o.status = STATUSES[i + 1];
    saveJSON(KEYS.orders, orders);
    renderAll();
  }

  /* ---------------- Pilot results ---------------- */
  const pct = (n, d) => (d ? Math.round((n / d) * 100) + "%" : "—");

  function renderKPIs() {
    const orders = loadOrders();
    const members = Object.values(allMembers());
    const revenue = orders.reduce((s, o) => s + o.total, 0);
    const perksGiven = orders.reduce((s, o) => s + (o.discounts || []).reduce((a, d) => a + d.amount, 0), 0);
    const passLines = orders.flatMap((o) => o.items.filter((it) => it.id === PASS.productId));
    const passesSold = passLines.reduce((s, it) => s + it.qty, 0);
    const passRevenue = passLines.reduce((s, it) => s + it.price * it.qty, 0);
    const repeaters = members.filter((m) => m.visitDays.length >= 2).length;
    const activeStreaks = members.filter((m) => streakInfo(m).streak >= 2).length;
    const visitDays = members.reduce((s, m) => s + m.visitDays.length, 0);
    const rewardsRedeemed = members.reduce((s, m) => s + m.rewardsRedeemed, 0);
    const activePasses = members.filter(passActive).length;

    const tiles = [
      ["Repeat rate", pct(repeaters, members.length), `${repeaters} of ${members.length} members came back on a 2nd day`, true],
      ["Active streaks", activeStreaks, "members on a streak of 2+ days", true],
      ["Visits per member", members.length ? (visitDays / members.length).toFixed(1) : "—", "average order-days each"],
      ["Net revenue", money(revenue), `${orders.length} orders · after perks`],
      ["Passes sold", passesSold, `${money(passRevenue)} prepaid · ${activePasses} active now`],
      ["Perks given", money(perksGiven), `${rewardsRedeemed} free-drink rewards redeemed`],
    ];
    $("#kpi-grid").innerHTML = tiles.map(([label, value, sub, key]) =>
      `<div class="kpi ${key ? "kpi-key" : ""}"><span class="kpi-label">${label}</span><strong>${value}</strong><span class="kpi-sub">${sub}</span></div>`).join("");

    // Orders per day, last 14 days — single series, one hue.
    const counts = {};
    orders.forEach((o) => { const k = orderDay(o); counts[k] = (counts[k] || 0) + 1; });
    const today = todayKey();
    const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
    const max = Math.max(1, ...days.map((d) => counts[d] || 0));
    $("#day-bars").innerHTML = days.map((d) => {
      const n = counts[d] || 0;
      return `<div class="day-bar" title="${prettyDate(d)}: ${n} order${n === 1 ? "" : "s"}">
        <span class="day-bar-val">${n || ""}</span>
        <span class="day-bar-fill" style="height:${(n / max) * 100}%"></span>
        <span class="day-bar-label">${Number(d.slice(8))}</span>
      </div>`;
    }).join("");
  }

  /* ---------------- Members ---------------- */
  function renderMembers() {
    const members = Object.values(allMembers())
      .sort((a, b) => (b.visitDays[b.visitDays.length - 1] || "").localeCompare(a.visitDays[a.visitDays.length - 1] || ""));
    if (!members.length) { $("#members-table").innerHTML = `<tr><td class="queue-empty">No members yet — they appear after their first order.</td></tr>`; return; }
    $("#members-table").innerHTML = `
      <thead><tr><th>Name</th><th>Phone</th><th>Streak</th><th>Stamps</th><th>Rewards ready</th><th>Pass until</th><th>Last visit</th></tr></thead>
      <tbody>${members.map((m) => {
        const s = stampInfo(m);
        return `<tr>
          <td>${escapeHtml(m.name)}</td><td>${escapeHtml(m.phone)}</td>
          <td>${streakInfo(m).streak}</td><td>${s.stamps}</td><td>${s.available}</td>
          <td>${passActive(m) ? prettyDate(m.passUntil) : "—"}</td>
          <td>${m.visitDays.length ? prettyDate(m.visitDays[m.visitDays.length - 1]) : "—"}</td>
        </tr>`;
      }).join("")}</tbody>`;
  }

  /* ---------------- CSV export + reset ---------------- */
  function downloadCSV(filename, rows) {
    const csv = rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function exportOrders() {
    const rows = [["order", "created", "customer", "phone", "type", "payment", "items", "subtotal", "perks", "total", "status"]];
    loadOrders().forEach((o) => rows.push([
      o.orderNumber, o.createdAt, o.customerName, o.phone, o.orderType, o.paymentMethod,
      o.items.map((it) => `${it.qty}x ${it.name}`).join("; "),
      (o.subtotal ?? o.total).toFixed(2), (o.discounts || []).map((d) => `${d.label} -${d.amount.toFixed(2)}`).join("; "),
      o.total.toFixed(2), o.status,
    ]));
    downloadCSV(`dailybrew-orders-${todayKey()}.csv`, rows);
  }

  function exportMembers() {
    const rows = [["name", "phone", "joined", "order_days", "streak", "rewards_ready", "rewards_redeemed", "pass_until", "visit_days"]];
    Object.values(allMembers()).forEach((m) => rows.push([
      m.name, m.phone, m.joinedAt, m.visitDays.length, streakInfo(m).streak, stampInfo(m).available,
      m.rewardsRedeemed, m.passUntil || "", m.visitDays.join(" "),
    ]));
    downloadCSV(`dailybrew-members-${todayKey()}.csv`, rows);
  }

  function resetData() {
    if (!confirm("Clear ALL orders and members on this device? Download the CSVs first if you need them.")) return;
    Object.values(KEYS).forEach((k) => { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } });
    renderAll();
    toast("Test data cleared");
  }

  /* ---------------- Boot ---------------- */
  function showTab(name) {
    $$(".nav-link").forEach((b) => b.classList.toggle("is-active", b.dataset.tab === name));
    $$(".staff-tab").forEach((p) => p.classList.toggle("is-active", p.dataset.panel === name));
  }

  function renderAll() { renderQueue(); renderKPIs(); renderMembers(); }

  function init() {
    $("#staff-title").textContent = `${CONTENT.business.name} · Staff`;
    document.addEventListener("click", (e) => {
      const adv = e.target.closest("[data-advance]");
      const tab = e.target.closest("[data-tab]");
      if (adv) advance(adv.dataset.advance);
      if (tab) showTab(tab.dataset.tab);
    });
    $("#export-orders").addEventListener("click", exportOrders);
    $("#export-members").addEventListener("click", exportMembers);
    $("#reset-data").addEventListener("click", resetData);
    // Orders placed in the shop tab show up here without a reload.
    window.addEventListener("storage", renderAll);
    setInterval(renderAll, 10000);
    renderAll();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
