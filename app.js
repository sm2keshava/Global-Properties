/* =====================================================================
   Global Properties — front-end interactions (vanilla JS, no deps)
   Scope: view switching, cashback tier editing, live payout simulator,
   modal open/close. Presentation-layer only — no data persistence.
   ===================================================================== */
(function () {
  "use strict";

  /* ---------- View / navigation ---------- */
  var VIEW_META = {
    dashboard:     { title: "Dashboard",            sub: "Wallet, cashback, team & weekly payout at a glance" },
    packages:      { title: "Membership Packages",  sub: "Silver, Gold & Diamond club plans in USD" },
    farmland:      { title: "My Properties",        sub: "Every property, its details, and its registered owner" },
    registrations: { title: "Investments",          sub: "Link members to property and record capital allocations" },
    cashback:      { title: "Working Income Plan",  sub: "Daily cashback, direct referral & 5-level income" },
    wallet:        { title: "Wallet",               sub: "Balance, withdrawals, P2P transfers & payout schedule" },
    team:          { title: "Team & Referrals",     sub: "Invite, share on WhatsApp, and grow your network" },
    rewards:       { title: "Rewards & Challenges",  sub: "Level reward ladder and weekly challenges" },
    investors:     { title: "Investors",            sub: "Members, capital committed and income levels" }
  };

  var navItems = document.querySelectorAll(".nav__item");
  var views = document.querySelectorAll(".view");
  var titleEl = document.getElementById("viewTitle");
  var subEl = document.getElementById("viewSub");
  var sidebar = document.getElementById("sidebar");

  function switchView(name) {
    navItems.forEach(function (b) { b.classList.toggle("is-active", b.dataset.view === name); });
    views.forEach(function (v) { v.classList.toggle("is-active", v.id === "view-" + name); });
    var meta = VIEW_META[name];
    if (meta) { titleEl.textContent = meta.title; subEl.textContent = meta.sub; }
    sidebar.classList.remove("is-open");
    var scroll = document.querySelector(".scroll");
    if (scroll) scroll.scrollTop = 0;
  }

  navItems.forEach(function (btn) {
    btn.addEventListener("click", function () { switchView(btn.dataset.view); });
  });

  // In-page links that jump to a view (topbar CTA, wallet chip, dashboard buttons).
  document.querySelectorAll("[data-view-link]").forEach(function (el) {
    el.addEventListener("click", function () { switchView(el.dataset.viewLink); });
  });

  /* ---------- Mobile menu ---------- */
  var menuBtn = document.getElementById("menuBtn");
  if (menuBtn) menuBtn.addEventListener("click", function () { sidebar.classList.toggle("is-open"); });

  /* ---------- Segmented + chip toggles (visual) ---------- */
  function wireToggleGroup(selector, activeClass) {
    document.querySelectorAll(selector).forEach(function (group) {
      group.addEventListener("click", function (e) {
        var btn = e.target.closest("button");
        if (!btn || !group.contains(btn)) return;
        Array.prototype.forEach.call(group.children, function (c) { c.classList.remove(activeClass); });
        btn.classList.add(activeClass);
      });
    });
  }
  wireToggleGroup(".seg", "is-active");
  wireToggleGroup(".chips", "is-active");

  /* ---------- Cashback tiers ---------- */
  // Baseline investment volume per tier (millions committed) — drives the
  // payout simulator. Presentation figures only.
  var TIER_VOLUME_M = { 1: 4.2, 2: 9.8, 3: 12.5, 4: 10.4, 5: 11.8 };
  var TIER_LABEL = { 1: "Direct", 2: "Growth", 3: "Builder", 4: "Leader", 5: "Director" };
  var DEFAULT_PCT = { 1: 3, 2: 2, 3: 1, 4: 0.5, 5: 0.5 };

  var tierCards = document.querySelectorAll(".tier-card");
  var simBars = document.getElementById("simBars");
  var simTotal = document.getElementById("simTotal");

  function getPct(level) {
    var card = document.querySelector('.tier-card[data-level="' + level + '"]');
    return card ? parseFloat(card.querySelector(".pct-input").value) || 0 : 0;
  }

  function renderSimulator() {
    if (!simBars) return;
    var payouts = {}, max = 0, total = 0;
    for (var lvl = 1; lvl <= 5; lvl++) {
      var p = (TIER_VOLUME_M[lvl] * getPct(lvl)) / 100; // $M annual cashback
      payouts[lvl] = p;
      total += p;
      if (p > max) max = p;
    }
    var html = "";
    for (var l = 1; l <= 5; l++) {
      var h = max > 0 ? Math.max(6, (payouts[l] / max) * 100) : 6;
      html +=
        '<div class="sim__col sim__col--' + l + '">' +
          '<span class="sim__val">$' + payouts[l].toFixed(2) + "M</span>" +
          '<div class="sim__bar" style="height:' + h + '%"></div>' +
          '<span class="sim__lbl">' + TIER_LABEL[l] + "</span>" +
        "</div>";
    }
    simBars.innerHTML = html;
    if (simTotal) simTotal.textContent = "Total ≈ $" + total.toFixed(2) + "M / yr";
  }

  // Keep the number input and range slider in sync per card, then re-render.
  tierCards.forEach(function (card) {
    var num = card.querySelector(".pct-input");
    var range = card.querySelector(".range");
    if (!num || !range) return;

    function sync(source) {
      var v = parseFloat(source.value);
      if (isNaN(v)) return;
      v = Math.min(100, Math.max(0, v));
      num.value = source === range ? v.toFixed(1) : v;
      range.value = Math.min(parseFloat(range.max), v);
      renderSimulator();
    }
    range.addEventListener("input", function () { sync(range); });
    num.addEventListener("input", function () { sync(num); });
  });

  var resetBtn = document.getElementById("resetCashback");
  if (resetBtn) {
    resetBtn.addEventListener("click", function () {
      tierCards.forEach(function (card) {
        var lvl = card.dataset.level;
        card.querySelector(".pct-input").value = DEFAULT_PCT[lvl].toFixed(1);
        card.querySelector(".range").value = DEFAULT_PCT[lvl];
      });
      renderSimulator();
      toast("Level income rates reset to defaults");
    });
  }

  var saveBtn = document.getElementById("saveCashback");
  if (saveBtn) {
    saveBtn.addEventListener("click", function () {
      var rates = [1, 2, 3, 4, 5].map(function (l) { return "L" + l + " " + getPct(l) + "%"; });
      toast("Configuration saved — " + rates.join("  ·  "));
    });
  }

  renderSimulator();

  /* ---------- Custom select (glassmorphic replacement for native <select>) ---------- */
  var openSelect = null;

  function closeSelect() {
    if (openSelect) { openSelect.classList.remove("is-open"); openSelect = null; }
  }

  function enhanceSelect(wrapper) {
    var native = wrapper.querySelector("select");
    if (!native) return;
    native.classList.add("select__native");
    native.setAttribute("tabindex", "-1");
    native.setAttribute("aria-hidden", "true");

    var trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "select__trigger";
    var value = document.createElement("span");
    value.className = "select__value";
    var caret = document.createElement("span");
    caret.className = "select__caret";
    trigger.appendChild(value);
    trigger.appendChild(caret);

    var menu = document.createElement("div");
    menu.className = "select__menu";
    menu.setAttribute("role", "listbox");

    function paintValue() {
      var opt = native.options[native.selectedIndex];
      value.textContent = opt ? opt.textContent : "";
      var placeholder = opt && (/^—|^-\s|leave unassigned/i.test(opt.textContent));
      value.classList.toggle("select__value--placeholder", !!placeholder);
    }

    Array.prototype.forEach.call(native.options, function (opt, i) {
      var item = document.createElement("button");
      item.type = "button";
      item.className = "select__option";
      item.setAttribute("role", "option");
      item.textContent = opt.textContent;
      if (opt.selected) item.classList.add("is-selected");
      item.addEventListener("click", function () {
        native.selectedIndex = i;
        menu.querySelectorAll(".select__option").forEach(function (o) { o.classList.remove("is-selected"); });
        item.classList.add("is-selected");
        paintValue();
        native.dispatchEvent(new Event("change", { bubbles: true }));
        closeSelect();
        trigger.focus();
      });
      menu.appendChild(item);
    });

    function toggle() {
      var isOpen = wrapper.classList.contains("is-open");
      closeSelect();
      if (isOpen) return;
      // Flip upward when there isn't enough room below (e.g. bottom of a modal).
      var rect = trigger.getBoundingClientRect();
      var spaceBelow = window.innerHeight - rect.bottom;
      menu.classList.toggle("is-up", spaceBelow < 260 && rect.top > spaceBelow);
      wrapper.classList.add("is-open");
      openSelect = wrapper;
    }

    trigger.addEventListener("click", toggle);
    wrapper.appendChild(trigger);
    wrapper.appendChild(menu);
    paintValue();
  }

  document.querySelectorAll(".select").forEach(enhanceSelect);

  // Dismiss on outside click, Escape, or scroll.
  document.addEventListener("click", function (e) {
    if (openSelect && !openSelect.contains(e.target)) closeSelect();
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeSelect(); });
  var scrollRegion = document.querySelector(".scroll");
  if (scrollRegion) scrollRegion.addEventListener("scroll", closeSelect, true);

  /* ---------- Modals ---------- */
  function openModal(name) {
    var m = document.getElementById("modal-" + name);
    if (m) { m.classList.add("is-open"); m.setAttribute("aria-hidden", "false"); }
  }
  function closeModals() {
    document.querySelectorAll(".modal.is-open").forEach(function (m) {
      m.classList.remove("is-open");
      m.setAttribute("aria-hidden", "true");
    });
  }
  document.querySelectorAll("[data-open-modal]").forEach(function (btn) {
    btn.addEventListener("click", function () { openModal(btn.dataset.openModal); });
  });
  document.querySelectorAll("[data-close-modal]").forEach(function (el) {
    el.addEventListener("click", closeModals);
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeModals(); });

  /* ---------- Helpers ---------- */
  function num(str) { return parseFloat(String(str).replace(/[^0-9.]/g, "")) || 0; }
  function money(n) { return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  /* ---------- Wallet: withdrawal fee calculator (10%) ---------- */
  var FEE = 0.10;
  var wdAmt = document.getElementById("wdAmt");
  var wdMethod = document.getElementById("wdMethod");
  function renderWithdraw() {
    if (!wdAmt) return;
    var amt = num(wdAmt.value);
    var fee = amt * FEE;
    var set = function (id, v) { var e = document.getElementById(id); if (e) e.textContent = v; };
    set("wdReq", money(amt));
    set("wdFee", "−" + money(fee));
    set("wdNet", money(amt - fee));
  }
  if (wdAmt) wdAmt.addEventListener("input", renderWithdraw);
  if (wdMethod) wdMethod.addEventListener("change", function () {
    var inr = /INR/.test(wdMethod.value);
    var label = document.getElementById("wdDestLabel");
    if (label) label.textContent = inr ? "Bank account / UPI" : "Wallet address (BEP-20)";
  });
  var submitWd = document.getElementById("submitWithdraw");
  if (submitWd) submitWd.addEventListener("click", function () {
    toast("Withdrawal requested — paid Monday 10 AM–4 PM");
  });
  renderWithdraw();

  /* ---------- Invest → generate welcome letter ---------- */
  var NAMES = ["Ananya R.", "Rohit S.", "Meera K.", "Vikram J.", "Priya N.", "Arjun D."];
  document.querySelectorAll("[data-open-modal='invest'][data-pkg]").forEach(function (b) {
    b.addEventListener("click", function () {
      var sel = document.getElementById("investPkg");
      var amt = document.getElementById("investAmt");
      var pkg = b.dataset.pkg;
      var map = { Silver: "15,000", Gold: "30,000", Diamond: "45,000" };
      if (sel) { Array.prototype.forEach.call(sel.options, function (o, i) { if (o.textContent.indexOf(pkg) === 0) sel.selectedIndex = i; }); sel.dispatchEvent(new Event("change", { bubbles: true })); }
      if (amt) amt.value = map[pkg] || amt.value;
    });
  });
  var confirmInvest = document.getElementById("confirmInvest");
  if (confirmInvest) confirmInvest.addEventListener("click", function () {
    var sel = document.getElementById("investPkg");
    var amt = document.getElementById("investAmt");
    var pkg = sel ? sel.value.split("—")[0].trim() : "Gold";
    var id = "VG-" + (4000 + Math.floor(Math.random() * 999));
    var name = NAMES[Math.floor(Math.random() * NAMES.length)];
    var set = function (i, v) { var e = document.getElementById(i); if (e) e.textContent = v; };
    set("wlName", name); set("wlId", id); set("wlPass", "Vega@" + id.slice(3));
    set("wlPkg", pkg); set("wlAmt", "$" + (amt ? amt.value : "30,000"));
    closeModals();
    openModal("welcome");
  });

  /* ---------- Referral: copy & share ---------- */
  var REF = "https://vega.properties/join?ref=KV-3391";
  var SHARE_MSG = "Join me on VEGA Properties — invest, earn 1% daily cashback for 200 weeks, plus level income & rewards. " + REF;
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast("Link copied to clipboard"); }, fallbackCopy.bind(null, text));
    } else { fallbackCopy(text); }
  }
  function fallbackCopy(text) {
    var ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); toast("Link copied to clipboard"); } catch (e) { toast("Copy failed — select manually"); }
    document.body.removeChild(ta);
  }
  ["copyRef", "copyRef2", "copyRef3"].forEach(function (id) {
    var el = document.getElementById(id); if (el) el.addEventListener("click", function () { copyText(REF); });
  });
  function openShare(url) { window.open(url, "_blank", "noopener"); }
  ["shareWa", "shareWa2"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener("click", function () { openShare("https://wa.me/?text=" + encodeURIComponent(SHARE_MSG)); });
  });
  var tg = document.getElementById("shareTg");
  if (tg) tg.addEventListener("click", function () { openShare("https://t.me/share/url?url=" + encodeURIComponent(REF) + "&text=" + encodeURIComponent(SHARE_MSG)); });
  var mail = document.getElementById("shareMail");
  if (mail) mail.addEventListener("click", function () { openShare("mailto:?subject=" + encodeURIComponent("Join VEGA Properties") + "&body=" + encodeURIComponent(SHARE_MSG)); });

  /* ---------- Income mix: individual vs overall ---------- */
  var mixSeg = document.getElementById("mixSeg");
  if (mixSeg) {
    mixSeg.addEventListener("click", function (e) {
      var btn = e.target.closest("button"); if (!btn) return;
      var overall = /overall/i.test(btn.textContent);
      var total = document.getElementById("mixTotal");
      var sub = document.getElementById("mixSub");
      if (total) total.textContent = overall ? "$2.13M" : "$8,450";
      if (sub) sub.textContent = overall ? "All members combined · overall" : "Your earnings by source · individual";
    });
  }

  /* ---------- Weekly payout countdown (to next Sunday 23:59 cutoff) ---------- */
  function renderCountdown() {
    var d = document.getElementById("cdD"); if (!d) return;
    var now = new Date();
    var cutoff = new Date(now);
    var daysToSun = (7 - now.getDay()) % 7; // 0 = Sunday
    cutoff.setDate(now.getDate() + daysToSun);
    cutoff.setHours(23, 59, 0, 0);
    if (cutoff <= now) cutoff.setDate(cutoff.getDate() + 7);
    var diff = Math.max(0, cutoff - now);
    var pad = function (n) { return (n < 10 ? "0" : "") + n; };
    d.textContent = pad(Math.floor(diff / 86400000));
    document.getElementById("cdH").textContent = pad(Math.floor(diff / 3600000) % 24);
    document.getElementById("cdM").textContent = pad(Math.floor(diff / 60000) % 60);
  }
  renderCountdown();
  setInterval(renderCountdown, 30000);

  /* ---------- Toast (lightweight feedback) ---------- */
  var toastTimer;
  function toast(msg) {
    var t = document.getElementById("gp-toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "gp-toast";
      t.style.cssText =
        "position:fixed;left:50%;bottom:28px;transform:translateX(-50%) translateY(20px);" +
        "background:rgba(16,22,42,.92);backdrop-filter:blur(14px);color:#eef1fb;" +
        "border:1px solid rgba(12,166,120,.45);padding:13px 20px;border-radius:15px;" +
        "font:600 .86rem -apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',sans-serif;box-shadow:0 18px 50px rgba(0,0,0,.5);" +
        "z-index:100;opacity:0;transition:opacity .25s,transform .25s;max-width:90vw;text-align:center;";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    requestAnimationFrame(function () { t.style.opacity = "1"; t.style.transform = "translateX(-50%) translateY(0)"; });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      t.style.opacity = "0"; t.style.transform = "translateX(-50%) translateY(20px)";
    }, 2600);
  }
})();
