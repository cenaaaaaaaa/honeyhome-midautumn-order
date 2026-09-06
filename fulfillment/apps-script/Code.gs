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
  "最後修改人", "最後修改時間",
];

// ---------- 入口：GET（讀取訂單清單） ----------

function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    checkPassword(params.pwd);

    if (params.action === "orders" || !params.action) {
      syncFormOrders_();
      backfillBoxes_();
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

    if (body.action === "updateOrder") {
      updateOrder_(body.orderId, body.order || {});
      return jsonOut_({ ok: true });
    }

    if (body.action === "updateStatus") {
      updateStatus_(body.orderId, body.status, body.operator);
      return jsonOut_({ ok: true });
    }

    if (body.action === "deleteOrder") {
      deleteOrder_(body.orderId, body.operator);
      return jsonOut_({ ok: true });
    }

    if (body.action === "updateBoxStatus") {
      updateBoxStatus_(body.orderId, body.boxIndex, body.done);
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
        obj["品項明細"] = obj["品項明細JSON"] ? JSON.parse(obj["品項明細JSON"]) : { boxes: [] };
      } catch (err) {
        obj["品項明細"] = { boxes: [] };
      }
      return obj;
    });
}

function addManualOrder_(order) {
  const sheet = getShipSheet_();
  const id = Utilities.getUuid();
  const now = new Date();
  const boxes = (Array.isArray(order.boxes) ? order.boxes : []).map(b => ({
    boxName: b.boxName || "",
    size: b.size || null,
    boxQty: b.boxQty || 1,
    packagingKey: b.packagingKey || null,
    packagingLabel: b.packagingLabel || null,
    packagingFee: b.packagingFee || 0,
    lines: Array.isArray(b.lines) ? b.lines : [],
    done: false,
  }));

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
    "品項明細JSON": JSON.stringify({ boxes }),
    "總金額": order.total || "",
    "備註": order.note || "",
    "出貨狀態": "未處理",
    "建立時間": now,
  });
  sheet.appendRow(row);

  return { id };
}

// 編輯既有訂單：可以是手動 key 的訂單，也可以是客人網頁下單同步進來的訂單。
// 「訂單ID」「來源」「來源列號」「建立人」「建立時間」都保持不變，
// 只覆蓋可調整的欄位，另外記錄「最後修改人」「最後修改時間」方便之後回頭查是誰、什麼時候改的。
// 如果訂單原本已經標記完成，編輯後內容可能已經跟包裝好的東西不一樣，
// 所以會自動把「出貨狀態」跟每個品項的完成勾選都重設回未處理，需要重新核對。
function updateOrder_(orderId, order) {
  const sheet = getShipSheet_();
  const { rowNum, headers } = findShipRow_(sheet, orderId);
  const idx = {};
  headers.forEach((h, i) => { idx[h] = i; });

  const boxes = (Array.isArray(order.boxes) ? order.boxes : []).map(b => ({
    boxName: b.boxName || "",
    size: b.size || null,
    boxQty: b.boxQty || 1,
    packagingKey: b.packagingKey || null,
    packagingLabel: b.packagingLabel || null,
    packagingFee: b.packagingFee || 0,
    lines: Array.isArray(b.lines) ? b.lines : [],
    done: false,
  }));

  const updates = {
    "取貨方式": order.method || "",
    "取貨日期": order.pickupDate || "",
    "寄件日期": order.mailDate || "",
    "訂貨人姓名": order.customerName || "",
    "訂貨人電話": order.customerPhone || "",
    "收貨人姓名": order.recipientName || "",
    "收貨人電話": order.recipientPhone || "",
    "收貨人地址": order.recipientAddress || "",
    "品項明細JSON": JSON.stringify({ boxes: boxes }),
    "總金額": order.total || "",
    "備註": order.note || "",
    "最後修改人": order.operator || "",
    "最後修改時間": new Date(),
  };

  const statusCol = idx["出貨狀態"];
  if (statusCol != null) {
    const currentStatus = sheet.getRange(rowNum, statusCol + 1).getValue();
    if (currentStatus === "已完成") {
      updates["出貨狀態"] = "未處理";
      updates["完成人"] = "";
      updates["完成時間"] = "";
    }
  }

  Object.keys(updates).forEach(h => {
    if (h in idx) sheet.getRange(rowNum, idx[h] + 1).setValue(updates[h]);
  });
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

// 單一品項（禮盒組合）的完成狀態，存在「品項明細JSON」欄位裡 boxes[boxIndex].done，
// 跟「整張訂單」的出貨狀態是分開的兩件事：一張訂單可能有好幾個品項，
// 各自包裝完成的進度用這個記錄，全部包完之後再用整張訂單的「標記完成」做總結。
function updateBoxStatus_(orderId, boxIndex, done) {
  if (boxIndex == null) throw new Error("缺少 boxIndex");
  const sheet = getShipSheet_();
  const { rowNum, headers } = findShipRow_(sheet, orderId);
  const detailCol = headers.indexOf("品項明細JSON");
  const cell = sheet.getRange(rowNum, detailCol + 1);

  let detail;
  try {
    detail = JSON.parse(cell.getValue() || "{}");
  } catch (err) {
    detail = {};
  }
  if (!Array.isArray(detail.boxes) || !detail.boxes[boxIndex]) {
    throw new Error("找不到這個品項");
  }
  detail.boxes[boxIndex].done = !!done;
  cell.setValue(JSON.stringify(detail));
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

    // 優先用結構化的 detailJson（如果有設定的話最準，還帶有品項分組），
    // 沒有的話直接從「禮盒內容」文字解析並依「【第 N 項】」分組，
    // 這個文字格式是網頁自己固定產生的，解析起來很可靠，不強制要求一定要設定 detailJson 才能用。
    let boxes = [];
    if (colDetailJson != null && data[r][colDetailJson]) {
      boxes = groupedBoxesFromDetailJson_(data[r][colDetailJson]);
    }
    if (!boxes.length) {
      boxes = parseSummaryBoxes_(summaryText);
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
      "品項明細JSON": JSON.stringify({ boxes: boxes, raw: summaryText }),
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

// 把訂購網頁送過來的 detailJson（{method, boxes:[{boxName, size, boxQty, items:[{productName, flavors:[{flavor,qty}]}]}]}）
// 轉成出貨系統統一的分組格式：每個禮盒品項一組，組內是 {productName, flavor, qty} 清單，
// 這樣才能讓每個品項各自標記完成，不是整張訂單綁在一起。
function groupedBoxesFromDetailJson_(raw) {
  try {
    const parsed = JSON.parse(raw);
    return (parsed.boxes || []).map(box => {
      const boxQty = box.boxQty || 1;
      const lines = [];
      (box.items || []).forEach(item => {
        (item.flavors || []).forEach(f => {
          lines.push({ productName: item.productName, flavor: f.flavor, qty: (f.qty || 0) * boxQty });
        });
      });
      return {
        boxName: box.boxName || "",
        size: box.size || null,
        boxQty: boxQty,
        packagingKey: box.packagingKey || null,
        packagingLabel: box.packagingLabel || null,
        packagingFee: box.packagingFee || 0,
        lines: lines,
        done: false,
      };
    });
  } catch (err) {
    return [];
  }
}

// 從「禮盒內容」的原始文字直接解析出分組的品項清單。文字格式是訂購網頁自己固定產生的，
// 每個品項用「【第 N 項】」隔開，長得像：
//   【第 1 項】禮盒：蛋黃酥禮盒
//   份量：15 入
//   蛋黃酥：綠豆 x10、烏豆沙 x2、芋泥 x3
//   總金額：$750
// 「禮盒/份量/訂購盒數/總金額」這些是說明列，其餘的「品名：口味 x數量」列才是實際品項。
function parseSummaryBoxes_(summaryText) {
  if (!summaryText) return [];
  const text = String(summaryText).replace(/^【取貨方式[：:][^】]*】\n?/, "");
  const blocks = text.split(/(?=【第\s*\d+\s*項】)/).map(b => b.trim()).filter(Boolean);

  // 沒有「【第 N 項】」這種分組標記（例如很舊的測試資料），整段當一個品項處理
  const sourceBlocks = blocks.length ? blocks : (text.trim() ? [text.trim()] : []);

  return sourceBlocks.map(block => {
    const cleaned = block.replace(/^【第\s*\d+\s*項】/, "");
    const rows = cleaned.split("\n").map(r => r.trim()).filter(Boolean);
    let boxName = "";
    let size = null;
    let boxQty = 1;
    const lines = [];

    rows.forEach(row => {
      const m = row.match(/^([^：]+)：(.+)$/);
      if (!m) return;
      const label = m[1].trim();
      const rest = m[2].trim();
      if (label.indexOf("禮盒") !== -1) { boxName = rest; return; }
      if (label.indexOf("份量") !== -1) { size = rest; return; }
      if (label.indexOf("訂購盒數") !== -1) { boxQty = parseInt(rest, 10) || 1; return; }
      if (label.indexOf("總金額") !== -1) return;

      rest.split("、").forEach(part => {
        const fm = part.trim().match(/^(.+?)\s*[x×]\s*(\d+)\s*$/i);
        if (fm) lines.push({ productName: label, flavor: fm[1].trim(), qty: Number(fm[2]) });
      });
    });

    return { boxName: boxName, size: size, boxQty: boxQty, lines: lines, done: false };
  }).filter(box => box.lines.length || box.boxName);
}

// 一次性補救：出貨管理分頁裡，之前同步進來但還是舊格式（沒有分組 boxes，
// 或是還沒有品項明細）的客人訂單，重新用它們身上留著的原始文字（raw）解析一次，
// 補成分組格式，用 setValue 直接改同一格，不會新增或刪除任何一列/一欄。
function backfillBoxes_() {
  const sheet = getShipSheet_();
  const range = sheet.getDataRange().getValues();
  if (range.length < 2) return;
  const headers = range[0];
  const detailCol = headers.indexOf("品項明細JSON");
  const srcCol = headers.indexOf("來源");
  if (detailCol === -1) return;

  for (let i = 1; i < range.length; i++) {
    if (range[i][srcCol] !== "customer_form") continue;
    const raw = range[i][detailCol];
    if (!raw) continue;
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      continue;
    }
    if (Array.isArray(parsed.boxes) && parsed.boxes.length) continue; // 已經是分組格式，不用補
    if (!parsed.raw) continue; // 沒有原始文字可以重新解析

    const newBoxes = parseSummaryBoxes_(parsed.raw);
    if (newBoxes.length) {
      sheet.getRange(i + 1, detailCol + 1).setValue(JSON.stringify({ boxes: newBoxes, raw: parsed.raw }));
    }
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
