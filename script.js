/* =========================================================================
   THE DAILY BREW — script.js
   Customer ordering flow: browse → cart → checkout → place order → track.
   Orders are persisted to localStorage under ORDERS_KEY in a structure
   designed so a future staff page can read and update the same data.
   ========================================================================= */

(function () {
  "use strict";

  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));
  const escapeHtml = (str) => String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (n) => `$${n.toFixed(2)}`;
  const productById = (id) => CONTENT.products.find((p) => p.id === id);

  const ORDERS_KEY = "dailybrew_orders";
  const SEQ_KEY = "dailybrew_order_seq";

  function loadJSON(key, fallback) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
    catch (e) { return fallback; }
  }
  function saveJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage unavailable */ }
  }

  /* ----------------------------------------------------------------- *
   *  State
   * ----------------------------------------------------------------- */
  const state = {
    screen: "menu",
    category: CONTENT.categories[0].id,
    cart: [], // [{ productId, qty }]
    lastOrderNumber: null,
  };

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
    $("#co-payment").innerHTML = CONTENT.paymentMethods.map((p) => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join("");
  }

  function renderCheckoutSummary() {
    $("#summary-items").innerHTML = state.cart.map((line) => {
      const p = productById(line.productId);
      if (!p) return "";
      return `<div class="summary-item"><span>${line.qty} × ${escapeHtml(p.name)}</span><span>${money(p.price * line.qty)}</span></div>`;
    }).join("");
    $("#summary-totals").innerHTML = `<span>Total</span><strong>${money(cartTotal())}</strong>`;
    $("#place-order-btn").disabled = state.cart.length === 0;
  }

  function goToCheckout() {
    if (state.cart.length === 0) {
      toast("Your cart is empty — add something first");
      return;
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

    const orderNumber = nextOrderNumber();
    const order = {
      orderNumber,
      customerName: $("#co-name").value.trim(),
      phone: $("#co-phone").value.trim(),
      orderType: $("#co-type").value,
      paymentMethod: $("#co-payment").value,
      items: state.cart.map((line) => {
        const p = productById(line.productId);
        return { id: p.id, name: p.name, price: p.price, qty: line.qty };
      }),
      total: cartTotal(),
      status: CONTENT.orderStatuses[0], // "NEW"
      createdAt: new Date().toISOString(),
    };

    const orders = loadJSON(ORDERS_KEY, []);
    orders.push(order);
    saveJSON(ORDERS_KEY, orders);

    state.lastOrderNumber = orderNumber;
    state.cart = [];
    renderCart();
    updateCartBadge();
    renderProductGrid();

    $("#confirm-order-number").textContent = orderNumber;
    $("#confirm-status-pill").textContent = order.status;
    $("#checkout-form").reset();
    goToScreen("confirmation");
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

      if (goBtn) { e.preventDefault(); goToScreen(goBtn.dataset.go); }
      if (addBtn) addToCart(addBtn.dataset.add, 1);
      if (incrBtn) changeQty(incrBtn.dataset.incr, 1);
      if (decrBtn) changeQty(decrBtn.dataset.decr, -1);
      if (removeBtn) removeFromCart(removeBtn.dataset.remove);
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
    initEvents();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
