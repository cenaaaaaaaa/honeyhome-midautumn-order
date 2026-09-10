// ============================================================
// 巧家麵包店 中秋禮盒資料
// 依據「巧家麵包店精緻中秋禮盒訂購表單」PDF 整理（2026-08-23）
// 之後如果品項/口味/價格有調整，只需要改這個檔案即可。
// ============================================================

// 每次更新 assets/img 裡的照片，把這個數字 +1，
// 網頁就會強迫瀏覽器重新抓最新的圖，不會一直卡舊的快取版本。
const ASSET_VERSION = 5;
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
// type: "fixed" 代表這款沒有口味可選，「組合看看」頁面只需要選要訂購幾盒
const FIXED_BOXES = [
  {
    id: "tufengli",
    name: "精緻土鳳梨酥禮盒",
    size: "12 入",
    price: 420,
    desc: "整盒固定內容，無法調整口味比例。",
    img: "assets/img/tufengli.png",
    type: "fixed",
  },
];

// 單一品項禮盒（同一種商品湊滿指定顆數，口味可自由搭配）
const SINGLE_BOXES = [
  {
    id: "danhuangsu-box",
    name: "蛋黃酥禮盒",
    productKey: "danhuangsu",
    sizes: [10, 12, 15, 20],
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
    name: "A．蛋黃酥＋水果酥＋小月餅 綜合禮盒",
    type: "mixFree", // 自由分配口味，湊滿選定顆數即可
    productKeys: ["danhuangsu", "shuiguosu", "xiaoyuebing"],
    sizes: [10, 12, 15, 20],
    // 6 入另外有兩種包裝可選：塑膠盒（原價）／紙盒（+$20 紙盒錢）。
    // 跟 sizes 是同一排「份量」選項的延伸，選了其中一個包裝，size 會自動變成 6。
    packagingOptions: [
      { key: "paper6", label: "紙盒 6 入", qty: 6, extraFee: 20 },
      { key: "plastic6", label: "塑膠盒 6 入", qty: 6, extraFee: 0 },
    ],
    img: "assets/img/mix-a.png",
  },
  {
    id: "B",
    name: "B．自選 6 入（蛋黃酥／水果酥／小月餅）＋綠豆椪 4 入",
    type: "mixFixed", // 每個品項數量固定，口味在各自數量內自由選
    parts: [
      // productKeys（複數）代表這一格是自選格，好幾種品項可以自由混搭湊滿這一格的份量，
      // 跟 productKey（單數）的固定格不一樣，渲染/計算邏輯見 app.js 的 partKeys()。
      { productKeys: ["danhuangsu", "shuiguosu", "xiaoyuebing"], qty: 6 },
      { productKey: "ludoupeng", qty: 4 },
    ],
    img: "assets/img/mix-b.png",
  },
  {
    id: "C",
    name: "C．自選 8 入（蛋黃酥／水果酥／小月餅）＋綠豆椪 6 入",
    type: "mixFixed",
    parts: [
      { productKeys: ["danhuangsu", "shuiguosu", "xiaoyuebing"], qty: 8 },
      { productKey: "ludoupeng", qty: 6 },
    ],
    img: "assets/img/mix-c.png",
  },
];

// 給「自己組合看看」頁面用：把所有可以互動組合的禮盒放在一起
// （土鳳梨酥禮盒雖然沒有口味可選，但一樣可以選「訂購幾盒」，所以也放進來）
const COMBOABLE_BOXES = [...SINGLE_BOXES.map(b => ({ ...b, type: "single" })), ...MIX_BOXES, ...FIXED_BOXES];

// ============================================================
// 產品照片頁（按鈕四）
// 老闆會陸續把照片放進雲端硬碟的「品項照片／禮盒照片／組合範例照片」
// 三個資料夾，收到後把對應照片加進下面各自的 photos 陣列即可：
//   { img: "assets/img/gallery/檔名.jpg", caption: "照片小標題" }
// 陣列是空的時候，畫面會自動顯示「照片準備中」，不會出錯。
// ============================================================
const GALLERY_CATEGORIES = [
  {
    id: "items",
    name: "品項照片",
    icon: "🥮",
    desc: "蛋黃酥、水果酥、綠豆椪等單品實拍照",
    photos: [
      { img: "assets/img/gallery/item-danhuangsu-wudousha.jpg", caption: "蛋黃酥｜烏豆沙" },
      { img: "assets/img/gallery/item-danhuangsu-lvdou.jpg", caption: "蛋黃酥｜綠豆" },
      { img: "assets/img/gallery/item-danhuangsu-yuni.jpg", caption: "蛋黃酥｜芋泥" },
      { img: "assets/img/gallery/item-ludoupeng-xiami-whole.jpg", caption: "綠豆椪｜蝦米肉燥" },
      { img: "assets/img/gallery/item-ludoupeng-xiami-cut.jpg", caption: "綠豆椪｜蝦米肉燥（內餡切面）" },
    ],
  },
  {
    id: "boxes",
    name: "禮盒照片",
    icon: "🎁",
    desc: "各種禮盒規格的完整外觀照",
    photos: [
      { img: "assets/img/danhuangsu-box.png", caption: "蛋黃酥禮盒" },
      { img: "assets/img/shuiguosu-box.png", caption: "水果酥禮盒" },
      { img: "assets/img/ludoupeng-6.png", caption: "綠豆椪禮盒" },
      { img: "assets/img/mix-b.png", caption: "B．蛋黃酥 6 入＋綠豆椪 4 入" },
      { img: "assets/img/mix-c.png", caption: "C．蛋黃酥 8 入＋綠豆椪 6 入" },
    ],
  },
];
