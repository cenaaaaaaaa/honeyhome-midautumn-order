// ============================================================
// 巧家麵包店 出貨系統 - 主程式
// ============================================================

const state = {
  screenStack: ["screen-password"],
  menuBaseStack: null, // 成功進到功能選單那一刻的路徑記錄，goToMenuDirect() 靠這個正確回選單
  operator: sessionStorage.getItem("ff_operator") || "",
  orders: [], // 從資料窗口抓回來的所有訂單（快取，已濾掉軟刪除的）
  calendar: (() => { const now = new Date(); return { year: now.getFullYear(), month: now.getMonth() }; })(),
  viewMode: "calendar", // calendar | list
  currentDetailId: null,
  // key 訂單用：目前正在挑選中的禮盒（跟訂購網頁「自己組合看看」邏輯一樣）
  koCombo: { boxId: null, size: null, boxQty: 1, qty: {} },
  // key 訂單用：這張訂單目前已經加入的禮盒品項清單
  koCart: [],
  // 編輯既有訂單用：有值代表現在是「編輯模式」而不是「新增一張訂單」，
  // koEditOriginal 存原始訂單物件，用來預填訂購資訊表單。
  koEditOrderId: null,
  koEditOriginal: null,
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

// 從「選禮盒樣式」或「填禮盒內容」畫面（不管疊了幾層）直接跳回「品項清單」畫面，
// 不管當下巢狀了幾層都能一次跳回去，比 goBack() 只退一步更可靠。
function backToKoCart() {
  while (state.screenStack.length > 1 && state.screenStack[state.screenStack.length - 1] !== "screen-key-order") {
    state.screenStack.pop();
  }
  showScreen("screen-key-order");
}

// 成功進到功能選單那一刻，把當下的路徑記錄存起來當「回功能選單的正確路徑」。
// 這樣不管是登入後直接到選單、還是先選完操作人才到選單，goToMenuDirect() 都能正確還原，
// 不用在每個「回選單」的按鈕上各自寫容易漏掉、容易寫錯的重置邏輯。
function goToMenuDirect() {
  state.screenStack = state.menuBaseStack ? state.menuBaseStack.slice() : ["screen-password", "screen-menu"];
  showScreen("screen-menu");
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
  // 軟刪除的訂單（出貨狀態＝已刪除）不放進畫面上任何清單/彙總
  state.orders = (data.orders || []).filter(o => o["出貨狀態"] !== "已刪除");
  return state.orders;
}

// ---------------- 密碼畫面 ----------------
function initPasswordScreen() {
  const saved = getPwd();
  if (saved) {
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
    goTo("screen-menu");
    state.menuBaseStack = state.screenStack.slice();
    initMenuScreen();
  } else {
    goTo("screen-operator");
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
      goTo("screen-menu");
      state.menuBaseStack = state.screenStack.slice();
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
    state.screenStack = ["screen-password"];
    state.menuBaseStack = null;
    goTo("screen-operator");
  };
  document.getElementById("btn-key-order").onclick = () => {
    resetKeyOrderFlow();
    goToMenuDirect();
    goTo("screen-key-order");
    renderKoCart();
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

// ============================================================
// key 訂單 - Part 1：品項清單（購物車）
// ============================================================

function resetKeyOrderFlow() {
  state.koCart = [];
  state.koCombo = { boxId: null, size: null, boxQty: 1, qty: {} };
  state.koEditOrderId = null;
  state.koEditOriginal = null;
}

// 把訂單原本的分組品項（boxes）轉成 key 訂單購物車格式，讓「編輯」可以沿用同一套介面。
// 盡量比對回 data.js 裡的禮盒定義（用名稱比對 boxId），比對不到也沒關係，
// 這個品項一樣可以在購物車裡被移除、只是沒辦法點進去重新調整口味明細，只能整項移除後重新加入。
function boxesToKoCart(order) {
  return orderBoxes(order).map(box => {
    const matched = allKoBoxes().find(b => b.name === box.boxName);
    return {
      boxName: box.boxName || "",
      boxId: matched ? matched.id : null,
      size: box.size || null,
      boxQty: box.boxQty || 1,
      lines: Array.isArray(box.lines) ? box.lines : [],
      summary: koRebuildSummaryFromBox(box),
      total: koEstimateBoxTotal(box),
    };
  });
}

function koRebuildSummaryFromBox(box) {
  const lines = [`禮盒：${box.boxName || "（未命名）"}`];
  if (box.size) lines.push(`份量：${box.size} 入`);
  if (box.boxQty > 1) lines.push(`訂購盒數：${box.boxQty} 盒`);
  (box.lines || []).forEach(l => lines.push(`${l.productName}：${l.flavor} x${l.qty}`));
  return lines.join("\n");
}

// 用品名回頭去 PRODUCTS / FIXED_BOXES 查單價，估出這個品項的小計，
// 純粹是購物車畫面上的參考金額，不是送出時真正採用的總金額（總金額那格永遠是手動填寫的欄位）。
function koEstimateBoxTotal(box) {
  let sum = 0;
  (box.lines || []).forEach(l => {
    const product = Object.values(PRODUCTS).find(p => p.name === l.productName);
    if (product) { sum += (product.price || 0) * (l.qty || 0); return; }
    const fixedBox = FIXED_BOXES.find(b => b.name === l.productName);
    if (fixedBox) sum += (fixedBox.price || 0) * (l.qty || 0);
  });
  return sum;
}

// 從訂單詳情頁點「編輯這張訂單」進來，把原本的品項/資料帶進 key 訂單那套介面。
function startEditOrder(order) {
  state.koEditOrderId = order["訂單ID"];
  state.koEditOriginal = order;
  state.koCart = boxesToKoCart(order);
  state.koCombo = { boxId: null, size: null, boxQty: 1, qty: {} };
  goToMenuDirect();
  goTo("screen-key-order");
  renderKoCart();
}

function renderKoCart() {
  document.getElementById("ko-cart-operator").textContent = state.operator;
  document.getElementById("ko-cart-title").textContent = state.koEditOrderId ? "編輯訂單" : "key 訂單";
  const wrap = document.getElementById("ko-cart-list");
  wrap.innerHTML = "";

  if (state.koCart.length === 0) {
    wrap.innerHTML = `<p style="color:var(--ink-soft);font-size:14px;">目前還沒有加入任何禮盒品項，先點下面「新增一個禮盒品項」。</p>`;
  }

  state.koCart.forEach((item, idx) => {
    const el = document.createElement("div");
    el.className = "order-recap";
    el.style.position = "relative";
    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <strong style="color:var(--maroon);">第 ${idx + 1} 項</strong>
        <button class="ghost-btn" data-remove="${idx}" style="padding:4px 12px;font-size:12px;">移除</button>
      </div>
      ${item.summary.replace(/\n/g, "<br>")}
    `;
    wrap.appendChild(el);
  });

  wrap.querySelectorAll("[data-remove]").forEach(btn => {
    btn.addEventListener("click", () => {
      state.koCart.splice(Number(btn.dataset.remove), 1);
      renderKoCart();
    });
  });

  const total = state.koCart.reduce((sum, i) => sum + i.total, 0);
  document.getElementById("ko-cart-total").textContent = `目前總金額：$${total}`;
  document.getElementById("ko-goto-order-form").disabled = state.koCart.length === 0;
}

function initKeyOrderCartScreen() {
  document.getElementById("ko-add-box").onclick = () => {
    renderKoBoxGrid();
    goTo("screen-ko-box-pick");
  };
  document.getElementById("ko-goto-order-form").onclick = () => {
    initKoOrderFormScreen();
    goTo("screen-ko-order-form");
  };
}

// ============================================================
// key 訂單 - Part 2：選禮盒樣式
// ============================================================

function allKoBoxes() {
  return [...FIXED_BOXES.map(b => ({ ...b, type: "fixed" })), ...COMBOABLE_BOXES];
}

function findKoBox(boxId) {
  return allKoBoxes().find(b => b.id === boxId);
}

function renderKoBoxGrid() {
  const grid = document.getElementById("ko-box-grid");
  grid.innerHTML = "";
  allKoBoxes().forEach(box => {
    const card = document.createElement("div");
    card.className = "box-select-card";
    card.innerHTML = `
      ${box.img ? `<img src="${box.img}" alt="" style="width:100%;height:70px;object-fit:contain" onerror="this.style.display='none'">` : ""}
      <div class="name">${box.name}</div>
    `;
    card.addEventListener("click", () => startKoBox(box.id));
    grid.appendChild(card);
  });
}

function startKoBox(boxId) {
  const box = findKoBox(boxId);
  if (!box) return;

  state.koCombo.boxId = boxId;
  state.koCombo.size = box.sizes ? box.sizes[0] : null;
  state.koCombo.boxQty = 1;
  state.koCombo.qty = {};

  if (box.type === "fixed") {
    // 固定禮盒沒有品項可以調，不用建立 qty 物件
  } else if (box.type === "single") {
    state.koCombo.qty[box.productKey] = {};
  } else if (box.type === "mixFree") {
    box.productKeys.forEach(k => (state.koCombo.qty[k] = {}));
  } else if (box.type === "mixFixed") {
    box.parts.forEach(p => (state.koCombo.qty[p.productKey] = {}));
  }

  renderKoBoxDetail();
  goTo("screen-ko-box-detail");
}

// ============================================================
// key 訂單 - Part 3：填禮盒內容（口味/數量），邏輯跟訂購網頁的組合工具一致
// ============================================================

function koComboTargetForPart(box, productKey) {
  if (box.type === "single") return state.koCombo.size;
  if (box.type === "mixFree") return null;
  if (box.type === "mixFixed") {
    const part = box.parts.find(p => p.productKey === productKey);
    return part ? part.qty : 0;
  }
  return 0;
}

function sumQty(qtyObj) {
  return Object.values(qtyObj || {}).reduce((a, b) => a + b, 0);
}

function koComboOverallTarget(box) {
  if (box.type === "single") return state.koCombo.size;
  if (box.type === "mixFree") return state.koCombo.size;
  if (box.type === "mixFixed") return box.parts.reduce((a, p) => a + p.qty, 0);
  return 0;
}

function koComboOverallSelected(box) {
  let sum = 0;
  Object.values(state.koCombo.qty).forEach(qtyObj => { sum += sumQty(qtyObj); });
  return sum;
}

function koComboTotalPrice(box) {
  if (box.type === "fixed") return box.price;
  let total = 0;
  const keys = box.type === "single" ? [box.productKey] : box.type === "mixFree" ? box.productKeys : box.parts.map(p => p.productKey);
  keys.forEach(k => {
    const product = PRODUCTS[k];
    if (!product) return;
    const qtyObj = state.koCombo.qty[k] || {};
    total += sumQty(qtyObj) * product.price;
  });
  return total;
}

function koMaxAllowedForFlavor(box, productKey, flavor) {
  const qtyObj = state.koCombo.qty[productKey];
  const current = qtyObj[flavor] || 0;
  if (box.type === "mixFixed") {
    const partTarget = koComboTargetForPart(box, productKey);
    const partSumOthers = sumQty(qtyObj) - current;
    return Math.max(0, partTarget - partSumOthers);
  }
  const overallTarget = koComboOverallTarget(box);
  const overallSumOthers = koComboOverallSelected(box) - current;
  return Math.max(0, overallTarget - overallSumOthers);
}

function koSetQty(productKey, flavor, rawValue, box) {
  const max = koMaxAllowedForFlavor(box, productKey, flavor);
  let val = parseInt(rawValue, 10);
  if (isNaN(val) || val < 0) val = 0;
  if (val > max) val = max;
  state.koCombo.qty[productKey][flavor] = val;
  return val;
}

function koBumpQty(productKey, flavor, delta, box) {
  const current = state.koCombo.qty[productKey][flavor] || 0;
  const next = koSetQty(productKey, flavor, current + delta, box);
  const input = document.querySelector(`#ko-box-detail-body .qty-num-input[data-key="${productKey}"][data-flavor="${flavor}"]`);
  if (input) input.value = next;
  updateKoBoxSummary(box);
}

function koHandleQtyInput(e) {
  const box = findKoBox(state.koCombo.boxId);
  if (!box) return;
  const { key, flavor } = e.target.dataset;
  const raw = e.target.value;
  const clamped = koSetQty(key, flavor, raw, box);
  if (raw !== "" && String(clamped) !== raw) e.target.value = clamped;
  updateKoBoxSummary(box);
}

function koHandleQtyBlur(e) {
  if (e.target.value === "") e.target.value = "0";
}

function koSetBoxQty(rawValue) {
  let val = parseInt(rawValue, 10);
  if (isNaN(val) || val < 1) val = 1;
  if (val > 99) val = 99;
  state.koCombo.boxQty = val;
  return val;
}

function koBumpBoxQty(delta) {
  const next = koSetBoxQty(state.koCombo.boxQty + delta);
  document.getElementById("ko-box-qty-input").value = next;
  const box = findKoBox(state.koCombo.boxId);
  if (box) updateKoBoxSummary(box);
}

function renderKoBoxDetail() {
  const box = findKoBox(state.koCombo.boxId);
  if (!box) return;

  document.getElementById("ko-box-detail-title").textContent = box.name;
  const body = document.getElementById("ko-box-detail-body");

  if (box.type === "fixed") {
    body.innerHTML = `<div class="alert-note" style="background:#fff2ea;border-color:var(--gold);color:var(--ink);">${box.name}　${box.size}　整盒固定內容，無法調整口味比例。</div>`;
    document.getElementById("ko-box-qty-row").classList.remove("hidden");
    document.getElementById("ko-box-qty-input").value = state.koCombo.boxQty;
    updateKoBoxSummary(box);
    return;
  }

  let html = "";
  if (box.sizes) {
    html += `<div class="size-chip-row">`;
    box.sizes.forEach(sz => {
      const active = state.koCombo.size === sz ? "active" : "";
      html += `<button class="size-chip ${active}" data-size="${sz}">${sz} 入</button>`;
    });
    html += `</div>`;
  }

  const renderPartFlavors = (productKey, partLabel) => {
    const product = PRODUCTS[productKey];
    if (!product) return "";
    let out = `<div class="combo-part-title">${partLabel || product.name}</div>`;
    const qtyObj = state.koCombo.qty[productKey];
    product.flavors.forEach(flavor => {
      const q = qtyObj[flavor] || 0;
      out += `
        <div class="flavor-row">
          <span class="fname">${flavor}</span>
          <div class="qty-control">
            <button class="qty-btn" data-action="dec" data-key="${productKey}" data-flavor="${flavor}">−</button>
            <input class="qty-num-input" type="number" inputmode="numeric" min="0" step="1"
                   value="${q}" data-key="${productKey}" data-flavor="${flavor}">
            <button class="qty-btn" data-action="inc" data-key="${productKey}" data-flavor="${flavor}">＋</button>
          </div>
        </div>`;
    });
    return out;
  };

  if (box.type === "single") {
    html += renderPartFlavors(box.productKey);
  } else if (box.type === "mixFree") {
    box.productKeys.forEach(k => { html += renderPartFlavors(k); });
  } else if (box.type === "mixFixed") {
    box.parts.forEach(p => { html += renderPartFlavors(p.productKey, `${PRODUCTS[p.productKey].name}（限 ${p.qty} 入）`); });
  }

  body.innerHTML = html;

  document.querySelectorAll("#ko-box-detail-body .size-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      state.koCombo.size = Number(chip.dataset.size);
      Object.keys(state.koCombo.qty).forEach(k => (state.koCombo.qty[k] = {}));
      renderKoBoxDetail();
    });
  });

  document.querySelectorAll("#ko-box-detail-body .qty-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const delta = btn.dataset.action === "inc" ? 1 : -1;
      koBumpQty(btn.dataset.key, btn.dataset.flavor, delta, box);
    });
  });

  document.querySelectorAll("#ko-box-detail-body .qty-num-input").forEach(input => {
    input.addEventListener("input", koHandleQtyInput);
    input.addEventListener("blur", koHandleQtyBlur);
    input.addEventListener("focus", () => input.select());
  });

  document.getElementById("ko-box-qty-row").classList.remove("hidden");
  document.getElementById("ko-box-qty-input").value = state.koCombo.boxQty;
  updateKoBoxSummary(box);
}

function updateKoBoxSummary(box) {
  const remainEl = document.getElementById("ko-box-remain");
  const addBtn = document.getElementById("ko-box-add-btn");

  if (box.type === "fixed") {
    remainEl.textContent = "";
    document.getElementById("ko-box-total").textContent = `總金額：$${koComboTotalPrice(box) * state.koCombo.boxQty}`;
    addBtn.disabled = false;
    return;
  }

  const target = koComboOverallTarget(box);
  const selected = koComboOverallSelected(box);
  const remain = target != null ? target - selected : 0;
  const perBoxTotal = koComboTotalPrice(box);
  const boxQty = state.koCombo.boxQty;

  if (target == null) {
    remainEl.textContent = "";
  } else if (remain > 0) {
    remainEl.textContent = `還差 ${remain} 顆才能湊滿 ${target} 入`;
    remainEl.className = "remain";
  } else if (remain < 0) {
    remainEl.textContent = `已超過 ${-remain} 顆，請減少數量`;
    remainEl.className = "remain";
  } else {
    remainEl.textContent = `已湊滿 ${target} 入 ✓`;
    remainEl.className = "remain ok";
  }

  document.getElementById("ko-box-total").textContent =
    boxQty > 1 ? `總金額：$${perBoxTotal * boxQty}（每盒 $${perBoxTotal} × ${boxQty} 盒）` : `總金額：$${perBoxTotal}`;

  addBtn.disabled = !(target != null && remain === 0 && perBoxTotal > 0);
}

function koComboStructured(box) {
  if (box.type === "fixed") return [{ productName: box.name, flavor: box.size || "整盒固定內容", qty: 1 }];
  const keys = box.type === "single" ? [box.productKey] : box.type === "mixFree" ? box.productKeys : box.parts.map(p => p.productKey);
  return keys.flatMap(k => {
    const qtyObj = state.koCombo.qty[k] || {};
    return Object.entries(qtyObj)
      .filter(([, q]) => q > 0)
      .map(([flavor, qty]) => ({ productName: PRODUCTS[k].name, flavor, qty }));
  });
}

function koComboSummaryText(box) {
  const boxQty = state.koCombo.boxQty;
  const perBoxTotal = koComboTotalPrice(box);
  let lines = [`禮盒：${box.name}`];
  if (box.type !== "fixed" && state.koCombo.size) lines.push(`份量：${state.koCombo.size} 入`);
  if (boxQty > 1) lines.push(`訂購盒數：${boxQty} 盒`);

  koComboStructured(box).forEach(item => {
    lines.push(`${item.productName}：${item.flavor} x${item.qty}`);
  });

  lines.push(boxQty > 1 ? `總金額：$${perBoxTotal * boxQty}（每盒 $${perBoxTotal} × ${boxQty} 盒）` : `總金額：$${perBoxTotal}`);
  return lines.join("\n");
}

function initKoBoxDetailScreen() {
  document.getElementById("ko-box-qty-dec").onclick = () => koBumpBoxQty(-1);
  document.getElementById("ko-box-qty-inc").onclick = () => koBumpBoxQty(1);
  document.getElementById("ko-box-qty-input").oninput = (e) => {
    const box = findKoBox(state.koCombo.boxId);
    koSetBoxQty(e.target.value);
    if (box) updateKoBoxSummary(box);
  };
  document.getElementById("ko-box-qty-input").onblur = (e) => {
    if (e.target.value === "") {
      e.target.value = koSetBoxQty(1);
      const box = findKoBox(state.koCombo.boxId);
      if (box) updateKoBoxSummary(box);
    }
  };
  document.getElementById("ko-box-add-btn").onclick = () => {
    const box = findKoBox(state.koCombo.boxId);
    if (!box) return;
    const boxQty = box.type === "fixed" ? state.koCombo.boxQty : state.koCombo.boxQty;
    state.koCart.push({
      boxName: box.name,
      boxId: box.id,
      size: box.type === "fixed" ? null : state.koCombo.size,
      boxQty,
      summary: koComboSummaryText(box),
      lines: koComboStructured(box).map(item => ({ ...item, qty: item.qty * boxQty })),
      total: koComboTotalPrice(box) * boxQty,
    });
    backToKoCart();
    renderKoCart();
  };
}

// ============================================================
// key 訂單 - Part 4：填訂購資訊、送出
// ============================================================

function getSelectedMethod() {
  const active = document.querySelector("#ko-method-row .size-chip.active");
  return active ? active.dataset.method : PICKUP_METHODS[0];
}

function initKoOrderFormScreen() {
  const isEdit = !!state.koEditOrderId;
  const o = state.koEditOriginal;

  document.getElementById("ko-form-title").textContent = isEdit ? "編輯訂購資訊" : "填寫訂購資訊";
  document.getElementById("ko-submit-btn").textContent = isEdit ? "儲存修改" : "送出訂單";
  document.getElementById("ko-result").classList.add("hidden");
  document.getElementById("ko-order-form").classList.remove("hidden");
  document.getElementById("ko-order-form").reset();
  document.getElementById("ko-operator").value = state.operator;

  const recap = state.koCart.map((item, idx) => `【第 ${idx + 1} 項】\n${item.summary}`).join("\n\n");
  const cartTotal = state.koCart.reduce((sum, i) => sum + i.total, 0);
  const totalForField = isEdit ? Number(o["總金額"]) || 0 : cartTotal;
  document.getElementById("ko-order-recap").textContent = `${recap}\n\n${isEdit ? "原總金額" : "目前總金額"}：$${totalForField}`;
  document.getElementById("ko-total").value = totalForField;

  const methodRow = document.getElementById("ko-method-row");
  methodRow.innerHTML = "";
  const currentMethod = isEdit ? o["取貨方式"] : null;
  PICKUP_METHODS.forEach((m, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    const active = currentMethod ? m === currentMethod : idx === 0;
    btn.className = "size-chip" + (active ? " active" : "");
    btn.textContent = m;
    btn.dataset.method = m;
    btn.addEventListener("click", () => {
      methodRow.querySelectorAll(".size-chip").forEach(el => el.classList.remove("active"));
      btn.classList.add("active");
    });
    methodRow.appendChild(btn);
  });

  if (isEdit) {
    document.getElementById("ko-pickup-date").value = o["取貨日期"] || "";
    document.getElementById("ko-mail-date").value = o["寄件日期"] || "";
    document.getElementById("ko-name").value = o["訂貨人姓名"] || "";
    document.getElementById("ko-phone").value = o["訂貨人電話"] || "";
    document.getElementById("ko-recipient-name").value = o["收貨人姓名"] || "";
    document.getElementById("ko-recipient-phone").value = o["收貨人電話"] || "";
    document.getElementById("ko-address").value = o["收貨人地址"] || "";
    document.getElementById("ko-note").value = o["備註"] || "";
  }

  document.getElementById("ko-new-order").onclick = () => {
    resetKeyOrderFlow();
    goToMenuDirect();
    goTo("screen-key-order");
    renderKoCart();
  };
  document.getElementById("ko-back-menu").onclick = () => {
    resetKeyOrderFlow();
    goToMenuDirect();
  };

  document.getElementById("ko-order-form").onsubmit = submitKeyOrder;
}

async function submitKeyOrder(e) {
  e.preventDefault();
  if (state.koCart.length === 0) {
    alert("還沒有加入任何禮盒品項，請先返回加入至少一項。");
    return;
  }

  // 每個禮盒品項各自一組（保留分組），出貨系統才能讓每個品項分開標記完成，
  // 不是整張訂單送出後就變成一條攤平的清單。
  const boxes = state.koCart.map(item => ({
    boxName: item.boxName,
    size: item.size,
    boxQty: item.boxQty,
    lines: item.lines,
  }));
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
    boxes,
  };

  const isEdit = !!state.koEditOrderId;
  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = isEdit ? "儲存中…" : "送出中…";
  try {
    if (isEdit) {
      const orderId = state.koEditOrderId;
      await apiPost({ action: "updateOrder", orderId, order });
      await refreshOrders();
      resetKeyOrderFlow();
      goToMenuDirect();
      openOrderDetail(orderId);
    } else {
      await apiPost({ action: "addOrder", order });
      await refreshOrders();
      showKeyOrderResult(pickupDate || mailDate);
    }
  } catch (err) {
    alert((isEdit ? "儲存失敗：" : "送出失敗：") + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = isEdit ? "儲存修改" : "送出訂單";
  }
}

function showKeyOrderResult(targetDate) {
  document.getElementById("ko-order-form").classList.add("hidden");
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

// 品項明細現在是「分組」格式（boxes: [{..., lines}]），這裡統一攤平回單一清單給彙總用。
// 也相容極少數還沒有分組、只有 lines 的舊資料。
function orderBoxes(order) {
  const detail = order["品項明細"] || {};
  return Array.isArray(detail.boxes) ? detail.boxes : [];
}

function orderAllLines(order) {
  const detail = order["品項明細"] || {};
  const boxes = orderBoxes(order);
  if (boxes.length) return boxes.flatMap(b => b.lines || []);
  return detail.lines || [];
}

function aggregateByDate(dateStr) {
  const map = new Map();
  state.orders.forEach(order => {
    if (shipDate(order) !== dateStr) return;
    orderAllLines(order).forEach(l => {
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
  const dates = Array.from(counts.keys()).sort();

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
  const statusBtn = document.getElementById("order-toggle-status");
  const editBtn = document.getElementById("order-edit");
  const deleteBtn = document.getElementById("order-delete");

  if (!order) {
    body.innerHTML = `<p>找不到這筆訂單，可能已經被刪除。</p>`;
    statusBtn.classList.add("hidden");
    editBtn.classList.add("hidden");
    deleteBtn.classList.add("hidden");
    return;
  }

  const joinIfAny = (a, b) => (a || b ? `${a || ""}　${b || ""}` : "");

  const detail = order["品項明細"] || {};
  const boxes = orderBoxes(order);
  let boxesHtml;
  if (boxes.length) {
    // 每個禮盒品項各自一張卡片，各自可以標記完成，方便包裝時一項一項核對打勾
    boxesHtml = boxes.map((box, idx) => {
      const boxDone = !!box.done;
      const titleParts = [box.boxName || "（未命名品項）"];
      if (box.size) titleParts.push(box.size);
      if (box.boxQty > 1) titleParts.push(`${box.boxQty} 盒`);
      const linesHtml = (box.lines || [])
        .map(l => `<div class="detail-row"><span class="k">${l.productName}｜${l.flavor}</span><span class="v">${l.qty}</span></div>`)
        .join("") || `<div class="detail-row"><span class="k">（沒有品項明細）</span></div>`;
      return `
        <div class="order-card ${boxDone ? "done" : ""}" style="cursor:default;" data-box-index="${idx}">
          <div class="row1"><span>${titleParts.join("　")}</span><span class="status-tag ${boxDone ? "done" : "pending"}">${boxDone ? "已完成" : "未處理"}</span></div>
          ${linesHtml}
          <button type="button" class="ghost-btn box-toggle-btn" data-box-index="${idx}" style="width:100%;margin-top:10px;">${boxDone ? "取消完成" : "這個品項標記完成"}</button>
        </div>`;
    }).join("");
  } else if (detail.raw) {
    // 品項解析不出來時，至少把原始訂單內容整段顯示出來，不會讓人完全看不到訂單寫了什麼
    boxesHtml = `<div class="order-recap" style="margin:0;">${String(detail.raw).replace(/\n/g, "<br>")}</div>`;
  } else {
    boxesHtml = `<div class="detail-row"><span class="k">品項明細</span><span class="v">（沒有明細資料，請看備註）</span></div>`;
  }

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
    `<div class="section-title">品項明細（${boxes.length || 0} 項）</div>${boxesHtml}`;

  body.querySelectorAll(".box-toggle-btn").forEach(btn => {
    btn.addEventListener("click", () => toggleBoxStatus(order, Number(btn.dataset.boxIndex)));
  });

  const done = order["出貨狀態"] === "已完成";
  statusBtn.classList.remove("hidden");
  statusBtn.textContent = done ? "整張訂單取消完成（改回未處理）" : "整張訂單標記完成";
  statusBtn.onclick = () => toggleOrderStatus(order, done);

  editBtn.classList.remove("hidden");
  editBtn.onclick = () => startEditOrder(order);

  deleteBtn.classList.remove("hidden");
  deleteBtn.onclick = () => deleteOrder(order);
}

async function toggleBoxStatus(order, boxIndex) {
  const boxes = orderBoxes(order);
  const box = boxes[boxIndex];
  if (!box) return;
  const nextDone = !box.done;

  const btn = document.querySelector(`.box-toggle-btn[data-box-index="${boxIndex}"]`);
  if (btn) btn.disabled = true;
  try {
    await apiPost({ action: "updateBoxStatus", orderId: order["訂單ID"], boxIndex, done: nextDone });
    await refreshOrders();
    renderOrderDetail();
  } catch (err) {
    alert("更新失敗：" + err.message);
  } finally {
    if (btn) btn.disabled = false;
  }
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

async function deleteOrder(order) {
  const who = order["訂貨人姓名"] || order["收貨人姓名"] || "（未填姓名）";
  const when = shipDate(order) || "未填日期";
  const ok = confirm(`確定要刪除這張訂單嗎？\n\n訂購人：${who}\n日期：${when}\n\n刪除後這張單會從所有清單裡消失，這個動作無法在畫面上復原，如果按錯了要請管理者從試算表救回來。`);
  if (!ok) return;

  const btn = document.getElementById("order-delete");
  btn.disabled = true;
  try {
    await apiPost({ action: "deleteOrder", orderId: order["訂單ID"], operator: state.operator });
    await refreshOrders();
    goBack();
  } catch (err) {
    alert("刪除失敗：" + err.message);
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
  initKeyOrderCartScreen();
  initKoBoxDetailScreen();
  initPasswordScreen();
});
