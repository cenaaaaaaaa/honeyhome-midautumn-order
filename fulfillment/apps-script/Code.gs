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
 */

// ---------- 設定 ----------

// 大家共用的簡單密碼，第一次部署前請改成你們自己要用的密碼。
const SHARED_PASSWORD = "請改成你們自己的密碼";

// 出貨系統自己使用的分頁名稱，不會跟客人下單那張表衝突。
const SHIP_SHEET_NAME = "出貨管理";

// 出貨管理分頁的欄位順序（新分頁會自動照這個順序建立表頭）。
const SHIP_HEADERS = [
  "訂單ID", "來源", "來源列號", "建立人", "取貨方式",
  "取貨日期", "寄件日期", "訂貨人姓名", "訂貨人電話",
  "收貨人姓名", "收貨人電話", "收貨人地址",
  "品項明細JSON", "總金額", "備註", "出貨狀態",
  "建立時間", "完成人", "完成時間",
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

// ---------- 入口：POST（新增手動訂單 / 更新出貨狀態） ----------

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

// ---------- 出貨管理分頁：讀取 / 新增 / 更新 ----------

function getShipSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHIP_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHIP_SHEET_NAME);
    sheet.appendRow(SHIP_HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function readShipOrders_() {
  const sheet = getShipSheet_();
  const range = sheet.getDataRange().getValues();
  if (range.length < 2) return [];
  const headers = range[0];
  const rows = range.slice(1);
  return rows
    .filter(row => row[0]) // 訂單ID 有值才算一筆
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i]; });
      obj["取貨日期"] = formatDate_(obj["取貨日期"]);
      obj["寄件日期"] = formatDate_(obj["寄件日期"]);
      obj["建立時間"] = formatDateTime_(obj["建立時間"]);
      obj["完成時間"] = formatDateTime_(obj["完成時間"]);
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

  sheet.appendRow([
    id,
    "manual",
    "",
    order.operator || "",
    order.method || "",
    order.pickupDate || "",
    order.mailDate || "",
    order.customerName || "",
    order.customerPhone || "",
    order.recipientName || "",
    order.recipientPhone || "",
    order.recipientAddress || "",
    JSON.stringify({ lines }),
    order.total || "",
    order.note || "",
    "未處理",
    now,
    "",
    "",
  ]);

  return { id };
}

function updateStatus_(orderId, status, operator) {
  if (!orderId) throw new Error("缺少 orderId");
  const sheet = getShipSheet_();
  const range = sheet.getDataRange().getValues();
  const headers = range[0];
  const idCol = headers.indexOf("訂單ID");
  const statusCol = headers.indexOf("出貨狀態");
  const doneByCol = headers.indexOf("完成人");
  const doneAtCol = headers.indexOf("完成時間");

  for (let i = 1; i < range.length; i++) {
    if (range[i][idCol] === orderId) {
      const rowNum = i + 1;
      sheet.getRange(rowNum, statusCol + 1).setValue(status);
      if (status === "已完成") {
        sheet.getRange(rowNum, doneByCol + 1).setValue(operator || "");
        sheet.getRange(rowNum, doneAtCol + 1).setValue(new Date());
      } else {
        sheet.getRange(rowNum, doneByCol + 1).setValue("");
        sheet.getRange(rowNum, doneAtCol + 1).setValue("");
      }
      return;
    }
  }
  throw new Error("找不到這筆訂單：" + orderId);
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

    newRows.push([
      Utilities.getUuid(),
      "customer_form",
      formRowNum,
      "客人網頁下單",
      method,
      formatDate_(colDate != null ? data[r][colDate] : ""),
      "",
      colName != null ? data[r][colName] : "",
      colPhone != null ? data[r][colPhone] : "",
      colRecipientName != null ? data[r][colRecipientName] : "",
      colRecipientPhone != null ? data[r][colRecipientPhone] : "",
      colRecipientAddress != null ? data[r][colRecipientAddress] : "",
      JSON.stringify({ lines, raw: lines.length ? undefined : summaryText }),
      colTotal != null ? data[r][colTotal] : "",
      colNote != null ? data[r][colNote] : "",
      "未處理",
      new Date(),
      "",
      "",
    ]);
  }

  if (newRows.length) {
    shipSheet.getRange(shipSheet.getLastRow() + 1, 1, newRows.length, SHIP_HEADERS.length).setValues(newRows);
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
