(function () {
  const gradients = [
    "linear-gradient(135deg, #dfe9ea 0%, #f7f3eb 48%, #d8ddd3 100%)",
    "linear-gradient(135deg, #e7ece3 0%, #fbf8f1 50%, #dce7e6 100%)",
    "linear-gradient(135deg, #efe6d7 0%, #fbf8ef 48%, #dfe8e3 100%)",
    "linear-gradient(135deg, #dce7e8 0%, #f8f4eb 54%, #d7ded5 100%)"
  ];

  function id(prefix = "id") {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function createCity(slug, title, published, place, excerpt, tags = []) {
    return {
      id: id(slug),
      slug,
      title,
      published,
      updated: new Date().toISOString().slice(0, 10),
      views: 0,
      category: "Travel",
      place,
      excerpt,
      tags,
      bodyTop: `${title} 是旅行档案馆里的一页。\n这里可以写下那天的天气、走过的路、看到的风景，以及照片背后的心情。`,
      bodyBottom: "照片会慢慢替换成真实记忆。等以后再翻回来时，它会像一本安静的写真集。",
      mapText: `这里以后可以加入 ${title} 的地图、路线或拍摄地点备注。`,
      coverImage: "",
      coverThumb: "",
      cardImage: "",
      cardThumb: "",
      theme: null,
      styles: {},
      gallery: Array.from({ length: 4 }, (_, index) => ({
        id: id(`${slug}-photo-${index}`),
        src: "",
        thumb: "",
        caption: index === 0 ? "照片说明可以在这里编辑。" : "",
        camera: "",
        styles: {}
      }))
    };
  }

  window.ArchiveData = {
    gradients,
    id,
    createCity,
    initial: {
      site: {
        title: "多美",
        subtitle: "Travel Journal",
        poem: "记录一路看到的风景，\n也记录一路走过的生活。",
        styles: {}
      },
      settings: {
        analytics: { cloudflare: "", firebase: "", umami: "" }
      },
      journeys: [
        createCity("osaka", "大阪", "2026.01", "Osaka, Japan", "在熟悉的街道里，看见一天慢慢变暗。", ["大阪", "城市", "夜景", "iPhone"]),
        createCity("kyoto", "京都", "2025.11", "Kyoto, Japan", "石径、树影和风，把时间放得很轻。", ["京都", "神社", "摄影"]),
        createCity("maizuru", "舞鹤", "2025.08", "Maizuru, Japan", "海风、港口和船，组成安静的夏天。", ["海边", "船", "Nikon"]),
        createCity("tottori", "鸟取", "2025.05", "Tottori, Japan", "沙丘把世界变简单，只留下风和脚印。", ["鸟取", "沙丘", "风景"]),
        createCity("guilin", "桂林", "2024.10", "Guilin, China", "故乡的山水，总带着潮湿又温柔的颜色。", ["桂林", "山水", "故乡"])
      ]
    }
  };
})();
