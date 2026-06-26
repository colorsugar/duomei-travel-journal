export type Travel = {
  slug: string;
  title: string;
  location: string;
  date: string;
  description: string;
  coverImage: string;
  images: string[];
  body: string[];
  tips: string[];
};

const gradient = (from: string, via: string, to: string) =>
  `linear-gradient(135deg, ${from}, ${via}, ${to})`;

export const travels: Travel[] = [
  {
    slug: "osaka",
    title: "大阪",
    location: "Osaka, Japan",
    date: "2026.01",
    description: "霓虹、河岸、深夜街角和日常生活交叠的城市。",
    coverImage: gradient("#111111", "#55514a", "#d7d2c8"),
    images: [
      gradient("#202020", "#75716a", "#f1eee8"),
      gradient("#0f0f0f", "#3f3d3a", "#9d9a93"),
      gradient("#343230", "#89857e", "#e9e5dd")
    ],
    body: [
      "大阪的节奏很直接，也很温柔。白天的商店街、人群、列车声，到了夜里会变成反光的路面、安静的桥和被灯牌照亮的脸。",
      "这里也是多美现在生活的地方。摄影不只是远方的记录，也包括下班路上、休息日、窗外天气变化里那些不被打扰的片刻。"
    ],
    tips: ["傍晚去中之岛散步，光线很适合拍建筑和河面。", "夜拍可以带轻便三脚架，低速快门会让城市更安静。"]
  },
  {
    slug: "kyoto",
    title: "京都",
    location: "Kyoto, Japan",
    date: "2025.11",
    description: "寺院、石径、庭园和季节感极强的古都。",
    coverImage: gradient("#161616", "#615f58", "#d9d4ca"),
    images: [
      gradient("#1d1c1b", "#777166", "#eee9df"),
      gradient("#2d2c29", "#a49c8f", "#f4f1ea"),
      gradient("#0f0f0f", "#4a4844", "#c6c1b8")
    ],
    body: [
      "京都适合慢慢走。很多画面不需要寻找，它们藏在转角、门帘、低矮屋檐和树影的边缘。",
      "相比把每个景点都走完，更喜欢在一个区域停留久一点，等待人群散开，等待风把画面整理好。"
    ],
    tips: ["清晨的寺院更安静，画面也更干净。", "避开正午强光，阴天反而适合拍细节。"]
  },
  {
    slug: "maizuru",
    title: "舞鹤",
    location: "Maizuru, Japan",
    date: "2025.08",
    description: "港口、船只、海风和带着工业感的安静海岸。",
    coverImage: gradient("#101112", "#4c5558", "#cfd6d6"),
    images: [
      gradient("#131516", "#657174", "#e5e9e8"),
      gradient("#222526", "#7e8787", "#f2f3f0"),
      gradient("#0e0f10", "#3e494d", "#b9c4c5")
    ],
    body: [
      "舞鹤的画面有一种克制的力量。港口的线条、舰船的轮廓、灰白色天空和海面，让照片天然接近黑白。",
      "这里很适合拍 Ships 主题，也适合记录日本海一侧更辽阔、更冷静的空气。"
    ],
    tips: ["港口区域注意拍摄规定和安全距离。", "长焦镜头适合压缩船体和海岸线的层次。"]
  },
  {
    slug: "tottori",
    title: "鸟取",
    location: "Tottori, Japan",
    date: "2025.05",
    description: "沙丘、海岸、风和大面积留白构成的地方。",
    coverImage: gradient("#151413", "#8d877a", "#eee8dc"),
    images: [
      gradient("#24211d", "#aaa18e", "#f7f1e6"),
      gradient("#121212", "#6f6a60", "#d8d1c3"),
      gradient("#2d2a26", "#b8ad99", "#f5efe4")
    ],
    body: [
      "鸟取的沙丘非常适合极简构图。人物、脚印、风纹和地平线都可以成为画面中唯一的主角。",
      "在这里拍照会让人重新意识到空白的重要性：不是没有内容，而是给内容留下呼吸。"
    ],
    tips: ["日落前一小时的沙丘层次最好。", "风大时保护镜头，尽量少换镜。"]
  },
  {
    slug: "guilin",
    title: "桂林",
    location: "Guilin, China",
    date: "2024.10",
    description: "故乡的山水、河流和潮湿空气里的记忆。",
    coverImage: gradient("#111412", "#5b6259", "#dce0d7"),
    images: [
      gradient("#171b18", "#6f7a6d", "#eef1e9"),
      gradient("#0f1110", "#51594f", "#bfc8bb"),
      gradient("#2c312c", "#8c9686", "#f2f5ed")
    ],
    body: [
      "桂林是多美的出发地。山水很有名，但真正留在记忆里的，可能是熟悉的路、家乡的口音、潮湿的空气和慢慢暗下来的江边。",
      "离开以后再回去拍照，镜头会变得更诚实。它不只是在拍风景，也在拍自己和故乡之间的距离。"
    ],
    tips: ["阴雨天的桂林更有层次，适合拍山水雾气。", "清晨江边人少，适合慢速拍摄。"]
  }
];

export const getTravelBySlug = (slug: string) =>
  travels.find((travel) => travel.slug === slug);
