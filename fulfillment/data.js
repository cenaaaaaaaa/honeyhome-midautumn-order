// ============================================================
// 巧家麵包店 出貨系統 - 資料設定
// ============================================================

// 【出貨系統 API 設定】
// 完成 apps-script/Code.gs 的部署後，把產生的網頁應用程式網址貼在這裡。
const FULFILLMENT_API = {
  url: "", // 例如 https://script.google.com/macros/s/xxxxxxxx/exec
};

// 「現在操作的人」名單，之後隨時可以加人。
const STAFF = ["媽咪", "亮賊", "以賊", "祖庭", "葉嘉"];

// 取貨方式，四選一。
const PICKUP_METHODS = ["自取", "郵寄", "媽媽帶去", "二叔送去"];

// key 訂單時可以選的品項與口味。
// 蛋黃酥比客人訂購網頁多 3 種「無蛋」口味，這三種先只給店裡手動輸入用，
// 客人網頁上的口味選單不受影響。
const FF_PRODUCTS = [
  {
    key: "danhuangsu",
    name: "蛋黃酥",
    unit: "顆",
    flavors: ["烏豆沙", "綠豆", "芋泥", "無蛋芋泥", "無蛋綠豆沙", "無蛋烏豆沙"],
  },
  {
    key: "shuiguosu",
    name: "水果酥",
    unit: "個",
    flavors: ["草莓", "哈密瓜", "梅子", "鳳梨"],
  },
  {
    key: "ludoupeng",
    name: "綠豆椪",
    unit: "顆",
    flavors: ["綠豆（素）", "蝦米肉燥（葷）"],
  },
  {
    key: "xiaoyuebing",
    name: "小月餅",
    unit: "個",
    flavors: ["蓮蓉", "香菇滷肉", "烏豆沙", "綠茶", "北海道牛奶"],
  },
  {
    key: "tufengli",
    name: "精緻土鳳梨酥禮盒",
    unit: "盒（12 入）",
    flavors: ["整盒固定內容"],
  },
];
