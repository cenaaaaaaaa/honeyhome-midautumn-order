// ============================================================
// 巧家麵包店 出貨系統 - 主程式
// ============================================================

const state = {
  screenStack: ["screen-password"],
  operator: sessionStorage.getItem("ff_operator") || "",
  orders: [], // 從資料窗口抓回來的所有訂單（快取）
  calendar: (() => { const now = new Date(); return { year: now.getFullYear(), month: now.getMonth() }; })(),
  viewMode: "calendar", // calendar | list
  currentDetailId: null,
};

// ---------------- 畫面切換 ----------------
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(el => el.classList.add("hidden"));
  const target = document.getElementById(id);
  if (target) target.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
}

function goTo(id) {
  state.screenStack.push(id);
  showScreen(id);
}

function goBack() {
  if (state.screenStack.length > 1) {
    state.screenStack.pop();
    showScreen(state.screenStack[state.screenStack.length - 1]);
  } else {
    showScreen("screen-menu");
  }
}

// ---------------- 資料窗口 API ----------------
function getPwd() {
  return localStorage.getItem("ff_pwd") || "";
}

async function apiGet(action, extraParams) {
  if (!FULFILLMENT_API.url) throw new Error("尚未設定出貨系統的網址（FULFILLMENT_API.url），請聯絡管理者");
  const params = new URLSearchParams({ action, pwd: getPwd(), ...(extraParams || {}) });
  const res = await fetch(`${FULFILLMENT_API.url}?${params.toString()}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "讀取失敗");
  return data;
}

async function apiPost(payload) {
  if (!FULFILLMENT_API.url) throw new Error("尚未設定出貨系統的網址（FULFILLMENT_API.url），請聯絡管理者");
  const res = await fetch(FULFILLMENT_API.url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" }, // 用 text/plain 避免瀏覽器先發預檢請求
    body: JSON.stringify({ ...payload, pwd: getPwd() }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "送出失敗");
  return data;
}

async function refreshOrders() {
  const data = await apiGet("orders");
  state.orders = data.orders || [];
  return state.orders;
}

// ---------------- 密碼畫面 ----------------
function initPasswordScreen() {
  const saved = getPwd();
  if (saved) {
    // 之前輸入過密碼，直接試著抓一次資料確認密碼還有效
    tryEnterWithSavedPassword();
    return;
  }
  showScreen("screen-password");
  bindPasswordSubmit();
}

async function tryEnterWithSavedPassword() {
  try {
    await refreshOrders();
    afterLogin();
  } catch (err) {
    localStorage.removeItem("ff_pwd");
    showScreen("screen-password");
    bindPasswordSubmit();
  }
}

function bindPasswordSubmit() {
  const submit = async () => {
    const pwd = document.getElementById("pwd-input").value.trim();
    if (!pwd) return;
    localStorage.setItem("ff_pwd", pwd);
    const errBox = document.getElementById("pwd-error");
    errBox.classList.add("hidden");
    try {
      await refreshOrders();
      afterLogin();
    } catch (err) {
      localStorage.removeItem("ff_pwd");
      errBox.textContent = "密碼不正確，或是還沒設定出貨系統網址，請再確認一次。";
      errBox.classList.remove("hidden");
    }
  };
  document.getElementById("pwd-submit").onclick = submit;
  document.getElementById("pwd-input").onkeydown = (e) => { if (e.key === "Enter") submit(); };
}

function afterLogin() {
  if (state.operator) {
    showScreen("screen-menu");
    initMenuScreen();
  } else {
    showScreen("screen-operator");
  }
}

// ---------------- 選操作人員 ----------------
function initOperatorScreen() {
  const grid = document.getElementById("operator-grid");
  grid.innerHTML = "";
  STAFF.forEach(name => {
    const btn = document.createElement("button");
    btn.className = "operator-btn";
    btn.textContent = name;
    btn.addEventListener("click", () => {
      state.operator = name;
      sessionStorage.setItem("ff_operator", name);
      showScreen("screen-menu");
      initMenuScreen();
    });
    grid.appendChild(btn);
  });
}

// ---------------- 功能選單 ----------------
function initMenuScreen() {
  document.getElementById("menu-operator-badge").textContent = `目前操作人：${state.operator}`;
  document.getElementById("btn-switch-operator").onclick = () => {
    state.operator = "";
    sessionStorage.removeItem("ff_operator");
    showScreen("screen-operator");
  };
  document.getElementById("btn-key-order").onclick = () => {
    initKeyOrderScreen();
    goTo("screen-key-order");
  };
  document.getElementById("btn-daily").onclick = async () => {
    goTo("screen-daily");
    await refreshOrdersAndRenderCalendar();
  };
  document.getElementById("btn-shipping").onclick = async () => {
    goTo("screen-daily");
    await refreshOrdersAndRenderCalendar();
  };
}

// ---------------- key 訂單 ----------------
function makeLineRow() {
  const tpl = document.getElementById("ko-line-template");
  const node = tpl.content.firstElementChild.cloneNode(true);
  const productSelect = node.querySelector(".ko-line-product");
  const flavorSelect = node.querySelector(".ko-line-flavor");

  FF_PRODUCTS.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.key;
    opt.textContent = p.name;
    productSelect.appendChild(opt);
  });

  const fillFlavors = () => {
    const product = FF_PRODUCTS.find(p => p.key === productSelect.value);
    flavorSelect.innerHTML = "";
    (product ? product.flavors : []).forEach(f => {
      const opt = document.createElement("option");
      opt.value = f;
      opt.textContent = f;
      flavorSelect.appendChild(opt);
    });
  };
  productSelect.addEventListener("change", fillFlavors);
  fillFlavors();

  node.querySelector(".ko-line-remove").addEventListener("click", () => node.remove());
  return node;
}

function initKeyOrderScreen() {
  document.getElementById("ko-operator").value = state.operator;
  document.getElementById("ko-result").classList.add("hidden");
  document.getElementById("key-order-form").classList.remove("hidden");
  document.getElementById("key-order-form").reset();
  document.getElementById("ko-operator").value = state.operator;

  const methodRow = document.getElementById("ko-method-row");
  methodRow.innerHTML = "";
  PICKUP_METHODS.forEach((m, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "size-chip" + (idx === 0 ? " active" : "");
    btn.textContent = m;
    btn.dataset.method = m;
    btn.addEventListener("click", () => {
      methodRow.querySelectorAll(".size-chip").forEach(el => el.classList.remove("active"));
      btn.classList.add("active");
    });
    methodRow.appendChild(btn);
  });

  const linesWrap = document.getElementById("ko-lines");
  linesWrap.innerHTML = "";
  linesWrap.appendChild(makeLineRow());

  document.getElementById("ko-add-line").onclick = () => linesWrap.appendChild(makeLineRow());

  document.getElementById("ko-new-order").onclick = () => initKeyOrderScreen();
  document.getElementById("ko-back-menu").onclick = () => { state.screenStack = ["screen-password", "screen-operator", "screen-menu"]; showScreen("screen-menu"); };

  document.getElementById("key-order-form").onsubmit = submitKeyOrder;
}

function getSelectedMethod() {
  const active = document.querySelector("#ko-method-row .size-chip.active");
  return active ? active.dataset.method : PICKUP_METHODS[0];
}

async function submitKeyOrder(e) {
  e.preventDefault();
  const lines = Array.from(document.querySelectorAll("#ko-lines .ko-line")).map(row => {
    const productKey = row.querySelector(".ko-line-product").value;
    const product = FF_PRODUCTS.find(p => p.key === productKey);
    return {
      productName: product ? product.name : productKey,
      flavor: row.querySelector(".ko-line-flavor").value,
      qty: Number(row.querySelector(".ko-line-qty").value) || 0,
    };
  }).filter(l => l.qty > 0);

  const pickupDate = document.getElementById("ko-pickup-date").value;
  const mailDate = document.getElementById("ko-mail-date").value;

  const order = {
    operator: state.operator,
    method: getSelectedMethod(),
    pickupDate,
    mailDate,
    customerName: document.getElementById("ko-name").value.trim(),
    customerPhone: document.getElementById("ko-phone").value.trim(),
    recipientName: document.getElementById("ko-recipient-name").value.trim(),
    recipientPhone: document.getElementById("ko-recipient-phone").value.trim(),
    recipientAddress: document.getElementById("ko-address").value.trim(),
    total: Number(document.getElementById("ko-total").value) || 0,
    note: document.getElementById("ko-note").value.trim(),
    lines,
  };

  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = "送出中…";
  try {
    await apiPost({ action: "addOrder", order });
    await refreshOrders();
    showKeyOrderResult(pickupDate || mailDate);
  } catch (err) {
    alert("送出失敗：" + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "送出訂單";
  }
}

function showKeyOrderResult(targetDate) {
  document.getElementById("key-order-form").classList.add("hidden");
  const resultBox = document.getElementById("ko-result");
  resultBox.classList.remove("hidden");
  const summaryBox = document.getElementById("ko-day-summary");
  if (!targetDate) {
    summaryBox.textContent = "這張訂單沒有填取貨/寄件日期，無法統計當天總量。";
    return;
  }
  const totals = aggregateByDate(targetDate);
  summaryBox.innerHTML = renderTotalsHtml(totals, targetDate);
}

// ---------------- 共用：日期與加總 ----------------
function shipDate(order) {
  return order["寄件日期"] || order["取貨日期"] || "";
}

function aggregateByDate(dateStr) {
  const map = new Map();
  state.orders.forEach(order => {
    if (shipDate(order) !== dateStr) return;
    const lines = (order["品項明細"] && order["品項明細"].lines) || [];
    lines.forEach(l => {
      const key = `${l.productName}｜${l.flavor}`;
      map.set(key, (map.get(key) || 0) + Number(l.qty || 0));
    });
  });
  return map;
}

function renderTotalsHtml(totalsMap, dateStr) {
  if (totalsMap.size === 0) {
    return `<div>${dateStr}　目前還沒有可統計的品項明細。</div>`;
  }
  const rows = Array.from(totalsMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0], "zh-Hant"))
    .map(([name, qty]) => `<div class="summary-line"><span>${name}</span><strong>${qty}</strong></div>`)
    .join("");
  return `<div style="font-weight:700;color:var(--maroon);margin-bottom:6px;">${dateStr} 當天總量</div>${rows}`;
}

// ---------------- 查看每日訂單 ----------------
async function refreshOrdersAndRenderCalendar() {
  try {
    await refreshOrders();
  } catch (err) {
    alert("讀取訂單失敗：" + err.message);
  }
  initDailyScreen();
}

function initDailyScreen() {
  document.getElementById("btn-toggle-view").onclick = toggleViewMode;
  document.getElementById("cal-prev").onclick = () => shiftMonth(-1);
  document.getElementById("cal-next").onclick = () => shiftMonth(1);
  renderDailyView();
}

function toggleViewMode() {
  state.viewMode = state.viewMode === "calendar" ? "list" : "calendar";
  document.getElementById("btn-toggle-view").textContent = state.viewMode === "calendar" ? "改用清單顯示" : "改用日曆顯示";
  renderDailyView();
}

function shiftMonth(delta) {
  state.calendar.month += delta;
  if (state.calendar.month < 0) { state.calendar.month = 11; state.calendar.year--; }
  if (state.calendar.month > 11) { state.calendar.month = 0; state.calendar.year++; }
  renderDailyView();
}

function renderDailyView() {
  const isCalendar = state.viewMode === "calendar";
  document.getElementById("calendar-view").classList.toggle("hidden", !isCalendar);
  document.getElementById("list-view").classList.toggle("hidden", isCalendar);
  if (isCalendar) renderCalendar();
  else renderDateList();
}

function countsByDate() {
  const map = new Map();
  state.orders.forEach(order => {
    const d = shipDate(order);
    if (!d) return;
    map.set(d, (map.get(d) || 0) + 1);
  });
  return map;
}

function pad2(n) { return String(n).padStart(2, "0"); }

function renderCalendar() {
  const { year, month } = state.calendar;
  document.getElementById("cal-title").textContent = `${year} 年 ${month + 1} 月`;
  const counts = countsByDate();
  const grid = document.getElementById("cal-grid");
  grid.innerHTML = "";

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = todayIso();

  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement("div");
    empty.className = "cal-cell empty";
    grid.appendChild(empty);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${pad2(month + 1)}-${pad2(d)}`;
    const cell = document.createElement("div");
    cell.className = "cal-cell" + (dateStr === todayStr ? " today" : "");
    const count = counts.get(dateStr) || 0;
    cell.innerHTML = `<div>${d}</div>${count ? `<div class="count">${count}</div>` : ""}`;
    cell.addEventListener("click", () => openDayDetail(dateStr));
    grid.appendChild(cell);
  }
}

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

function renderDateList() {
  const wrap = document.getElementById("list-view");
  wrap.innerHTML = "";
  const counts = countsByDate();
  const dates = Array.from(counts.keys()).sort(); // 由近到遠（字串日期可直接排序）

  if (dates.length === 0) {
    wrap.innerHTML = `<p style="color:var(--ink-soft);font-size:14px;">目前沒有排定日期的訂單。</p>`;
    return;
  }

  dates.forEach(dateStr => {
    const block = document.createElement("div");
    block.className = "day-block";
    block.innerHTML = `<div class="day-block-title">${dateStr}<span class="count-tag">${counts.get(dateStr)} 張</span></div>`;
    const ordersOfDay = state.orders.filter(o => shipDate(o) === dateStr);
    ordersOfDay.forEach(o => block.appendChild(renderOrderCard(o)));
    wrap.appendChild(block);
  });
}

function openDayDetail(dateStr) {
  document.getElementById("day-detail-title").textContent = dateStr + " 的訂單";
  const totals = aggregateByDate(dateStr);
  document.getElementById("day-summary").innerHTML = renderTotalsHtml(totals, dateStr);

  const listWrap = document.getElementById("day-order-list");
  listWrap.innerHTML = "";
  const ordersOfDay = state.orders.filter(o => shipDate(o) === dateStr);
  if (ordersOfDay.length === 0) {
    listWrap.innerHTML = `<p style="color:var(--ink-soft);font-size:14px;">這天沒有訂單。</p>`;
  } else {
    ordersOfDay.forEach(o => listWrap.appendChild(renderOrderCard(o)));
  }
  goTo("screen-day-detail");
}

function renderOrderCard(order) {
  const el = document.createElement("div");
  const done = order["出貨狀態"] === "已完成";
  el.className = "order-card" + (done ? " done" : "");
  const sourceLabel = order["來源"] === "manual" ? `手動輸入・${order["建立人"] || ""}` : "客人網頁下單";
  el.innerHTML = `
    <div class="row1">
      <span>${order["訂貨人姓名"] || order["收貨人姓名"] || "（未填姓名）"}</span>
      <span class="status-tag ${done ? "done" : "pending"}">${done ? "已完成" : "未處理"}</span>
    </div>
    <div class="meta">
      ${order["取貨方式"] || "未填取貨方式"}　${order["取貨日期"] || ""}${order["寄件日期"] ? "／寄件 " + order["寄件日期"] : ""}
      <span class="source-tag">${sourceLabel}</span>
    </div>
  `;
  el.addEventListener("click", () => openOrderDetail(order["訂單ID"]));
  return el;
}

// ---------------- 訂單詳情 / 出貨 ----------------
function openOrderDetail(orderId) {
  state.currentDetailId = orderId;
  renderOrderDetail();
  goTo("screen-order-detail");
}

function renderOrderDetail() {
  const order = state.orders.find(o => o["訂單ID"] === state.currentDetailId);
  const body = document.getElementById("order-detail-body");
  if (!order) {
    body.innerHTML = `<p>找不到這筆訂單，可能已經被移除。</p>`;
    document.getElementById("order-toggle-status").classList.add("hidden");
    return;
  }

  const lines = (order["品項明細"] && order["品項明細"].lines) || [];
  const linesHtml = lines.length
    ? lines.map(l => `<div class="detail-row"><span class="k">${l.productName}｜${l.flavor}</span><span class="v">${l.qty}</span></div>`).join("")
    : `<div class="detail-row"><span class="k">品項明細</span><span class="v">（無結構化明細，請看備註）</span></div>`;

  const joinIfAny = (a, b) => (a || b ? `${a || ""}　${b || ""}` : "");

  const rows = [
    ["建立人", order["建立人"]],
    ["來源", order["來源"] === "manual" ? "手動輸入" : "客人網頁下單"],
    ["取貨方式", order["取貨方式"]],
    ["取貨日期", order["取貨日期"]],
    ["寄件日期", order["寄件日期"]],
    ["訂購人", joinIfAny(order["訂貨人姓名"], order["訂貨人電話"])],
    ["收件人", joinIfAny(order["收貨人姓名"], order["收貨人電話"])],
    ["收件地址", order["收貨人地址"]],
    ["總金額", order["總金額"] ? `$${order["總金額"]}` : ""],
    ["備註", order["備註"]],
  ].filter(([, v]) => v);

  body.innerHTML =
    rows.map(([k, v]) => `<div class="detail-row"><span class="k">${k}</span><span class="v">${v}</span></div>`).join("") +
    `<div class="section-title">品項明細</div>${linesHtml}`;

  const done = order["出貨狀態"] === "已完成";
  const btn = document.getElementById("order-toggle-status");
  btn.classList.remove("hidden");
  btn.textContent = done ? "取消完成（改回未處理）" : "標記完成";
  btn.onclick = () => toggleOrderStatus(order, done);
}

async function toggleOrderStatus(order, currentlyDone) {
  const btn = document.getElementById("order-toggle-status");
  btn.disabled = true;
  try {
    await apiPost({
      action: "updateStatus",
      orderId: order["訂單ID"],
      status: currentlyDone ? "未處理" : "已完成",
      operator: state.operator,
    });
    await refreshOrders();
    renderOrderDetail();
  } catch (err) {
    alert("更新失敗：" + err.message);
  } finally {
    btn.disabled = false;
  }
}

// ---------------- 初始化 ----------------
document.addEventListener("DOMContentLoaded", () => {
  document.body.addEventListener("click", (e) => {
    if (e.target.closest("[data-back]")) goBack();
  });
  initOperatorScreen();
  initPasswordScreen();
});
