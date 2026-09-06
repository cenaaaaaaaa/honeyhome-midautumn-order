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
    // 給出貨系統用的結構化明細（給每日備料彙總用）。
    // 在 Google 表單新增一題「明細JSON」（段落文字類型），把產生的 entry.xxxx 填在這裡就會開始送資料，
    // 填之前這裡留空字串完全不影響原本 9 個欄位的送出，客人端畫面也不會有任何變化。
    detailJson: "",
  },
};

const state = {
  screenStack: ["home"],
  combo: {
    boxId: null,
    size: null,
    boxQty: 1, // 這個組合要訂購幾盒
    qty: {}, // { productKey: { flavorName: number } }
    packagingKey: null, // box.packagingOptions 裡目前選的是哪一個（例如「紙盒6入」），沒選就是 null
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
  document.getElementById("btn-gallery").addEventListener("click", () => {
    renderGalleryCategoryList();
    goTo("screen-gallery-pick");
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
        <img src="${imgV(p.img)}" alt="${p.name}" onerror="this.style.display='none'">
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
        <img src="${imgV(b.img)}" alt="${b.name}" onerror="this.style.display='none'">
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
      ${box.img ? `<img src="${imgV(box.img)}" alt="${box.name}" onerror="this.style.display='none'">` : ""}
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
      metaText = box.parts.map(p => `${partDisplayName(p)} ${p.qty} 入`).join("＋");
    }
    renderCard(box, metaText, "試著組合這款", () => startCombo(box.id), box.pending);
  });

  FIXED_BOXES.forEach(box => {
    renderCard(box, `${box.size}／$${box.price}／整盒固定內容`, "試著組合這款", () => startCombo(box.id));
  });
}

// ---------------- 按鈕四：產品照片 ----------------
function renderGalleryCategoryList() {
  const wrap = document.getElementById("gallery-category-list");
  wrap.innerHTML = "";

  GALLERY_CATEGORIES.forEach(cat => {
    const el = document.createElement("div");
    el.className = "gallery-category-card";
    el.innerHTML = `
      <span class="icon">${cat.icon}</span>
      <div>
        <div class="name">${cat.name}</div>
        <div class="count">${cat.desc}${cat.photos.length ? `（${cat.photos.length} 張）` : "（照片準備中）"}</div>
      </div>`;
    el.addEventListener("click", () => {
      renderGalleryDetail(cat.id);
      goTo("screen-gallery-detail");
    });
    wrap.appendChild(el);
  });
}

function renderGalleryDetail(categoryId) {
  const cat = GALLERY_CATEGORIES.find(c => c.id === categoryId);
  if (!cat) return;

  document.getElementById("gallery-detail-title").textContent = cat.name;
  const wrap = document.getElementById("gallery-photo-grid");

  if (cat.photos.length === 0) {
    wrap.innerHTML = `
      <div class="gallery-empty">
        <span class="emoji">📸</span>
        照片準備中，敬請期待～
      </div>`;
    return;
  }

  wrap.className = "gallery-grid";
  wrap.innerHTML = cat.photos
    .map(
      p => `
      <div class="gallery-photo-card">
        <img src="${imgV(p.img)}" alt="${p.caption}" onerror="this.style.display='none'">
        <div class="caption">${p.caption}</div>
      </div>`
    )
    .join("");
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
      ${box.img ? `<img src="${imgV(box.img)}" alt="" style="width:100%;height:70px;object-fit:contain" onerror="this.style.display='none'">` : ""}
      <div class="name">${box.name}</div>
    `;
    card.addEventListener("click", () => startCombo(box.id));
    grid.appendChild(card);
  });
}

function findBox(boxId) {
  return COMBOABLE_BOXES.find(b => b.id === boxId);
}

// mixFixed 的每一格可能是固定品項（part.productKey，只有一種）或可自選品項
// （part.productKeys，好幾種可以自由混搭，只要這一格的總數湊滿 part.qty 就好，
// 不用先選定只用其中一種）。這個函式把一整個 box 展開成所有可能出現的 productKey 清單，
// 讓其他函式（算總價、算明細…）都能用同一套邏輯遍歷，不用管每個格子內部長怎樣。
function partKeys(box) {
  return box.parts.flatMap(p => (p.productKey ? [p.productKey] : p.productKeys));
}

function partDisplayName(part) {
  if (part.productKey) return PRODUCTS[part.productKey].name;
  return part.productKeys.map(k => PRODUCTS[k].name).join("／");
}

// 目前選的「包裝」選項（例如 A 禮盒的紙盒／塑膠盒 6 入），沒選就回傳 null。
function activePackaging(box) {
  if (!box.packagingOptions || !state.combo.packagingKey) return null;
  return box.packagingOptions.find(o => o.key === state.combo.packagingKey) || null;
}

function startCombo(boxId) {
  const box = findBox(boxId);
  if (!box) return;

  state.combo.boxId = boxId;
  state.combo.size = box.sizes ? box.sizes[0] : null;
  state.combo.boxQty = 1;
  state.combo.qty = {};
  state.combo.packagingKey = null;

  if (box.type === "single") {
    state.combo.qty[box.productKey] = {};
  } else if (box.type === "mixFree") {
    box.productKeys.forEach(k => (state.combo.qty[k] = {}));
  } else if (box.type === "mixFixed") {
    partKeys(box).forEach(k => (state.combo.qty[k] = {}));
  }

  renderComboDetail();
  goTo("screen-combo-detail");
}

// 找出這個 productKey 屬於 mixFixed 裡的哪一格（固定格或自選格都算）。
function findPartByProductKey(box, productKey) {
  return box.parts.find(p => p.productKey === productKey || (p.productKeys && p.productKeys.includes(productKey)));
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
  if (box.type === "fixed") return box.price;
  let total = 0;
  const keys = box.type === "single" ? [box.productKey] : box.type === "mixFree" ? box.productKeys : partKeys(box);
  keys.forEach(k => {
    const product = PRODUCTS[k];
    if (!product || product.pending) return;
    const qtyObj = state.combo.qty[k] || {};
    const count = sumQty(qtyObj);
    total += count * product.price;
  });
  const pkg = activePackaging(box);
  if (pkg) total += pkg.extraFee;
  return total;
}

// 這個口味目前最多還能填多少（扣掉同一組裡其他口味已經佔用的數量）
function maxAllowedForFlavor(box, productKey, flavor) {
  const qtyObj = state.combo.qty[productKey];
  const current = qtyObj[flavor] || 0;

  // mixFixed 的自選格（productKeys 好幾種）是共用同一個配額，所以要把「這一格裡
  // 所有品項目前已選的總數」都算進去，不能只看這個 productKey 自己的小計，
  // 不然同一格裡選了兩種品項時，各自都會誤以為自己還有完整的配額可以填。
  if (box.type === "mixFixed") {
    const part = findPartByProductKey(box, productKey);
    if (!part) return 0;
    const partKeysInThisPart = part.productKey ? [part.productKey] : part.productKeys;
    const partSumAll = partKeysInThisPart.reduce((sum, k) => sum + sumQty(state.combo.qty[k] || {}), 0);
    const partSumOthers = partSumAll - current;
    return Math.max(0, part.qty - partSumOthers);
  }
  const overallTarget = comboOverallTarget(box);
  const overallSumOthers = comboOverallSelected(box) - current;
  return Math.max(0, overallTarget - overallSumOthers);
}

// 把某個口味的數量直接設成指定值（超過上限會自動夾住），回傳實際套用的數字
function setQty(productKey, flavor, rawValue, box) {
  const max = maxAllowedForFlavor(box, productKey, flavor);
  let val = parseInt(rawValue, 10);
  if (isNaN(val) || val < 0) val = 0;
  if (val > max) val = max;
  state.combo.qty[productKey][flavor] = val;
  return val;
}

// +/− 按鈕：只更新這一格的數字跟下方總計，不重畫整個畫面（才不會打斷輸入）
function bumpQty(productKey, flavor, delta, box) {
  const current = state.combo.qty[productKey][flavor] || 0;
  const next = setQty(productKey, flavor, current + delta, box);
  const input = document.querySelector(`.qty-num-input[data-key="${productKey}"][data-flavor="${flavor}"]`);
  if (input) input.value = next;
  updateComboSummary(box);
}

// 直接打數字輸入
function handleQtyInput(e) {
  const box = findBox(state.combo.boxId);
  if (!box) return;
  const { key, flavor } = e.target.dataset;
  const raw = e.target.value;
  const clamped = setQty(key, flavor, raw, box);
  // 輸入框還空著時先不強制蓋成 0，才不會打斷還在打字的人
  if (raw !== "" && String(clamped) !== raw) {
    e.target.value = clamped;
  }
  updateComboSummary(box);
}

function handleQtyBlur(e) {
  if (e.target.value === "") e.target.value = "0";
}

// ---------------- 這個組合要訂購幾盒 ----------------
function setBoxQty(rawValue) {
  let val = parseInt(rawValue, 10);
  if (isNaN(val) || val < 1) val = 1;
  if (val > 300) val = 300;
  state.combo.boxQty = val;
  return val;
}

function bumpBoxQty(delta) {
  const next = setBoxQty(state.combo.boxQty + delta);
  document.getElementById("box-qty-input").value = next;
  const box = findBox(state.combo.boxId);
  if (box) updateComboSummary(box);
}

function handleBoxQtyInput(e) {
  const raw = e.target.value;
  const clamped = setBoxQty(raw);
  if (raw !== "" && String(clamped) !== raw) {
    e.target.value = clamped;
  }
  const box = findBox(state.combo.boxId);
  if (box) updateComboSummary(box);
}

function handleBoxQtyBlur(e) {
  if (e.target.value === "") {
    e.target.value = setBoxQty(1);
    const box = findBox(state.combo.boxId);
    if (box) updateComboSummary(box);
  }
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
    document.getElementById("box-qty-row").classList.add("hidden");
    return;
  }
  document.getElementById("combo-summary").classList.remove("hidden");
  document.getElementById("box-qty-row").classList.remove("hidden");
  document.getElementById("box-qty-input").value = state.combo.boxQty;

  let html = "";

  // 尺寸選擇（single / mixFree 才有）
  if (box.sizes || box.packagingOptions) {
    html += `<div class="size-chip-row">`;
    (box.sizes || []).forEach(sz => {
      const active = state.combo.size === sz && !state.combo.packagingKey ? "active" : "";
      html += `<button class="size-chip ${active}" data-size="${sz}">${sz} 入</button>`;
    });
    // 額外的包裝選項（例如紙盒／塑膠盒 6 入），跟上面的份量選項是同一排、互斥的選擇。
    (box.packagingOptions || []).forEach(opt => {
      const active = state.combo.packagingKey === opt.key ? "active" : "";
      html += `<button type="button" class="size-chip packaging-chip ${active}" data-packaging-key="${opt.key}">${opt.label}${opt.extraFee ? `（+$${opt.extraFee}）` : ""}</button>`;
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
    box.productKeys.forEach(k => {
      html += renderPartFlavors(k);
    });
  } else if (box.type === "mixFixed") {
    box.parts.forEach((p, idx) => {
      if (p.productKeys) {
        // 自選格：好幾種品項共用同一個配額，全部品項的口味清單都直接列出來，
        // 自由混搭湊滿這一格的數量即可，不用先選定只用哪一種。
        const names = p.productKeys.map(k => PRODUCTS[k].name).join("／");
        html += `<div class="combo-part-title">第 ${idx + 1} 格－自選（${names}），合計限 ${p.qty} 入</div>`;
        p.productKeys.forEach(k => {
          html += renderPartFlavors(k);
        });
      } else {
        html += renderPartFlavors(p.productKey, `${PRODUCTS[p.productKey].name}（限 ${p.qty} 入）`);
      }
    });
  } else if (box.type === "fixed") {
    html += `<p style="color:var(--ink-soft);font-size:14px;">這款是整盒固定內容（${box.size}），沒有口味可以調整，直接選擇要訂購幾盒就可以囉。</p>`;
  }

  document.getElementById("combo-detail-body").innerHTML = html;

  // 綁定尺寸切換（用 [data-size] 限定，避免跟下面「可自選品項」的 chip 選到同一顆 class 卻誤觸尺寸邏輯）
  document.querySelectorAll("#combo-detail-body .size-chip[data-size]").forEach(chip => {
    chip.addEventListener("click", () => {
      state.combo.size = Number(chip.dataset.size);
      state.combo.packagingKey = null; // 選了一般份量，包裝選項（若有）就取消
      // 尺寸變更時，數量歸零避免超過新上限造成混亂
      Object.keys(state.combo.qty).forEach(k => (state.combo.qty[k] = {}));
      renderComboDetail();
    });
  });

  // 綁定包裝選項切換（例如紙盒／塑膠盒 6 入）
  document.querySelectorAll("#combo-detail-body .packaging-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const opt = (box.packagingOptions || []).find(o => o.key === chip.dataset.packagingKey);
      if (!opt) return;
      state.combo.packagingKey = opt.key;
      state.combo.size = opt.qty;
      Object.keys(state.combo.qty).forEach(k => (state.combo.qty[k] = {}));
      renderComboDetail();
    });
  });

  // 綁定數量按鈕（限定在 combo-detail-body 裡，避免跟下面的「訂購幾盒」搶到）
  document.querySelectorAll("#combo-detail-body .qty-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const delta = btn.dataset.action === "inc" ? 1 : -1;
      bumpQty(btn.dataset.key, btn.dataset.flavor, delta, box);
    });
  });

  // 綁定數量輸入框（可以直接打數字，不用一直按 +）
  document.querySelectorAll("#combo-detail-body .qty-num-input").forEach(input => {
    input.addEventListener("input", handleQtyInput);
    input.addEventListener("blur", handleQtyBlur);
    input.addEventListener("focus", () => input.select());
  });

  updateComboSummary(box);
}

function updateComboSummary(box) {
  // 固定禮盒沒有口味可湊，只需要看訂購幾盒，永遠算「已完成」
  if (box.type === "fixed") {
    const perBoxTotal = box.price;
    const boxQty = state.combo.boxQty;
    const total = perBoxTotal * boxQty;
    document.getElementById("combo-remain").textContent = "";
    document.getElementById("combo-total").textContent =
      boxQty > 1 ? `總金額：$${total}（每盒 $${perBoxTotal} × ${boxQty} 盒）` : `總金額：$${total}`;
    document.getElementById("combo-next-btn").disabled = false;
    return;
  }

  const target = comboOverallTarget(box);
  const selected = comboOverallSelected(box);
  const remain = target != null ? target - selected : 0;
  const perBoxTotal = comboTotalPrice(box);
  const boxQty = state.combo.boxQty;
  const total = perBoxTotal * boxQty;

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

  document.getElementById("combo-total").textContent =
    boxQty > 1 ? `總金額：$${total}（每盒 $${perBoxTotal} × ${boxQty} 盒）` : `總金額：$${total}`;

  const nextBtn = document.getElementById("combo-next-btn");
  nextBtn.disabled = !(target != null && remain === 0 && perBoxTotal > 0);
}

function comboSummaryText(box) {
  const boxQty = state.combo.boxQty;
  const perBoxTotal = comboTotalPrice(box);

  let lines = [];
  lines.push(`禮盒：${box.name}`);
  const pkg = activePackaging(box);
  if (pkg) {
    lines.push(`份量／包裝：${pkg.label}`);
  } else if (state.combo.size) {
    lines.push(`份量：${state.combo.size} 入`);
  }
  if (boxQty > 1) lines.push(`訂購盒數：${boxQty} 盒`);

  if (box.type === "fixed") {
    lines.push(`內容：${box.size}，整盒固定內容`);
  } else {
    const keys = box.type === "single" ? [box.productKey] : box.type === "mixFree" ? box.productKeys : partKeys(box);
    keys.forEach(k => {
      const product = PRODUCTS[k];
      const qtyObj = state.combo.qty[k] || {};
      const parts = Object.entries(qtyObj)
        .filter(([, q]) => q > 0)
        .map(([flavor, q]) => `${flavor} x${q}`);
      if (parts.length) lines.push(`${product.name}：${parts.join("、")}`);
    });
  }

  lines.push(boxQty > 1 ? `總金額：$${perBoxTotal * boxQty}（每盒 $${perBoxTotal} × ${boxQty} 盒）` : `總金額：$${perBoxTotal}`);
  return lines.join("\n");
}

// 給出貨系統用的結構化明細：把這盒的品項/口味/數量整理成好加總的格式，
// 不影響畫面上人看的 comboSummaryText，純粹多存一份給機器讀。
function comboStructured(box) {
  if (box.type === "fixed") {
    return [{ productKey: box.id, productName: box.name, flavors: [{ flavor: `整盒（${box.size}）`, qty: 1 }] }];
  }
  const keys = box.type === "single" ? [box.productKey] : box.type === "mixFree" ? box.productKeys : partKeys(box);
  return keys.map(k => {
    const qtyObj = state.combo.qty[k] || {};
    const flavors = Object.entries(qtyObj)
      .filter(([, q]) => q > 0)
      .map(([flavor, qty]) => ({ flavor, qty }));
    return { productKey: k, productName: PRODUCTS[k].name, flavors };
  }).filter(entry => entry.flavors.length > 0);
}

// ---------------- 訂單清單（購物車） ----------------
function cartGrandTotal() {
  return state.cart.reduce((sum, item) => sum + item.total, 0);
}

function addCurrentToCart() {
  const box = findBox(state.combo.boxId);
  const pkg = activePackaging(box);
  state.cart.push({
    boxName: box.name,
    boxId: box.id,
    size: state.combo.size,
    boxQty: state.combo.boxQty,
    packagingKey: pkg ? pkg.key : null,
    packagingLabel: pkg ? pkg.label : null,
    packagingFee: pkg ? pkg.extraFee : 0,
    summary: comboSummaryText(box),
    items: comboStructured(box),
    total: comboTotalPrice(box) * state.combo.boxQty,
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

function getPickupMethod() {
  return document.getElementById("pickup-method-mail").classList.contains("active") ? "mail" : "pickup";
}

function submitOrder(e) {
  e.preventDefault();
  const method = getPickupMethod();
  const name = document.getElementById("order-name").value.trim();
  const phone = document.getElementById("order-phone").value.trim();
  const date = document.getElementById("order-date").value;
  const note = document.getElementById("order-note").value.trim();

  if (!name || !phone) {
    alert(method === "mail" ? "請填寫訂貨人姓名和電話喔！" : "請填寫聯絡人姓名和手機喔！");
    return;
  }

  let recipientName = name;
  let recipientPhone = phone;
  let recipientAddress = "";

  if (method === "mail") {
    const sameAsOrderer = document.getElementById("order-same-as-orderer").checked;
    if (!sameAsOrderer) {
      recipientName = document.getElementById("order-recipient-name").value.trim();
      recipientPhone = document.getElementById("order-recipient-phone").value.trim();
      if (!recipientName || !recipientPhone) {
        alert("請填寫收貨人姓名和電話喔！（或勾選「收貨人同訂貨人」）");
        return;
      }
    }
    recipientAddress = document.getElementById("order-recipient-address").value.trim();
    if (!recipientAddress) {
      alert("郵寄一定要填寫收貨人地址喔！");
      return;
    }
  }

  const methodLabel = method === "mail" ? "郵寄" : "自取";
  const summary =
    `【取貨方式：${methodLabel}】\n` +
    state.cart.map((item, idx) => `【第 ${idx + 1} 項】${item.summary}`).join("\n\n");
  const total = cartGrandTotal();
  const detailJson = JSON.stringify({
    method: methodLabel,
    boxes: state.cart.map(item => ({
      boxName: item.boxName,
      boxId: item.boxId,
      size: item.size,
      boxQty: item.boxQty,
      packagingKey: item.packagingKey || null,
      packagingLabel: item.packagingLabel || null,
      packagingFee: item.packagingFee || 0,
      items: item.items,
      total: item.total,
    })),
  });

  const data = { method: methodLabel, name, phone, recipientName, recipientPhone, recipientAddress, date, summary, total, note, detailJson };

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
  addField(GOOGLE_FORM.entries.detailJson, data.detailJson);

  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);
}

function fullOrderText(data) {
  const isMail = data.method === "郵寄";
  const nameLine = isMail
    ? `訂貨人：${data.name}\n訂貨人電話：${data.phone}\n收貨人：${data.recipientName}\n收貨人電話：${data.recipientPhone}\n收貨人地址：${data.recipientAddress}`
    : `聯絡人：${data.name}\n聯絡人手機：${data.phone}`;
  const dateLine = isMail ? `寄出日期：${data.date || "未填"}` : `取貨日期：${data.date || "未填"}`;

  return `【巧家麵包店 中秋訂購】
取貨方式：${data.method}
${nameLine}
${dateLine}

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
  document.getElementById("box-qty-dec").addEventListener("click", () => bumpBoxQty(-1));
  document.getElementById("box-qty-inc").addEventListener("click", () => bumpBoxQty(1));
  document.getElementById("box-qty-input").addEventListener("input", handleBoxQtyInput);
  document.getElementById("box-qty-input").addEventListener("blur", handleBoxQtyBlur);
  document.getElementById("box-qty-input").addEventListener("focus", e => e.target.select());
  document.getElementById("cart-add-more-btn").addEventListener("click", () => {
    renderComboBoxPicker();
    goTo("screen-combo-pick");
  });
  document.getElementById("cart-checkout-btn").addEventListener("click", goToOrderForm);
  document.getElementById("order-form").addEventListener("submit", submitOrder);

  document.getElementById("order-same-as-orderer").addEventListener("change", e => {
    const same = e.target.checked;
    document.getElementById("order-recipient-name-phone").classList.toggle("hidden", same);
    ["order-recipient-name", "order-recipient-phone"].forEach(id => {
      document.getElementById(id).required = !same;
    });
  });

  const setPickupMethod = method => {
    const isMail = method === "mail";
    document.getElementById("pickup-method-pickup").classList.toggle("active", !isMail);
    document.getElementById("pickup-method-mail").classList.toggle("active", isMail);
    document.getElementById("order-mail-block").classList.toggle("hidden", !isMail);

    document.getElementById("order-name-label").textContent = isMail ? "訂貨人姓名 *" : "聯絡人姓名 *";
    document.getElementById("order-phone-label").textContent = isMail ? "訂貨人電話 *" : "聯絡人手機 *";
    document.getElementById("order-date-label").textContent = isMail ? "寄出日期" : "取貨日期";

    document.getElementById("order-recipient-address").required = isMail;
    const sameAsOrderer = document.getElementById("order-same-as-orderer");
    if (!isMail) sameAsOrderer.checked = false;
    ["order-recipient-name", "order-recipient-phone"].forEach(id => {
      document.getElementById(id).required = isMail && !sameAsOrderer.checked;
    });
  };
  document.getElementById("pickup-method-pickup").addEventListener("click", () => setPickupMethod("pickup"));
  document.getElementById("pickup-method-mail").addEventListener("click", () => setPickupMethod("mail"));
  setPickupMethod("pickup");

  const resetOrderFormAndGoHome = () => {
    state.cart = [];
    state.screenStack = ["home"];
    document.getElementById("order-form").reset();
    document.getElementById("order-recipient-name-phone").classList.remove("hidden");
    setPickupMethod("pickup");
    showScreen("home");
  };
  document.getElementById("btn-back-home-success").addEventListener("click", resetOrderFormAndGoHome);
  document.getElementById("btn-back-home-fallback").addEventListener("click", resetOrderFormAndGoHome);

  showScreen("home");
});
