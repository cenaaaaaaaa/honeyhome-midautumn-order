/**
 * ============================================================
 * 巧家麵包店 出貨系統 - 資料窗口（Google Apps Script）
 * ============================================================
 *
 * 這個檔案要貼到「跟訂購網頁共用的那份 Google 試算表」裡的 Apps Script。
 * 開法：打開那份試算表 → 上面選單「擴充功能」→「Apps Script」→
 *       把裡面預設的內容全部刪掉，貼上這整份檔案 → 存檔 → 部署成網頁應用程式。
 *
 * 這個腳本只會「讀」客人下單的那張表單回應表（不會動它），
 * 另外自己建一張新的分頁「出貨管理」來存出貨系統自己的資料
 * （手動 key 的訂單、出貨狀態、備料彙總都在這張新分頁裡）。
 *
 * 之後如果又多了新欄位，這份腳本會自動幫「出貨管理」分頁的表頭補上新欄位
 * （只會加在最後面，不會動到既有欄位跟資料，符合「只加不刪」的原則）。
 */

// ---------- 設定 ----------

// 大家共用的簡單密碼，第一次部署前請改成你們自己要用的密碼。
const SHARED_PASSWORD = "請改成你們自己的密碼";

// 出貨系統自己使用的分頁名稱，不會跟客人下單那張表衝突。
const SHIP_SHEET_NAME = "出貨管理";

// 出貨管理分頁應該要有的所有欄位。之後要加新欄位，直接加在這個陣列最後面就好，
// 腳本下次執行時會自動幫既有的分頁補上新表頭，不用手動改試算表。
const SHIP_HEADERS = [
  "訂單ID", "來源", "來源列號", "建立人", "取貨方式",
  "取貨日期", "寄件日期", "訂貨人姓名", "訂貨人電話",
  "收貨人姓名", "收貨人電話", "收貨人地址",
  "品項明細JSON", "總金額", "備註", "出貨狀態",
  "建立時間", "完成人", "完成時間", "刪除人", "刪除時間",
];

// ---------- 入口：GET（讀取訂單清單） ----------

function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    checkPassword(params.pwd);

    if (params.action === "orders" || !params.action) {
      syncFormOrders_();
      const orders = readShipOrders_();
      return jsonOut_({ ok: true, orders });
    }

    return jsonOut_({ ok: false, error: "未知的 action：" + params.action });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err.message || err) });
  }
}

// ---------- 入口：POST（新增手動訂單 / 更新出貨狀態 / 刪除） ----------

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    checkPassword(body.pwd);

    if (body.action === "addOrder") {
      const order = addManualOrder_(body.order || {});
      return jsonOut_({ ok: true, order });
    }

    if (body.action === "updateStatus") {
      updateStatus_(body.orderId, body.status, body.operator);
      return jsonOut_({ ok: true });
    }

    if (body.action === "deleteOrder") {
      deleteOrder_(body.orderId, body.operator);
      return jsonOut_({ ok: true });
    }

    return jsonOut_({ ok: false, error: "未知的 action：" + body.action });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err.message || err) });
  }
}

// ---------- 密碼檢查 ----------

function checkPassword(pwd) {
  if (!SHARED_PASSWORD || pwd !== SHARED_PASSWORD) {
    throw new Error("密碼不正確");
  }
}

// ---------- 出貨管理分頁：取得 / 表頭自動補齊 ----------

function getShipSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHIP_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHIP_SHEET_NAME);
    sheet.appendRow(SHIP_HEADERS);
    sheet.setFrozenRows(1);
  } else {
    ensureShipHeaders_(sheet);
  }
  return sheet;
}

// 檢查分頁目前的表頭，缺什麼就補在最後一欄，不動既有欄位順序跟資料。
function ensureShipHeaders_(sheet) {
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  const missing = SHIP_HEADERS.filter(h => currentHeaders.indexOf(h) === -1);
  missing.forEach((h, i) => {
    sheet.getRange(1, lastCol + 1 + i).setValue(h);
  });
}

function getShipHeaderIndex_(sheet) {
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const idx = {};
  headers.forEach((h, i) => { idx[h] = i; }); // 0-based
  return idx;
}

// 依表頭名稱把一筆資料組成正確順序的列，缺的欄位留空字串。
function buildRowByHeaderName_(sheet, valuesByHeader) {
  const idx = getShipHeaderIndex_(sheet);
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const row = new Array(lastCol).fill("");
  Object.keys(valuesByHeader).forEach(h => {
    if (h in idx) row[idx[h]] = valuesByHeader[h];
  });
  return row;
}

// ---------- 出貨管理分頁：讀取 / 新增 / 更新 / 刪除 ----------

function readShipOrders_() {
  const sheet = getShipSheet_();
  const range = sheet.getDataRange().getValues();
  if (range.length < 2) return [];
  const headers = range[0];
  const idCol = headers.indexOf("訂單ID");
  const rows = range.slice(1);
  return rows
    .filter(row => row[idCol]) // 訂單ID 有值才算一筆
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i]; });
      obj["取貨日期"] = formatDate_(obj["取貨日期"]);
      obj["寄件日期"] = formatDate_(obj["寄件日期"]);
      obj["建立時間"] = formatDateTime_(obj["建立時間"]);
      obj["完成時間"] = formatDateTime_(obj["完成時間"]);
      obj["刪除時間"] = formatDateTime_(obj["刪除時間"]);
      try {
        obj["品項明細"] = obj["品項明細JSON"] ? JSON.parse(obj["品項明細JSON"]) : { lines: [] };
      } catch (err) {
        obj["品項明細"] = { lines: [] };
      }
      return obj;
    });
}

function addManualOrder_(order) {
  const sheet = getShipSheet_();
  const id = Utilities.getUuid();
  const now = new Date();
  const lines = Array.isArray(order.lines) ? order.lines : [];

  const row = buildRowByHeaderName_(sheet, {
    "訂單ID": id,
    "來源": "manual",
    "建立人": order.operator || "",
    "取貨方式": order.method || "",
    "取貨日期": order.pickupDate || "",
    "寄件日期": order.mailDate || "",
    "訂貨人姓名": order.customerName || "",
    "訂貨人電話": order.customerPhone || "",
    "收貨人姓名": order.recipientName || "",
    "收貨人電話": order.recipientPhone || "",
    "收貨人地址": order.recipientAddress || "",
    "品項明細JSON": JSON.stringify({ lines }),
    "總金額": order.total || "",
    "備註": order.note || "",
    "出貨狀態": "未處理",
    "建立時間": now,
  });
  sheet.appendRow(row);

  return { id };
}

function findShipRow_(sheet, orderId) {
  if (!orderId) throw new Error("缺少 orderId");
  const range = sheet.getDataRange().getValues();
  const headers = range[0];
  const idCol = headers.indexOf("訂單ID");
  for (let i = 1; i < range.length; i++) {
    if (range[i][idCol] === orderId) {
      return { rowNum: i + 1, headers };
    }
  }
  throw new Error("找不到這筆訂單：" + orderId);
}

function updateStatus_(orderId, status, operator) {
  const sheet = getShipSheet_();
  const { rowNum, headers } = findShipRow_(sheet, orderId);
  const statusCol = headers.indexOf("出貨狀態");
  const doneByCol = headers.indexOf("完成人");
  const doneAtCol = headers.indexOf("完成時間");

  sheet.getRange(rowNum, statusCol + 1).setValue(status);
  if (status === "已完成") {
    sheet.getRange(rowNum, doneByCol + 1).setValue(operator || "");
    sheet.getRange(rowNum, doneAtCol + 1).setValue(new Date());
  } else {
    sheet.getRange(rowNum, doneByCol + 1).setValue("");
    sheet.getRange(rowNum, doneAtCol + 1).setValue("");
  }
}

// 「刪除」用的是軟刪除：只是把出貨狀態改成「已刪除」，資料本身還留在表格裡，
// 不會真的清掉那一列，符合「只加不刪」的原則，之後真的需要都還能從表格救回來。
function deleteOrder_(orderId, operator) {
  const sheet = getShipSheet_();
  const { rowNum, headers } = findShipRow_(sheet, orderId);
  const statusCol = headers.indexOf("出貨狀態");
  const delByCol = headers.indexOf("刪除人");
  const delAtCol = headers.indexOf("刪除時間");

  sheet.getRange(rowNum, statusCol + 1).setValue("已刪除");
  sheet.getRange(rowNum, delByCol + 1).setValue(operator || "");
  sheet.getRange(rowNum, delAtCol + 1).setValue(new Date());
}

// ---------- 同步：把客人網頁下的新訂單，從表單回應表搬一份進出貨管理 ----------

function syncFormOrders_() {
  const formSheet = findFormResponseSheet_();
  if (!formSheet) return; // 找不到表單回應表就跳過同步，不影響手動輸入的訂單

  const data = formSheet.getDataRange().getValues();
  if (data.length < 2) return;
  const headers = data[0];

  const col = (keywords) => findColumn_(headers, keywords);
  const colName = col(["訂貨人", "姓名"]);
  const colPhone = col(["訂貨人電話", "電話"]);
  const colRecipientName = col(["收貨人姓名", "收貨人"]);
  const colRecipientPhone = col(["收貨人電話"]);
  const colRecipientAddress = col(["收貨人地址", "地址"]);
  const colDate = col(["到貨日期", "取貨日期", "日期"]);
  const colSummary = col(["禮盒內容", "明細", "內容"]);
  const colTotal = col(["總金額", "金額"]);
  const colNote = col(["備註"]);
  const colDetailJson = col(["明細JSON", "detailJson"]);

  const shipSheet = getShipSheet_();
  const existing = shipSheet.getDataRange().getValues();
  const existingHeaders = existing[0];
  const srcRowCol = existingHeaders.indexOf("來源列號");
  const srcTypeCol = existingHeaders.indexOf("來源");
  const syncedRows = new Set();
  for (let i = 1; i < existing.length; i++) {
    if (existing[i][srcTypeCol] === "customer_form" && existing[i][srcRowCol]) {
      syncedRows.add(String(existing[i][srcRowCol]));
    }
  }

  const newRows = [];
  for (let r = 1; r < data.length; r++) {
    const formRowNum = r + 1;
    if (syncedRows.has(String(formRowNum))) continue;
    const name = colName != null ? data[r][colName] : "";
    if (!name) continue; // 空白列跳過

    const summaryText = colSummary != null ? String(data[r][colSummary] || "") : "";
    const methodMatch = summaryText.match(/【取貨方式[：:]\s*([^】]+)】/);
    const method = methodMatch ? methodMatch[1] : "";

    let lines = [];
    if (colDetailJson != null && data[r][colDetailJson]) {
      lines = flattenDetailJson_(data[r][colDetailJson]);
    }

    newRows.push(buildRowByHeaderName_(shipSheet, {
      "訂單ID": Utilities.getUuid(),
      "來源": "customer_form",
      "來源列號": formRowNum,
      "建立人": "客人網頁下單",
      "取貨方式": method,
      "取貨日期": formatDate_(colDate != null ? data[r][colDate] : ""),
      "訂貨人姓名": colName != null ? data[r][colName] : "",
      "訂貨人電話": colPhone != null ? data[r][colPhone] : "",
      "收貨人姓名": colRecipientName != null ? data[r][colRecipientName] : "",
      "收貨人電話": colRecipientPhone != null ? data[r][colRecipientPhone] : "",
      "收貨人地址": colRecipientAddress != null ? data[r][colRecipientAddress] : "",
      "品項明細JSON": JSON.stringify({ lines, raw: lines.length ? undefined : summaryText }),
      "總金額": colTotal != null ? data[r][colTotal] : "",
      "備註": colNote != null ? data[r][colNote] : "",
      "出貨狀態": "未處理",
      "建立時間": new Date(),
    }));
  }

  if (newRows.length) {
    const lastCol = Math.max(shipSheet.getLastColumn(), 1);
    shipSheet.getRange(shipSheet.getLastRow() + 1, 1, newRows.length, lastCol).setValues(newRows);
  }
}

// 把訂購網頁送過來的 detailJson（{method, boxes:[{items:[{productName, flavors:[{flavor,qty}]}], boxQty}]}）
// 攤平成統一的 {productName, flavor, qty} 陣列，跟手動輸入的訂單用同一種格式，方便加總。
function flattenDetailJson_(raw) {
  try {
    const parsed = JSON.parse(raw);
    const lines = [];
    (parsed.boxes || []).forEach(box => {
      const boxQty = box.boxQty || 1;
      (box.items || []).forEach(item => {
        (item.flavors || []).forEach(f => {
          lines.push({
            productName: item.productName,
            flavor: f.flavor,
            qty: (f.qty || 0) * boxQty,
          });
        });
      });
    });
    return lines;
  } catch (err) {
    return [];
  }
}

function findFormResponseSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  for (const sheet of sheets) {
    if (sheet.getName() === SHIP_SHEET_NAME) continue;
    const firstRow = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
    const joined = firstRow.join(" ");
    if (joined.indexOf("禮盒") !== -1 || joined.indexOf("訂貨人") !== -1) {
      return sheet;
    }
  }
  // 沒找到符合特徵的表頭，退而求其次用第一張非「出貨管理」的分頁
  for (const sheet of sheets) {
    if (sheet.getName() !== SHIP_SHEET_NAME) return sheet;
  }
  return null;
}

function findColumn_(headers, keywords) {
  for (let i = 0; i < headers.length; i++) {
    const h = String(headers[i] || "");
    if (keywords.some(k => h.indexOf(k) !== -1)) return i;
  }
  return null;
}

// ---------- 小工具 ----------

function formatDate_(value) {
  if (!value) return "";
  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return String(value);
}

function formatDateTime_(value) {
  if (!value) return "";
  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm");
  }
  return String(value);
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
