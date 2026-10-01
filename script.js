/* =========================================================================
   THE DAILY BREW — script.js
   Customer ordering flow: browse → cart → checkout → place order → track.
   Orders are persisted to localStorage under Loyalty.KEYS.orders; staff.html
   reads and updates the same data. Brew Streak streak/stamp/pass rules
   live in loyalty.js so both pages calculate them identically.
   ========================================================================= */

(function () {
  "use strict";

  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));
  const escapeHtml = (str) => String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const productById = (id) => CONTENT.products.find((p) => p.id === id);

  const {
    KEYS, loadJSON, saveJSON, money,
    addDays, parseKey, todayKey, prettyDate,
    getMember, saveMember, streakInfo, stampInfo, passActive, passReadyToday,
  } = Loyalty;
  const ORDERS_KEY = KEYS.orders;
  const SEQ_KEY = KEYS.seq;
  const MEMBER_PHONE_KEY = KEYS.memberPhone;

  const LOYALTY = CONTENT.loyalty;
  const PASS = CONTENT.pass;

  /* ----------------------------------------------------------------- *
   *  State
   * ----------------------------------------------------------------- */
  const state = {
    screen: "menu",
    category: CONTENT.categories[0].id,
    cart: [], // [{ productId, qty }]
    lastOrderNumber: null,
    useReward: true,
  };

  /* ----------------------------------------------------------------- *
   *  Members (Brew Streak + Daily Brew Pass)
   * ----------------------------------------------------------------- */
  const rememberedPhone = () => loadJSON(MEMBER_PHONE_KEY, null);

  const cheapestItemPrice = () => Math.min(...CONTENT.products.filter((p) => p.category !== "pass").map((p) => p.price));

  // Subtotal minus perks. The pass covers the priciest eligible drink,
  // a redeemed reward covers the next one — each up to its cap.
  function computePricing(member, useReward) {
    const subtotal = cartTotal();
    const drinks = [];
    state.cart.forEach((line) => {
      const p = productById(line.productId);
      if (p && LOYALTY.drinkCategories.includes(p.category)) for (let i = 0; i < line.qty; i++) drinks.push(p);
    });
    drinks.sort((a, b) => b.price - a.price);

    const discounts = [];
    let passUsed = false, rewardUsed = false;
    if (passReadyToday(member) && drinks.length) {
      const p = drinks.shift();
      discounts.push({ label: `${PASS.name} — ${p.name}`, amount: Math.min(p.price, PASS.maxValue) });
      passUsed = true;
    }
    if (useReward && stampInfo(member).available > 0 && drinks.length) {
      const p = drinks.shift();
      discounts.push({ label: `Free drink reward — ${p.name}`, amount: Math.min(p.price, LOYALTY.rewardMaxValue) });
      rewardUsed = true;
    }
    const off = discounts.reduce((s, d) => s + d.amount, 0);
    return { subtotal, discounts, total: Math.max(0, subtotal - off), passUsed, rewardUsed };
  }

  // Called when an order is placed, before the cart is cleared.
  function recordVisit(order, pricing) {
    const today = todayKey();
    const member = getMember(order.phone) || {
      phone: order.phone, name: order.customerName, joinedAt: today,
      visitDays: [], rewardsRedeemed: 0, passUntil: null, passLastUsed: null, usual: [],
    };
    member.phone = order.phone;
    member.name = order.customerName;
    const newStamp = !member.visitDays.includes(today);
    if (newStamp) member.visitDays.push(today);
    if (pricing.rewardUsed) member.rewardsRedeemed++;
    if (pricing.passUsed) member.passLastUsed = today;

    const passLine = state.cart.find((l) => l.productId === PASS.productId);
    if (passLine) {
      const start = passActive(member) ? addDays(member.passUntil, 1) : today;
      member.passUntil = addDays(start, PASS.days * passLine.qty - 1);
    }

    const usual = state.cart.filter((l) => l.productId !== PASS.productId).map((l) => ({ productId: l.productId, qty: l.qty }));
    if (usual.length) member.usual = usual;

    saveMember(member);
    saveJSON(MEMBER_PHONE_KEY, member.phone);
    return { member, newStamp };
  }

  // One tap to rebuild yesterday's order — the easier the first step,
  // the more likely it happens.
  function orderUsual() {
    const member = getMember(rememberedPhone());
    const usual = member ? member.usual.filter((l) => productById(l.productId)) : [];
    if (!usual.length) { toast("No usual yet — place an order and we'll remember it"); return; }
    state.cart = usual.map((l) => ({ productId: l.productId, qty: l.qty }));
    renderProductGrid();
    renderCart();
    updateCartBadge();
    openCart();
  }

  /* ----------------------------------------------------------------- *
   *  Toasts
   * ----------------------------------------------------------------- */
  function toast(message) {
    const container = $("#toast-container");
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => el.remove(), 2400);
  }

  /* ----------------------------------------------------------------- *
   *  Screen routing
   * ----------------------------------------------------------------- */
  function goToScreen(name) {
    state.screen = name;
    $$(".screen").forEach((s) => s.classList.toggle("is-active", s.dataset.screen === name));
    $$(".nav-link").forEach((btn) => btn.classList.toggle("is-active", btn.dataset.go === name));
    closeCart();
    if (name === "menu") renderStreakBanner();
    if (name === "rewards") showRememberedRewards();
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  /* ----------------------------------------------------------------- *
   *  Branding
   * ----------------------------------------------------------------- */
  function renderBranding() {
    const b = CONTENT.business;
    $("#logo-icon").textContent = b.logoIcon || "☕";
    $("#logo-text").textContent = b.name;
    $("#hero-tagline").textContent = b.tagline;
    document.title = `${b.name} — Order Online`;
    $("#footer-business").textContent = `${b.name} · ${b.address}`;
    $("#footer-meta").textContent = `${b.phone} · ${b.hours}`;
  }

  /* ----------------------------------------------------------------- *
   *  Brew Streak: menu banner + rewards screen
   * ----------------------------------------------------------------- */
  function streakHeadline(info) {
    if (info.orderedToday) return `🔥 ${info.streak}-day streak — today's stamp is in. See you tomorrow.`;
    if (info.streak > 0) return `🔥 ${info.streak}-day streak — order anything today to keep it going.`;
    return "Start a new streak today — any order counts.";
  }

  function renderStreakBanner() {
    const member = getMember(rememberedPhone());
    const banner = $("#streak-banner");
    if (!member) {
      banner.innerHTML = `
        <div class="streak-banner-text">
          <strong>☕ ${escapeHtml(LOYALTY.programName)}: a free drink every ${LOYALTY.stampsForReward} days you visit</strong>
          <span>One stamp per day you order, whatever you spend. Your first order starts your streak.</span>
        </div>
        <div class="streak-banner-actions">
          <button class="btn btn-ghost" data-go="rewards" type="button">How it works</button>
        </div>`;
      banner.hidden = false;
      return;
    }
    const info = streakInfo(member);
    const s = stampInfo(member);
    const perks = [];
    if (s.available > 0) perks.push(`${s.available} free drink${s.available > 1 ? "s" : ""} ready`);
    if (passReadyToday(member)) perks.push(`today's ${PASS.name} drink is waiting`);
    banner.innerHTML = `
      <div class="streak-banner-text">
        <strong>Hi ${escapeHtml(member.name.split(" ")[0])} · ${streakHeadline(info)}</strong>
        <span>${s.progress}/${LOYALTY.stampsForReward} stamps to your next free drink${perks.length ? " · " + perks.join(" · ") : ""}</span>
      </div>
      <div class="streak-banner-actions">
        ${member.usual.length ? `<button class="btn btn-primary" data-usual type="button">Order my usual</button>` : ""}
        <button class="btn btn-ghost" data-go="rewards" type="button">My rewards</button>
      </div>`;
    banner.hidden = false;
  }

  function renderPassCard() {
    const product = productById(PASS.productId);
    $("#pass-card").innerHTML = `
      <p class="eyebrow">Set it once</p>
      <h2>${escapeHtml(PASS.name)}</h2>
      <p class="pass-price">${money(product.price)} <span>/ ${PASS.days} days</span></p>
      <p class="pass-desc">${escapeHtml(product.desc)} Covers one drink up to ${money(PASS.maxValue)} each day — the decision is already made, so you just show up.</p>
      <button class="btn btn-primary" data-add="${PASS.productId}" type="button">Add pass to cart</button>`;
  }

  function renderHowItWorks() {
    const steps = [
      ["Show up, don't splurge", `One stamp per day you order, whatever you spend. Every ${LOYALTY.stampsForReward} stamps = a free drink (up to ${money(LOYALTY.rewardMaxValue)}).`],
      ["The minimum still counts", `Busy day? Even a ${money(cheapestItemPrice())} item keeps your streak alive.`],
      ["Bad days are planned for", `Miss one day and your streak survives — one rest day every ${LOYALTY.restDayWindow} days. Miss two in a row and it resets.`],
      ["Your usual, one tap", "We remember your last order, so tomorrow's is a single tap from the menu."],
      ["See the chain", "Your last four weeks on one calendar. The longer it gets, the less you want to break it."],
    ];
    $("#how-list").innerHTML = steps.map(([t, d]) => `<li><strong>${t}</strong><span>${d}</span></li>`).join("");
  }

  function calendarHTML(member, info) {
    const visits = new Set(member.visitDays);
    const rests = new Set(info.restDays);
    const today = todayKey();
    const cells = [];
    for (let i = 27; i >= 0; i--) {
      const k = addDays(today, -i);
      const cls = visits.has(k) ? "visit" : rests.has(k) ? "rest" : "";
      const label = visits.has(k) ? "ordered" : rests.has(k) ? "rest day" : "no order";
      cells.push(`<div class="cal-cell ${cls} ${k === today ? "today" : ""}" title="${prettyDate(k)} — ${label}">${parseKey(k).getDate()}</div>`);
    }
    return `<div class="cal-grid">${cells.join("")}</div>
      <div class="cal-legend"><span><i class="cal-key visit"></i>Ordered</span><span><i class="cal-key rest"></i>Rest day</span><span><i class="cal-key today"></i>Today</span></div>`;
  }

  function renderRewards(member) {
    const info = streakInfo(member);
    const s = stampInfo(member);
    const stampsHTML = Array.from({ length: LOYALTY.stampsForReward }, (_, i) =>
      `<div class="stamp ${i < s.progress ? "filled" : ""}">${i < s.progress ? "☕" : i + 1}</div>`).join("");
    const passLine = passActive(member)
      ? `<p class="pass-status active">${escapeHtml(PASS.name)} active until ${prettyDate(member.passUntil)} · ${passReadyToday(member) ? "today's drink is waiting" : "today's drink used"}</p>`
      : "";

    $("#rewards-title").textContent = `${member.name.split(" ")[0]}'s ${LOYALTY.programName}`;
    $("#rewards-result").innerHTML = `
      <p class="rewards-headline">${streakHeadline(info)}</p>
      <div class="rewards-stats">
        <div><strong>${info.streak}</strong><span>day streak</span></div>
        <div><strong>${s.stamps}</strong><span>total stamps</span></div>
        <div><strong>${s.available}</strong><span>free drink${s.available === 1 ? "" : "s"} ready</span></div>
      </div>
      ${passLine}
      <h3>Stamp card <span>${s.progress}/${LOYALTY.stampsForReward}</span></h3>
      <div class="stamp-card">${stampsHTML}</div>
      <h3>Last 4 weeks</h3>
      ${calendarHTML(member, info)}
      <div class="rewards-actions">
        ${member.usual.length ? `<button class="btn btn-primary" data-usual type="button">Order my usual</button>` : ""}
        <button class="btn btn-ghost" data-forget type="button">Not you? Switch number</button>
      </div>`;
    $("#rewards-result").hidden = false;
    $("#rewards-error").hidden = true;
    $("#rewards-form").hidden = true;
  }

  function resetRewards() {
    $("#rewards-title").textContent = "Rewards";
    $("#rewards-result").hidden = true;
    $("#rewards-error").hidden = true;
    $("#rewards-form").hidden = false;
    $("#rewards-input").value = "";
  }

  function showRememberedRewards() {
    const member = getMember(rememberedPhone());
    if (member) renderRewards(member);
    else resetRewards();
  }

  function lookupRewards(phone) {
    const member = getMember(phone);
    if (!member) { $("#rewards-result").hidden = true; $("#rewards-error").hidden = false; return; }
    saveJSON(MEMBER_PHONE_KEY, member.phone);
    renderRewards(member);
    renderStreakBanner();
  }

  /* ----------------------------------------------------------------- *
   *  Menu: categories + product grid
   * ----------------------------------------------------------------- */
  function renderCategoryTabs() {
    $("#category-tabs").innerHTML = CONTENT.categories.map((c) =>
      `<button type="button" class="category-tab ${c.id === state.category ? "active" : ""}" data-cat="${c.id}" role="tab" aria-selected="${c.id === state.category}">${escapeHtml(c.name)}</button>`
    ).join("");
    $$(".category-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.category = btn.dataset.cat;
        renderCategoryTabs();
        renderProductGrid();
      });
    });
  }

  function cartQtyFor(productId) {
    const line = state.cart.find((l) => l.productId === productId);
    return line ? line.qty : 0;
  }

  function renderProductGrid() {
    const list = CONTENT.products.filter((p) => p.category === state.category);
    $("#product-grid").innerHTML = list.map((p) => {
      const qty = cartQtyFor(p.id);
      return `
      <article class="product-card" data-product="${p.id}">
        <div class="product-image"><img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" loading="lazy" onerror="this.closest('.product-image').style.background='var(--surface-tint)'; this.remove();"></div>
        <div class="product-body">
          <h3>${escapeHtml(p.name)}</h3>
          <p class="product-desc">${escapeHtml(p.desc)}</p>
          <div class="product-footer">
            <span class="product-price">${money(p.price)}</span>
            <div class="product-cta" data-cta="${p.id}">
              ${qty > 0 ? qtyStepperHTML(p.id, qty) : `<button class="add-btn" data-add="${p.id}" type="button">Add to cart</button>`}
            </div>
          </div>
        </div>
      </article>`;
    }).join("");
  }

  function qtyStepperHTML(productId, qty) {
    return `<div class="qty-stepper">
      <button type="button" data-decr="${productId}" aria-label="Decrease quantity">−</button>
      <span>${qty}</span>
      <button type="button" data-incr="${productId}" aria-label="Increase quantity">+</button>
    </div>`;
  }

  function refreshProductCTA(productId) {
    const cta = $(`.product-cta[data-cta="${productId}"]`);
    if (!cta) return;
    const qty = cartQtyFor(productId);
    cta.innerHTML = qty > 0 ? qtyStepperHTML(productId, qty) : `<button class="add-btn" data-add="${productId}" type="button">Add to cart</button>`;
  }

  /* ----------------------------------------------------------------- *
   *  Cart
   * ----------------------------------------------------------------- */
  function addToCart(productId, qty) {
    qty = qty || 1;
    const line = state.cart.find((l) => l.productId === productId);
    if (line) line.qty += qty;
    else state.cart.push({ productId, qty });
    refreshProductCTA(productId);
    renderCart();
    updateCartBadge();
    toast(`Added ${productById(productId)?.name || "item"} to cart`);
  }

  function changeQty(productId, delta) {
    const line = state.cart.find((l) => l.productId === productId);
    if (!line) return;
    line.qty += delta;
    if (line.qty <= 0) state.cart = state.cart.filter((l) => l.productId !== productId);
    refreshProductCTA(productId);
    renderCart();
    updateCartBadge();
  }

  function removeFromCart(productId) {
    state.cart = state.cart.filter((l) => l.productId !== productId);
    refreshProductCTA(productId);
    renderCart();
    updateCartBadge();
  }

  function cartTotal() {
    return state.cart.reduce((sum, line) => {
      const p = productById(line.productId);
      return sum + (p ? p.price * line.qty : 0);
    }, 0);
  }

  function cartCount() {
    return state.cart.reduce((sum, line) => sum + line.qty, 0);
  }

  function updateCartBadge() {
    const n = cartCount();
    const badge = $("#cart-badge");
    badge.textContent = String(n);
    badge.hidden = n === 0;
  }

  function renderCart() {
    const hasItems = state.cart.length > 0;
    $("#cart-empty").hidden = hasItems;
    $("#cart-footer").hidden = !hasItems;
    $("#cart-items").innerHTML = state.cart.map((line) => {
      const p = productById(line.productId);
      if (!p) return "";
      return `
      <div class="cart-item" data-product="${p.id}">
        <div class="cart-item-img"><img src="${escapeHtml(p.image)}" alt="" onerror="this.style.display='none';"></div>
        <div class="cart-item-info">
          <h4>${escapeHtml(p.name)}</h4>
          <div class="cart-item-price">${money(p.price)} each</div>
          <div class="cart-item-actions">
            <div class="qty-stepper">
              <button type="button" data-decr="${p.id}" aria-label="Decrease quantity">−</button>
              <span>${line.qty}</span>
              <button type="button" data-incr="${p.id}" aria-label="Increase quantity">+</button>
            </div>
            <button class="remove-btn" data-remove="${p.id}" type="button">Remove</button>
          </div>
        </div>
      </div>`;
    }).join("");
    $("#cart-total").textContent = money(cartTotal());
  }

  function openCart() {
    $("#cart-drawer").classList.add("is-open");
    $("#cart-drawer").setAttribute("aria-hidden", "false");
    $("#cart-backdrop").hidden = false;
  }
  function closeCart() {
    $("#cart-drawer").classList.remove("is-open");
    $("#cart-drawer").setAttribute("aria-hidden", "true");
    $("#cart-backdrop").hidden = true;
  }

  /* ----------------------------------------------------------------- *
   *  Checkout
   * ----------------------------------------------------------------- */
  function initCheckoutSelects() {
    $("#co-type").innerHTML = CONTENT.orderTypes.map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("");
    $("#co-privacy").textContent = CONTENT.privacyNote;
    $("#co-payment").innerHTML =CONTENT.paymentMethods.map((p) => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join("");
  }

  function renderCheckoutSummary() {
    $("#summary-items").innerHTML = state.cart.map((line) => {
      const p = productById(line.productId);
      if (!p) return "";
      return `<div class="summary-item"><span>${line.qty} × ${escapeHtml(p.name)}</span><span>${money(p.price * line.qty)}</span></div>`;
    }).join("");
    const member = getMember($("#co-phone").value);
    const pricing = computePricing(member, state.useReward);
    renderPerks(member);
    $("#summary-totals").innerHTML = `
      ${pricing.discounts.length ? `<div class="summary-line"><span>Subtotal</span><span>${money(pricing.subtotal)}</span></div>` : ""}
      ${pricing.discounts.map((d) => `<div class="summary-line discount"><span>${escapeHtml(d.label)}</span><span>−${money(d.amount)}</span></div>`).join("")}
      <div class="summary-grand"><span>Total</span><strong>${money(pricing.total)}</strong></div>`;
    $("#place-order-btn").disabled = state.cart.length === 0;
  }

  function renderPerks(member) {
    const box = $("#perks-box");
    if (!member) { box.hidden = true; return; }
    const info = streakInfo(member);
    const s = stampInfo(member);
    const nextStreak = info.orderedToday ? info.streak : info.streak + 1;
    box.innerHTML = `
      <p><strong>🔥 ${info.orderedToday ? `${info.streak}-day streak` : `This order makes it a ${nextStreak}-day streak`}</strong></p>
      <p>${s.progress}/${LOYALTY.stampsForReward} stamps${info.orderedToday ? " · today's stamp already collected" : " · this order adds one"}</p>
      ${s.available > 0 ? `<label class="perk-toggle"><input type="checkbox" id="use-reward" ${state.useReward ? "checked" : ""}> Use a free drink reward (${s.available} available)</label>` : ""}`;
    box.hidden = false;
  }

  function goToCheckout() {
    if (state.cart.length === 0) {
      toast("Your cart is empty — add something first");
      return;
    }
    // Returning members skip retyping their details.
    const member = getMember(rememberedPhone());
    if (member && !$("#co-phone").value.trim()) {
      $("#co-phone").value = member.phone;
      if (!$("#co-name").value.trim()) $("#co-name").value = member.name;
    }
    renderCheckoutSummary();
    goToScreen("checkout");
  }

  function nextOrderNumber() {
    const seq = (loadJSON(SEQ_KEY, 0) || 0) + 1;
    saveJSON(SEQ_KEY, seq);
    return "#" + String(seq).padStart(3, "0");
  }

  function validateCheckoutForm() {
    let valid = true;
    const nameInput = $("#co-name");
    const phoneInput = $("#co-phone");
    if (!nameInput.value.trim()) { $("#co-name-error").textContent = "Please enter your name."; valid = false; }
    else { $("#co-name-error").textContent = ""; }
    if (!phoneInput.value.trim()) { $("#co-phone-error").textContent = "Please enter a contact number."; valid = false; }
    else if (!/^[0-9+\-\s]{6,}$/.test(phoneInput.value.trim())) { $("#co-phone-error").textContent = "That doesn't look like a valid number."; valid = false; }
    else { $("#co-phone-error").textContent = ""; }
    return valid;
  }

  function placeOrder() {
    if (state.cart.length === 0) { toast("Your cart is empty"); return; }
    if (!validateCheckoutForm()) return;

    const phone = $("#co-phone").value.trim();
    const pricing = computePricing(getMember(phone), state.useReward);
    const orderNumber = nextOrderNumber();
    const order = {
      orderNumber,
      customerName: $("#co-name").value.trim(),
      phone,
      orderType: $("#co-type").value,
      paymentMethod: $("#co-payment").value,
      items: state.cart.map((line) => {
        const p = productById(line.productId);
        return { id: p.id, name: p.name, price: p.price, qty: line.qty };
      }),
      subtotal: pricing.subtotal,
      discounts: pricing.discounts,
      total: pricing.total,
      status: CONTENT.orderStatuses[0], // "NEW"
      createdAt: new Date().toISOString(),
    };

    const orders = loadJSON(ORDERS_KEY, []);
    orders.push(order);
    saveJSON(ORDERS_KEY, orders);

    const visit = recordVisit(order, pricing);
    if (CONTENT.kioskMode) saveJSON(MEMBER_PHONE_KEY, null); // shared tablet: next customer starts clean

    state.lastOrderNumber = orderNumber;
    state.cart = [];
    state.useReward = true;
    renderCart();
    updateCartBadge();
    renderProductGrid();

    $("#confirm-order-number").textContent = orderNumber;
    $("#confirm-status-pill").textContent = order.status;
    renderConfirmLoyalty(visit.member, visit.newStamp);
    $("#checkout-form").reset();
    goToScreen("confirmation");
  }

  function renderConfirmLoyalty(member, newStamp) {
    const info = streakInfo(member);
    const s = stampInfo(member);
    const justEarned = newStamp && s.progress === 0;
    $("#confirm-loyalty").innerHTML = `
      <strong>🔥 ${info.streak}-day streak</strong>
      <span>${justEarned ? "Stamp card complete — a free drink is waiting on your next order." : `${s.progress}/${LOYALTY.stampsForReward} stamps to your next free drink.`}</span>`;
    $("#confirm-loyalty").hidden = false;
  }

  /* ----------------------------------------------------------------- *
   *  Order tracking
   * ----------------------------------------------------------------- */
  function findOrder(orderNumber) {
    const orders = loadJSON(ORDERS_KEY, []);
    const normalized = orderNumber.trim().replace(/^#*/, "#");
    return orders.find((o) => o.orderNumber.toLowerCase() === normalized.toLowerCase());
  }

  function renderTrackingResult(order) {
    const statuses = CONTENT.orderStatuses;
    const currentIndex = statuses.indexOf(order.status);
    const stepsHTML = statuses.map((s, i) => {
      const cls = i < currentIndex ? "done" : i === currentIndex ? "current" : "";
      const dotContent = i < currentIndex ? "✓" : (i + 1);
      return `<div class="status-step ${cls}"><div class="dot">${dotContent}</div><div class="label">${escapeHtml(s)}</div></div>`;
    }).join("");

    const itemsHTML = order.items.map((it) => `<div class="tracking-item-row"><span>${it.qty} × ${escapeHtml(it.name)}</span><span>${money(it.price * it.qty)}</span></div>`).join("");

    $("#tracking-result").innerHTML = `
      <div class="tracking-order-number">${escapeHtml(order.orderNumber)}</div>
      <div class="tracking-meta">${escapeHtml(order.customerName)} · ${escapeHtml(order.orderType)} · placed ${new Date(order.createdAt).toLocaleString()}</div>
      <div class="status-steps">${stepsHTML}</div>
      <div class="tracking-items">
        ${itemsHTML}
        ${(order.discounts || []).map((d) => `<div class="tracking-item-row discount"><span>${escapeHtml(d.label)}</span><span>−${money(d.amount)}</span></div>`).join("")}
        <div class="tracking-totals-row"><span>Total</span><span>${money(order.total)}</span></div>
      </div>`;
    $("#tracking-result").hidden = false;
    $("#tracking-error").hidden = true;
  }

  function trackOrder(rawNumber) {
    const order = findOrder(rawNumber);
    if (!order) {
      $("#tracking-result").hidden = true;
      $("#tracking-error").hidden = false;
      return;
    }
    renderTrackingResult(order);
  }

  /* ----------------------------------------------------------------- *
   *  Global event delegation
   * ----------------------------------------------------------------- */
  function initEvents() {
    document.addEventListener("click", (e) => {
      const goBtn = e.target.closest("[data-go]");
      const addBtn = e.target.closest("[data-add]");
      const incrBtn = e.target.closest("[data-incr]");
      const decrBtn = e.target.closest("[data-decr]");
      const removeBtn = e.target.closest("[data-remove]");
      const usualBtn = e.target.closest("[data-usual]");
      const forgetBtn = e.target.closest("[data-forget]");

      if (goBtn) { e.preventDefault(); goToScreen(goBtn.dataset.go); }
      if (addBtn) addToCart(addBtn.dataset.add, 1);
      if (incrBtn) changeQty(incrBtn.dataset.incr, 1);
      if (decrBtn) changeQty(decrBtn.dataset.decr, -1);
      if (removeBtn) removeFromCart(removeBtn.dataset.remove);
      if (usualBtn) orderUsual();
      if (forgetBtn) { saveJSON(MEMBER_PHONE_KEY, null); resetRewards(); renderStreakBanner(); }
    });

    $("#co-phone").addEventListener("input", renderCheckoutSummary);
    document.addEventListener("change", (e) => {
      if (e.target.id === "use-reward") { state.useReward = e.target.checked; renderCheckoutSummary(); }
    });

    $("#rewards-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const val = $("#rewards-input").value.trim();
      if (val) lookupRewards(val);
    });

    $("#cart-open-btn").addEventListener("click", openCart);
    $("#cart-close-btn").addEventListener("click", closeCart);
    $("#cart-backdrop").addEventListener("click", closeCart);
    $("#cart-checkout-btn").addEventListener("click", goToCheckout);
    $("#place-order-btn").addEventListener("click", placeOrder);

    $("#confirm-track-btn").addEventListener("click", () => {
      $("#track-input").value = state.lastOrderNumber || "";
      goToScreen("tracking");
      if (state.lastOrderNumber) trackOrder(state.lastOrderNumber);
    });

    $("#tracking-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const val = $("#track-input").value.trim();
      if (!val) return;
      trackOrder(val);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeCart();
    });
  }

  /* ----------------------------------------------------------------- *
   *  Boot
   * ----------------------------------------------------------------- */
  function init() {
    renderBranding();
    renderCategoryTabs();
    renderProductGrid();
    renderCart();
    updateCartBadge();
    initCheckoutSelects();
    renderStreakBanner();
    renderPassCard();
    renderHowItWorks();
    initEvents();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
