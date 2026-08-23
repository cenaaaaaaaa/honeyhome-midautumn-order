// ============================================================
// 巧家麵包店 中秋互動訂購網頁 - 主程式
// ============================================================

// 【Google 表單設定】
// 等 Google 表單建好之後，把下面三個值換成表單真正的網址和欄位代碼，
// 訂單就會自動送進表單、寄信通知。在還沒設定之前，網站會先用
// 「複製訂單內容 / Email / LINE」的方式讓客人自己送出，網站一樣能正常使用。
const GOOGLE_FORM = {
  actionUrl: "https://docs.google.com/forms/d/e/1FAIpQLSdzRX_5mKRMCa1sZf55RFw2w_l0ax6ZzZvWk5bGh9d2rqCt1g/formResponse",
  entries: {
    name: "entry.1767283874", // 訂貨人
    phone: "entry.680535218", // 訂貨人電話
    recipientName: "entry.845676725", // 收貨人
    recipientAddress: "entry.1816511539", // 收貨人地址
    recipientPhone: "entry.769238450", // 收貨人電話
    deliveryDate: "entry.1755457866", // 到貨日期
    boxSummary: "entry.1123169210", // 禮盒內容
    total: "entry.889096006", // 總金額
    note: "entry.1197789383", // 備註
  },
};

const state = {
  screenStack: ["home"],
  combo: {
    boxId: null,
    size: null,
    qty: {}, // { productKey: { flavorName: number } }
  },
  cart: [], // 已加入訂單清單的禮盒們：{ boxName, summary, total }
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
    showScreen("home");
  }
}

// ---------------- 首頁 ----------------
function initHome() {
  document.getElementById("footer-phone").textContent = SHOP_INFO.phoneDisplay;
  document.getElementById("footer-phone").href = "tel:" + SHOP_INFO.phone.replace(/-/g, "");
  document.getElementById("footer-line").href = SHOP_INFO.lineUrl;
  document.getElementById("footer-line-text").textContent = "LINE：" + SHOP_INFO.line;
  document.getElementById("footer-note").textContent = SHOP_INFO.note;
  document.getElementById("brand-name").textContent = SHOP_INFO.name;

  document.getElementById("btn-price").addEventListener("click", () => {
    renderPriceList();
    goTo("screen-price");
  });
  document.getElementById("btn-boxes").addEventListener("click", () => {
    renderBoxGallery();
    goTo("screen-boxes");
  });
  document.getElementById("btn-combo").addEventListener("click", () => {
    state.cart = []; // 從首頁重新進入，訂單清單重新開始
    renderComboBoxPicker();
    goTo("screen-combo-pick");
  });

  document.querySelectorAll("[data-back]").forEach(btn => {
    btn.addEventListener("click", goBack);
  });
}

// ---------------- 按鈕一：今年單顆價格 ----------------
function renderPriceList() {
  const wrap = document.getElementById("price-list");
  wrap.innerHTML = "";

  wrap.insertAdjacentHTML("beforeend", `<div class="section-title">單品價格</div>`);
  Object.values(PRODUCTS).forEach(p => {
    if (p.pending) {
      wrap.insertAdjacentHTML(
        "beforeend",
        `<div class="price-card">
          <div class="info">
            <span class="name">${p.name}</span>
            <div class="flavors">口味與價格詳情請洽詢門市</div>
          </div>
        </div>`
      );
      return;
    }
    wrap.insertAdjacentHTML(
      "beforeend",
      `<div class="price-card">
        <img src="${p.img}" alt="${p.name}" onerror="this.style.display='none'">
        <div class="info">
          <span class="name">${p.name}</span>${p.subtitle ? `<span class="subtitle">（${p.subtitle}）</span>` : ""}
          <div class="flavors">口味：${p.flavors.join("、")}</div>
        </div>
        <div class="price">$${p.price}<small>／${p.unit}</small></div>
      </div>`
    );
  });

  wrap.insertAdjacentHTML("beforeend", `<div class="section-title">固定禮盒</div>`);
  FIXED_BOXES.forEach(b => {
    wrap.insertAdjacentHTML(
      "beforeend",
      `<div class="price-card">
        <img src="${b.img}" alt="${b.name}" onerror="this.style.display='none'">
        <div class="info">
          <span class="name">${b.name}</span>
          <div class="flavors">${b.size}／整盒固定內容</div>
        </div>
        <div class="price">$${b.price}<small>／盒</small></div>
      </div>`
    );
  });
}

// ---------------- 按鈕二：禮盒樣式選擇 ----------------
function renderBoxGallery() {
  const wrap = document.getElementById("box-gallery");
  wrap.innerHTML = "";

  const renderCard = (box, metaText, ctaText, onClick, pending) => {
    const el = document.createElement("div");
    el.className = "box-card";
    el.innerHTML = `
      ${box.img ? `<img src="${box.img}" alt="${box.name}" onerror="this.style.display='none'">` : ""}
      <div class="body">
        ${pending ? `<span class="pending-tag">詳情請洽詢</span>` : ""}
        <div class="name">${box.name}</div>
        <div class="meta">${metaText}</div>
        <button class="ghost-btn">${ctaText}</button>
      </div>`;
    el.querySelector("button").addEventListener("click", onClick);
    wrap.appendChild(el);
  };

  wrap.insertAdjacentHTML("beforeend", `<div class="section-title">單一品項禮盒</div>`);
  SINGLE_BOXES.forEach(box => {
    const p = PRODUCTS[box.productKey];
    renderCard(
      box,
      `${box.sizes.join(" / ")} 顆，口味可自選：${p.flavors.join("、")}`,
      "試著組合這款",
      () => startCombo(box.id)
    );
  });

  wrap.insertAdjacentHTML("beforeend", `<div class="section-title">混搭禮盒</div>`);
  MIX_BOXES.forEach(box => {
    let metaText;
    if (box.type === "mixFree") {
      metaText = `共 ${box.sizes.join(" / ")} 顆，${box.productKeys.map(k => PRODUCTS[k].name).join("＋")} 自由搭配`;
    } else {
      metaText = box.parts.map(p => `${PRODUCTS[p.productKey].name} ${p.qty} 入`).join("＋");
    }
    renderCard(box, metaText, "試著組合這款", () => startCombo(box.id), box.pending);
  });

  wrap.insertAdjacentHTML("beforeend", `<div class="section-title">固定禮盒</div>`);
  FIXED_BOXES.forEach(box => {
    renderCard(box, `${box.size}／$${box.price}／整盒固定內容`, "查看聯絡方式", () => goTo("screen-fixed-contact"));
  });
}

// ---------------- 按鈕三：自己組合看看 ----------------
function renderComboBoxPicker() {
  const banner = document.getElementById("cart-banner");
  if (state.cart.length > 0) {
    banner.classList.remove("hidden");
    banner.innerHTML = `
      <span>🛒 已加入 ${state.cart.length} 項，小計 $${cartGrandTotal()}</span>
      <button id="cart-banner-btn" class="ghost-btn">前往結帳</button>`;
    document.getElementById("cart-banner-btn").addEventListener("click", () => {
      renderCart();
      goTo("screen-cart");
    });
  } else {
    banner.classList.add("hidden");
    banner.innerHTML = "";
  }

  const grid = document.getElementById("combo-box-grid");
  grid.innerHTML = "";
  COMBOABLE_BOXES.forEach(box => {
    const card = document.createElement("div");
    card.className = "box-select-card";
    card.innerHTML = `
      ${box.img ? `<img src="${box.img}" alt="" style="width:100%;height:70px;object-fit:contain" onerror="this.style.display='none'">` : ""}
      <div class="name">${box.name}</div>
    `;
    card.addEventListener("click", () => startCombo(box.id));
    grid.appendChild(card);
  });
}

function findBox(boxId) {
  return COMBOABLE_BOXES.find(b => b.id === boxId);
}

function startCombo(boxId) {
  const box = findBox(boxId);
  if (!box) return;

  state.combo.boxId = boxId;
  state.combo.size = box.sizes ? box.sizes[0] : null;
  state.combo.qty = {};

  if (box.type === "single") {
    state.combo.qty[box.productKey] = {};
  } else if (box.type === "mixFree") {
    box.productKeys.forEach(k => (state.combo.qty[k] = {}));
  } else if (box.type === "mixFixed") {
    box.parts.forEach(p => (state.combo.qty[p.productKey] = {}));
  }

  renderComboDetail();
  goTo("screen-combo-detail");
}

function comboTargetForPart(box, productKey) {
  if (box.type === "single") return state.combo.size;
  if (box.type === "mixFree") return null; // 由整體 size 控制，非單一品項
  if (box.type === "mixFixed") {
    const part = box.parts.find(p => p.productKey === productKey);
    return part ? part.qty : 0;
  }
  return 0;
}

function sumQty(qtyObj) {
  return Object.values(qtyObj || {}).reduce((a, b) => a + b, 0);
}

function comboOverallTarget(box) {
  if (box.type === "single") return state.combo.size;
  if (box.type === "mixFree") return state.combo.size;
  if (box.type === "mixFixed") return box.parts.reduce((a, p) => a + p.qty, 0);
  return 0;
}

function comboOverallSelected(box) {
  let sum = 0;
  Object.values(state.combo.qty).forEach(qtyObj => {
    sum += sumQty(qtyObj);
  });
  return sum;
}

function comboTotalPrice(box) {
  let total = 0;
  const keys = box.type === "single" ? [box.productKey] : box.type === "mixFree" ? box.productKeys : box.parts.map(p => p.productKey);
  keys.forEach(k => {
    const product = PRODUCTS[k];
    if (!product || product.pending) return;
    const qtyObj = state.combo.qty[k] || {};
    const count = sumQty(qtyObj);
    total += count * product.price;
  });
  return total;
}

function changeQty(productKey, flavor, delta, box) {
  const qtyObj = state.combo.qty[productKey];
  const current = qtyObj[flavor] || 0;
  const next = current + delta;
  if (next < 0) return;

  // 檢查是否超過這個部分（單品/固定子配額）的上限
  const partTarget = comboTargetForPart(box, productKey);
  if (box.type === "mixFixed" && partTarget != null) {
    const partSum = sumQty(qtyObj) - current + next;
    if (partSum > partTarget) return;
  }
  if (box.type === "single" || box.type === "mixFree") {
    const overallTarget = comboOverallTarget(box);
    const overallSum = comboOverallSelected(box) - current + next;
    if (overallTarget != null && overallSum > overallTarget) return;
  }

  qtyObj[flavor] = next;
  renderComboDetail();
}

function renderComboDetail() {
  const box = findBox(state.combo.boxId);
  if (!box) return;

  document.getElementById("combo-detail-title").textContent = box.name;

  if (box.pending) {
    document.getElementById("combo-detail-body").innerHTML = `
      <div class="alert-note">這個禮盒還有品項（小月餅）的價格與口味資料尚未補齊，暫時無法在線上組合，請直接洽詢門市：
      <a href="tel:${SHOP_INFO.phone.replace(/-/g, "")}">${SHOP_INFO.phoneDisplay}</a> / LINE ${SHOP_INFO.line}</div>`;
    document.getElementById("combo-summary").classList.add("hidden");
    return;
  }
  document.getElementById("combo-summary").classList.remove("hidden");

  let html = "";

  // 尺寸選擇（single / mixFree 才有）
  if (box.sizes) {
    html += `<div class="size-chip-row">`;
    box.sizes.forEach(sz => {
      const active = state.combo.size === sz ? "active" : "";
      html += `<button class="size-chip ${active}" data-size="${sz}">${sz} 入</button>`;
    });
    html += `</div>`;
  }

  const renderPartFlavors = (productKey, partLabel) => {
    const product = PRODUCTS[productKey];
    if (!product) return "";
    let out = `<div class="combo-part-title">${partLabel || product.name}</div>`;
    const qtyObj = state.combo.qty[productKey];
    product.flavors.forEach(flavor => {
      const q = qtyObj[flavor] || 0;
      out += `
        <div class="flavor-row">
          <span class="fname">${flavor}</span>
          <div class="qty-control">
            <button class="qty-btn" data-action="dec" data-key="${productKey}" data-flavor="${flavor}">−</button>
            <span class="qty-num">${q}</span>
            <button class="qty-btn" data-action="inc" data-key="${productKey}" data-flavor="${flavor}">＋</button>
          </div>
        </div>`;
    });
    return out;
  };

  if (box.type === "single") {
    html += renderPartFlavors(box.productKey);
  } else if (box.type === "mixFree") {
    box.productKeys.forEach(k => {
      html += renderPartFlavors(k);
    });
  } else if (box.type === "mixFixed") {
    box.parts.forEach(p => {
      html += renderPartFlavors(p.productKey, `${PRODUCTS[p.productKey].name}（限 ${p.qty} 入）`);
    });
  }

  document.getElementById("combo-detail-body").innerHTML = html;

  // 綁定尺寸切換
  document.querySelectorAll(".size-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      state.combo.size = Number(chip.dataset.size);
      // 尺寸變更時，數量歸零避免超過新上限造成混亂
      Object.keys(state.combo.qty).forEach(k => (state.combo.qty[k] = {}));
      renderComboDetail();
    });
  });

  // 綁定數量按鈕
  document.querySelectorAll(".qty-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const delta = btn.dataset.action === "inc" ? 1 : -1;
      changeQty(btn.dataset.key, btn.dataset.flavor, delta, box);
    });
  });

  updateComboSummary(box);
}

function updateComboSummary(box) {
  const target = comboOverallTarget(box);
  const selected = comboOverallSelected(box);
  const remain = target != null ? target - selected : 0;
  const total = comboTotalPrice(box);

  const remainEl = document.getElementById("combo-remain");
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

  document.getElementById("combo-total").textContent = `總金額：$${total}`;

  const nextBtn = document.getElementById("combo-next-btn");
  nextBtn.disabled = !(target != null && remain === 0 && total > 0);
}

function comboSummaryText(box) {
  let lines = [];
  lines.push(`禮盒：${box.name}`);
  if (state.combo.size) lines.push(`份量：${state.combo.size} 入`);

  const keys = box.type === "single" ? [box.productKey] : box.type === "mixFree" ? box.productKeys : box.parts.map(p => p.productKey);
  keys.forEach(k => {
    const product = PRODUCTS[k];
    const qtyObj = state.combo.qty[k] || {};
    const parts = Object.entries(qtyObj)
      .filter(([, q]) => q > 0)
      .map(([flavor, q]) => `${flavor} x${q}`);
    if (parts.length) lines.push(`${product.name}：${parts.join("、")}`);
  });

  lines.push(`總金額：$${comboTotalPrice(box)}`);
  return lines.join("\n");
}

// ---------------- 訂單清單（購物車） ----------------
function cartGrandTotal() {
  return state.cart.reduce((sum, item) => sum + item.total, 0);
}

function addCurrentToCart() {
  const box = findBox(state.combo.boxId);
  state.cart.push({
    boxName: box.name,
    summary: comboSummaryText(box),
    total: comboTotalPrice(box),
  });
  renderCart();
  goTo("screen-cart");
}

function renderCart() {
  const wrap = document.getElementById("cart-list");
  wrap.innerHTML = "";

  if (state.cart.length === 0) {
    wrap.innerHTML = `<p style="color:var(--ink-soft);font-size:14px;">目前訂單清單是空的，先去選一款禮盒吧！</p>`;
  }

  state.cart.forEach((item, idx) => {
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
      state.cart.splice(Number(btn.dataset.remove), 1);
      renderCart();
    });
  });

  document.getElementById("cart-total").textContent = `訂單總金額：$${cartGrandTotal()}`;
  document.getElementById("cart-checkout-btn").disabled = state.cart.length === 0;
}

// ---------------- 訂單表單 ----------------
function goToOrderForm() {
  const recap = state.cart
    .map((item, idx) => `【第 ${idx + 1} 項】\n${item.summary}`)
    .join("\n\n");
  document.getElementById("order-recap").textContent = `${recap}\n\n訂單總金額：$${cartGrandTotal()}`;
  goTo("screen-order-form");
}

function submitOrder(e) {
  e.preventDefault();
  const name = document.getElementById("order-name").value.trim();
  const phone = document.getElementById("order-phone").value.trim();
  const date = document.getElementById("order-date").value;
  const note = document.getElementById("order-note").value.trim();
  const sameAsOrderer = document.getElementById("order-same-as-orderer").checked;

  let recipientName = name;
  let recipientPhone = phone;
  let recipientAddress = "";
  if (!sameAsOrderer) {
    recipientName = document.getElementById("order-recipient-name").value.trim();
    recipientPhone = document.getElementById("order-recipient-phone").value.trim();
    recipientAddress = document.getElementById("order-recipient-address").value.trim();
  }

  const summary = state.cart.map((item, idx) => `【第 ${idx + 1} 項】${item.summary}`).join("\n\n");
  const total = cartGrandTotal();

  if (!name || !phone) {
    alert("請填寫訂貨人姓名和電話喔！");
    return;
  }
  if (!sameAsOrderer && (!recipientName || !recipientPhone || !recipientAddress)) {
    alert("請填寫收貨人姓名、電話和地址喔！（或勾選「收貨人同訂貨人」）");
    return;
  }

  const data = { name, phone, recipientName, recipientPhone, recipientAddress, date, summary, total, note };

  if (GOOGLE_FORM.actionUrl) {
    submitToGoogleForm(data);
    showOrderSuccess();
  } else {
    // Google 表單尚未設定：提供備援方式，讓客人自己選一種送出
    showOrderFallback(data);
  }
}

function submitToGoogleForm(data) {
  const iframe = document.getElementById("hidden-submit-frame");
  const form = document.createElement("form");
  form.action = GOOGLE_FORM.actionUrl;
  form.method = "POST";
  form.target = "hidden-submit-frame";

  const addField = (entryName, value) => {
    if (!entryName) return;
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = entryName;
    input.value = value;
    form.appendChild(input);
  };

  addField(GOOGLE_FORM.entries.name, data.name);
  addField(GOOGLE_FORM.entries.phone, data.phone);
  addField(GOOGLE_FORM.entries.recipientName, data.recipientName);
  addField(GOOGLE_FORM.entries.recipientPhone, data.recipientPhone);
  addField(GOOGLE_FORM.entries.recipientAddress, data.recipientAddress);
  addField(GOOGLE_FORM.entries.deliveryDate, data.date);
  addField(GOOGLE_FORM.entries.boxSummary, data.summary);
  addField(GOOGLE_FORM.entries.total, String(data.total));
  addField(GOOGLE_FORM.entries.note, data.note);

  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);
}

function fullOrderText(data) {
  return `【巧家麵包店 中秋訂購】
訂貨人：${data.name}
訂貨人電話：${data.phone}
收貨人：${data.recipientName}
收貨人電話：${data.recipientPhone}
收貨人地址：${data.recipientAddress || "未填"}
到貨日期：${data.date || "未填"}

${data.summary}

訂單總金額：$${data.total}
備註：${data.note || "無"}`;
}

function showOrderFallback(data) {
  const text = fullOrderText(data);
  document.getElementById("fallback-text").textContent = text;

  document.getElementById("fallback-copy").onclick = () => {
    navigator.clipboard?.writeText(text).then(
      () => alert("已複製訂單內容，可以貼給老闆囉！"),
      () => alert("複製失敗，請手動選取文字複製。")
    );
  };
  document.getElementById("fallback-line").href = SHOP_INFO.lineUrl;
  document.getElementById("fallback-mail").href =
    "mailto:?subject=" + encodeURIComponent("中秋訂購 - " + data.name) + "&body=" + encodeURIComponent(text);

  goTo("screen-order-fallback");
}

function showOrderSuccess() {
  goTo("screen-order-success");
}

// ---------------- 初始化 ----------------
document.addEventListener("DOMContentLoaded", () => {
  initHome();

  document.getElementById("combo-next-btn").addEventListener("click", addCurrentToCart);
  document.getElementById("cart-add-more-btn").addEventListener("click", () => {
    renderComboBoxPicker();
    goTo("screen-combo-pick");
  });
  document.getElementById("cart-checkout-btn").addEventListener("click", goToOrderForm);
  document.getElementById("order-form").addEventListener("submit", submitOrder);

  document.getElementById("order-same-as-orderer").addEventListener("change", e => {
    const same = e.target.checked;
    document.getElementById("order-recipient-fields").classList.toggle("hidden", same);
    ["order-recipient-name", "order-recipient-phone", "order-recipient-address"].forEach(id => {
      document.getElementById(id).required = !same;
    });
  });
  const resetOrderFormAndGoHome = () => {
    state.cart = [];
    state.screenStack = ["home"];
    document.getElementById("order-form").reset();
    document.getElementById("order-recipient-fields").classList.remove("hidden");
    ["order-recipient-name", "order-recipient-phone", "order-recipient-address"].forEach(id => {
      document.getElementById(id).required = true;
    });
    showScreen("home");
  };
  document.getElementById("btn-back-home-success").addEventListener("click", resetOrderFormAndGoHome);
  document.getElementById("btn-back-home-fallback").addEventListener("click", resetOrderFormAndGoHome);

  showScreen("home");
});
