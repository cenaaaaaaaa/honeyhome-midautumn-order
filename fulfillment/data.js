// ============================================================
// 巧家麵包店 出貨系統 - 資料設定
// ============================================================

// 【出貨系統 API 設定】
// 完成 apps-script/Code.gs 的部署後，把產生的網頁應用程式網址貼在這裡。
const FULFILLMENT_API = {
  url: "https://script.google.com/macros/s/AKfycbwYNyho6dLgQCI4UqPs6h9Hunv8FZszdgkBNgHxNR9Eu-IesBRAuqITaOOmQO4VgAZ_/exec",
};

// 「現在操作的人」名單，之後隨時可以加人。
const STAFF = ["媽咪", "亮賊", "以賊", "祖庭", "葉嘉"];

// 取貨方式，四選一。
const PICKUP_METHODS = ["自取", "郵寄", "媽媽帶去", "二叔送去"];

// ============================================================
// 以下的品項/禮盒結構跟訂購網頁的 data.js 是同一套規格，
// 這樣 key 訂單時選的禮盒樣式才會跟客人網頁上看到的一致。
// 差異只有：蛋黃酥多了 3 種「無蛋」口味，這三種只在這裡（店裡手動輸入）出現，
// 客人網頁上的口味選單不受影響。
// ============================================================

const PRODUCTS = {
  danhuangsu: {
    key: "danhuangsu",
    name: "蛋黃酥",
    price: 50,
    unit: "顆",
    flavors: ["烏豆沙", "綠豆", "芋泥", "無蛋芋泥", "無蛋綠豆沙", "無蛋烏豆沙"],
    img: "../assets/img/danhuangsu.jpg",
  },
  shuiguosu: {
    key: "shuiguosu",
    name: "水果酥",
    price: 35,
    unit: "個",
    flavors: ["草莓", "哈密瓜", "梅子", "鳳梨"],
    img: "../assets/img/shuiguosu.png",
  },
  ludoupeng: {
    key: "ludoupeng",
    name: "綠豆椪",
    price: 50,
    unit: "顆",
    flavors: ["綠豆（素）", "蝦米肉燥（葷）"],
    img: "../assets/img/ludoupeng.png",
  },
  xiaoyuebing: {
    key: "xiaoyuebing",
    name: "小月餅",
    price: 45,
    unit: "個",
    flavors: ["蓮蓉", "香菇滷肉", "烏豆沙", "綠茶", "北海道牛奶"],
    img: "../assets/img/xiaoyuebing.png",
  },
};

// 固定禮盒（不能拆單品自組，價格與內容都是整組固定）
const FIXED_BOXES = [
  {
    id: "tufengli",
    name: "精緻土鳳梨酥禮盒",
    size: "12 入",
    price: 420,
    img: "../assets/img/tufengli.png",
  },
];

// 單一品項禮盒（同一種商品湊滿指定顆數，口味可自由搭配）
const SINGLE_BOXES = [
  {
    id: "danhuangsu-box",
    name: "蛋黃酥禮盒",
    productKey: "danhuangsu",
    sizes: [12, 15, 20],
    img: "../assets/img/danhuangsu-box.png",
  },
  {
    id: "shuiguosu-box",
    name: "水果酥禮盒",
    productKey: "shuiguosu",
    sizes: [12, 15, 20],
    img: "../assets/img/shuiguosu-box.png",
  },
  {
    id: "ludoupeng-box",
    name: "綠豆椪禮盒",
    productKey: "ludoupeng",
    sizes: [6, 12],
    img: "../assets/img/ludoupeng-6.png",
  },
];

// 混搭禮盒
const MIX_BOXES = [
  {
    id: "A",
    name: "A．蛋黃酥＋水果酥 綜合禮盒",
    type: "mixFree",
    productKeys: ["danhuangsu", "shuiguosu"],
    sizes: [12, 15, 20],
    img: "../assets/img/mix-a.png",
  },
  {
    id: "B",
    name: "B．蛋黃酥 6 入＋綠豆椪 4 入",
    type: "mixFixed",
    parts: [
      { productKey: "danhuangsu", qty: 6 },
      { productKey: "ludoupeng", qty: 4 },
    ],
    img: "../assets/img/mix-b.png",
  },
  {
    id: "C",
    name: "C．蛋黃酥 8 入＋綠豆椪 6 入",
    type: "mixFixed",
    parts: [
      { productKey: "danhuangsu", qty: 8 },
      { productKey: "ludoupeng", qty: 6 },
    ],
    img: "../assets/img/mix-c.png",
  },
  {
    id: "D",
    name: "D．蛋黃酥＋水果酥＋小月餅 綜合禮盒",
    type: "mixFree",
    productKeys: ["danhuangsu", "shuiguosu", "xiaoyuebing"],
    sizes: [12, 15, 20],
    img: "../assets/img/mix-d.png",
  },
];

// key 訂單時的禮盒選單：單一品項禮盒 + 混搭禮盒 + 固定禮盒，全部放在一起選。
const COMBOABLE_BOXES = [...SINGLE_BOXES.map(b => ({ ...b, type: "single" })), ...MIX_BOXES];
