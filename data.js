// ============================================================
// 巧家麵包店 中秋禮盒資料
// 依據「巧家麵包店精緻中秋禮盒訂購表單」PDF 整理（2026-08-23）
// 之後如果品項/口味/價格有調整，只需要改這個檔案即可。
// ============================================================

// 每次更新 assets/img 裡的照片，把這個數字 +1，
// 網頁就會強迫瀏覽器重新抓最新的圖，不會一直卡舊的快取版本。
const ASSET_VERSION = 3;
function imgV(path) {
  return path ? `${path}?v=${ASSET_VERSION}` : path;
}

const SHOP_INFO = {
  name: "巧家麵包店",
  phone: "06-259-5077",
  phoneDisplay: "06-259-5077",
  line: "@363hzjvs",
  lineUrl: "https://line.me/R/ti/p/@363hzjvs",
  note: "若有任何疑問，請撥打專線或加 LINE，即有專人為您服務。",
};

// 單品資料（給「今年單顆價格」與組合工具共用）
const PRODUCTS = {
  danhuangsu: {
    key: "danhuangsu",
    name: "蛋黃酥",
    subtitle: "全蛋",
    price: 50,
    unit: "顆",
    flavors: ["烏豆沙", "綠豆", "芋泥"],
    img: "assets/img/danhuangsu.jpg",
  },
  shuiguosu: {
    key: "shuiguosu",
    name: "水果酥",
    subtitle: "全素",
    price: 35,
    unit: "個",
    flavors: ["草莓", "哈密瓜", "梅子", "鳳梨"],
    img: "assets/img/shuiguosu.png",
  },
  ludoupeng: {
    key: "ludoupeng",
    name: "綠豆椪",
    subtitle: null,
    price: 50,
    unit: "顆",
    flavors: ["綠豆（素）", "蝦米肉燥（葷）"],
    img: "assets/img/ludoupeng.png",
  },
  xiaoyuebing: {
    key: "xiaoyuebing",
    name: "小月餅",
    subtitle: null,
    price: 45,
    unit: "個",
    flavors: ["蓮蓉", "香菇滷肉", "烏豆沙", "綠茶", "北海道牛奶"],
    img: "assets/img/xiaoyuebing.png",
  },
};

// 固定禮盒（不能拆單品自組，價格與內容都是整組固定）
const FIXED_BOXES = [
  {
    id: "tufengli",
    name: "精緻土鳳梨酥禮盒",
    size: "12 入",
    price: 420,
    desc: "整盒固定內容，無法調整口味比例。",
    img: "assets/img/tufengli.png",
  },
];

// 單一品項禮盒（同一種商品湊滿指定顆數，口味可自由搭配）
const SINGLE_BOXES = [
  {
    id: "danhuangsu-box",
    name: "蛋黃酥禮盒",
    productKey: "danhuangsu",
    sizes: [12, 15, 20],
    img: "assets/img/danhuangsu-box.png",
  },
  {
    id: "shuiguosu-box",
    name: "水果酥禮盒",
    productKey: "shuiguosu",
    sizes: [12, 15, 20],
    img: "assets/img/shuiguosu-box.png",
  },
  {
    id: "ludoupeng-box",
    name: "綠豆椪禮盒",
    productKey: "ludoupeng",
    sizes: [6, 12],
    img: "assets/img/ludoupeng-6.png",
  },
];

// 混搭禮盒（★混搭專區：跨品項組合）
const MIX_BOXES = [
  {
    id: "A",
    name: "A．蛋黃酥＋水果酥 綜合禮盒",
    type: "mixFree", // 自由分配口味，湊滿選定顆數即可
    productKeys: ["danhuangsu", "shuiguosu"],
    sizes: [12, 15, 20],
    img: "assets/img/mix-a.png",
  },
  {
    id: "B",
    name: "B．蛋黃酥 6 入＋綠豆椪 4 入",
    type: "mixFixed", // 每個品項數量固定，口味在各自數量內自由選
    parts: [
      { productKey: "danhuangsu", qty: 6 },
      { productKey: "ludoupeng", qty: 4 },
    ],
    img: "assets/img/mix-b.png",
  },
  {
    id: "C",
    name: "C．蛋黃酥 8 入＋綠豆椪 6 入",
    type: "mixFixed",
    parts: [
      { productKey: "danhuangsu", qty: 8 },
      { productKey: "ludoupeng", qty: 6 },
    ],
    img: "assets/img/mix-c.png",
  },
  {
    id: "D",
    name: "D．蛋黃酥＋水果酥＋小月餅 綜合禮盒",
    type: "mixFree",
    productKeys: ["danhuangsu", "shuiguosu", "xiaoyuebing"],
    sizes: [12, 15, 20],
    img: "assets/img/mix-d.png",
  },
];

// 給「自己組合看看」頁面用：把所有可以互動組合的禮盒放在一起
// （固定禮盒不需要互動組合，所以不放進來）
const COMBOABLE_BOXES = [...SINGLE_BOXES.map(b => ({ ...b, type: "single" })), ...MIX_BOXES];
