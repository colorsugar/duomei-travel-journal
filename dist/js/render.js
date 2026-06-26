(function () {
  const $ = (selector) => document.querySelector(selector);
  const esc = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
  const lines = (value = "") => esc(value).replace(/\n/g, "<br>");

  function style(styles = {}) {
    const map = {
      size: "font-size",
      color: "color",
      weight: "font-weight",
      align: "text-align",
      lineHeight: "line-height",
      font: "font-family"
    };
    return Object.entries(styles)
      .filter(([, value]) => value)
      .map(([key, value]) => `${map[key] || key}:${key === "size" ? `${value}px` : value}`)
      .join(";");
  }

  function editable(path, value, styles = {}, extra = "") {
    return `<span class="editable" data-bind="${esc(path)}" ${extra} style="${style(styles)}">${lines(value)}</span>`;
  }

  function imageBlock({ image = "", thumb = "", background = "", className = "", alt = "", theme = false, attrs = "" }) {
    const src = image || thumb || "";
    return `<div class="photo ${className}" ${attrs} style="background:${background}">
      ${src ? `<img src="${src}" alt="${esc(alt)}" ${theme ? "data-theme-source" : ""} onload="ArchiveRender.imageLoaded(this)">` : ""}
    </div>`;
  }

  function applySiteText(state) {
    document.title = `${state.data.site.title || "多美"} | Travel Journal`;
    $(".brand").textContent = state.data.site.title || "多美";
    const title = $('[data-bind="site.title"]');
    const subtitle = $('[data-bind="site.subtitle"]');
    const poem = $('[data-bind="site.poem"]');
    if (title) {
      title.innerHTML = lines(state.data.site.title);
      title.setAttribute("style", style(state.data.site.styles?.title));
    }
    if (subtitle) {
      subtitle.innerHTML = lines(state.data.site.subtitle);
      subtitle.setAttribute("style", style(state.data.site.styles?.subtitle));
    }
    if (poem) {
      poem.innerHTML = lines(state.data.site.poem);
      poem.setAttribute("style", style(state.data.site.styles?.poem));
    }
  }

  function renderApp(state) {
    state.data = window.ArchiveStore.normalize(state.data);
    applySiteText(state);
    renderJourney(state);
    if (state.currentSlug) renderDetail(state, state.currentSlug, false);
    renderTags(state);
    renderStats(state);
    setEditable(state.editMode);
    requestAnimationFrame(() => window.ArchiveFX?.observe());
  }

  function renderJourney(state, list = state.data.journeys) {
    const grid = $("#journeyGrid");
    if (!grid) return;
    grid.innerHTML = list.map((city, index) => `
      <article class="journey-card card reveal" data-open-city="${esc(city.slug)}">
        <div class="card-tools edit-only">
          <button class="icon-btn" data-upload-card="${esc(city.id)}">换图</button>
          <button class="icon-btn" data-action="edit-city" data-id="${esc(city.id)}">编辑</button>
          <button class="icon-btn" data-action="delete-city" data-id="${esc(city.id)}">删除</button>
          <button class="icon-btn" data-action="move-city-up" data-id="${esc(city.id)}">↑</button>
          <button class="icon-btn" data-action="move-city-down" data-id="${esc(city.id)}">↓</button>
        </div>
        ${imageBlock({
          image: city.cardImage || city.coverImage,
          thumb: city.cardThumb || city.coverThumb,
          background: window.ArchiveData.gradients[index % window.ArchiveData.gradients.length],
          alt: city.title
        }).replace("</div>", `<span class="card-title-float">${esc(city.title)}</span></div>`)}
        <div class="card-meta">${esc(city.published)}<br>${esc(city.place)}</div>
        <div class="card-title">${esc(city.title)}</div>
      </article>
    `).join("") + `<button class="add-card reveal edit-only" data-action="add-city">＋<br><span>新增城市</span></button>`;
  }

  function renderDetail(state, slug, countView = true) {
    const index = state.data.journeys.findIndex((city) => city.slug === slug || city.id === slug);
    const city = state.data.journeys[index] || state.data.journeys[0];
    if (!city) return;

    state.currentSlug = city.slug;
    if (countView) city.views = Number(city.views || 0) + 1;
    window.ArchiveImage.applyTheme(city.theme);

    const prev = state.data.journeys[(index - 1 + state.data.journeys.length) % state.data.journeys.length];
    const next = state.data.journeys[(index + 1) % state.data.journeys.length];
    $("#detailView").innerHTML = `
      <section class="detail-hero">
        ${imageBlock({
          image: city.coverImage,
          thumb: city.coverThumb,
          background: window.ArchiveData.gradients[index % window.ArchiveData.gradients.length],
          className: "detail-cover",
          alt: city.title,
          theme: true
        })}
        <p class="hero-caption">${editable("city.coverCaption", city.coverCaption || "封面说明可以在这里编辑。", city.styles?.coverCaption, `data-city="${esc(city.id)}"`)}</p>
        <div class="detail-copy">
          <button class="back" data-action="home">Back to Journey</button>
          <h1 class="detail-title">${editable("city.title", city.title, city.styles?.title, `data-city="${esc(city.id)}"`)}</h1>
          <p class="detail-line">${editable("city.excerpt", city.excerpt, city.styles?.excerpt, `data-city="${esc(city.id)}"`)}</p>
          <div class="detail-meta">
            <span>发布 ${editable("city.published", city.published, city.styles?.published, `data-city="${esc(city.id)}"`)}</span>
            <span>更新 ${esc(city.updated || "")}</span>
            <span>${Number(city.views || 0)} views</span>
            <span>${editable("city.category", city.category, city.styles?.category, `data-city="${esc(city.id)}"`)}</span>
          </div>
          <div class="detail-meta">${city.tags.map((tag) => `<button class="tag-pill" data-filter-tag="${esc(tag)}">#${esc(tag)}</button>`).join("")}</div>
          <div class="hero-tools edit-only">
            <button class="pill" data-upload-cover="${esc(city.id)}">上传封面</button>
          </div>
        </div>
      </section>
      <section class="reading">
        <h2 class="pull-title reveal">${editable("city.excerpt", city.excerpt, city.styles?.excerpt, `data-city="${esc(city.id)}"`)}</h2>
        <div class="prose reveal">${editable("city.bodyTop", city.bodyTop, city.styles?.bodyTop, `data-city="${esc(city.id)}"`)}</div>
      </section>
      <section class="gallery-wrap">
        <div class="gallery">
          ${city.gallery.map((photo, photoIndex) => galleryItem(city, photo, photoIndex)).join("")}
          <button class="add-photo reveal edit-only" data-add-gallery="${esc(city.id)}">＋ 添加图片</button>
        </div>
      </section>
      <nav class="filmstrip ${city.gallery.some((photo) => photo.src || photo.image || photo.thumb) ? "has-items" : ""}">
        ${city.gallery.map((photo) => (photo.src || photo.image || photo.thumb) ? `<button class="film-thumb" data-lightbox-photo="${esc(photo.id)}"><img src="${photo.thumb || photo.src || photo.image}" alt="${esc(photo.alt || photo.title || photo.caption || "")}"></button>` : "").join("")}
      </nav>
      <section class="reading">
        <div class="prose reveal">${editable("city.bodyBottom", city.bodyBottom, city.styles?.bodyBottom, `data-city="${esc(city.id)}"`)}</div>
      </section>
      <div class="map-note reveal">${editable("city.mapText", city.mapText, city.styles?.mapText, `data-city="${esc(city.id)}"`)}</div>
      <nav class="pager">
        <button data-open-city="${esc(prev.slug)}"><span class="pager-label">Previous</span><span class="pager-title">${esc(prev.title)}</span></button>
        <button class="next" data-open-city="${esc(next.slug)}"><span class="pager-label">Next</span><span class="pager-title">${esc(next.title)}</span></button>
      </nav>
    `;

    if (countView) window.ArchiveStore.save(state.data, true);
    setEditable(state.editMode);
    requestAnimationFrame(() => window.ArchiveFX?.observe());
  }

  function photoMeta(city, photo) {
    const attr = `data-city="${esc(city.id)}" data-photo="${esc(photo.id)}"`;
    return `
      <p class="photo-meta">
        ${editable("photo.place", photo.place || "地点", photo.styles?.meta, attr)}
        <span> · </span>
        ${editable("photo.takenAt", photo.takenAt || "时间", photo.styles?.meta, attr)}
        <span> · </span>
        ${editable("photo.camera", photo.camera || "器材", photo.styles?.meta, attr)}
      </p>
    `;
  }

  function galleryItem(city, photo, index) {
    const attr = `data-city="${esc(city.id)}" data-photo="${esc(photo.id)}"`;
    return `<div class="gallery-item reveal">
      <div class="image-tools edit-only">
        <button class="icon-btn" data-upload-gallery="${esc(photo.id)}" data-city="${esc(city.id)}">上传</button>
        <button class="icon-btn" data-action="delete-photo" data-city="${esc(city.id)}" data-photo="${esc(photo.id)}">删除</button>
        <button class="icon-btn" data-action="move-photo-left" data-city="${esc(city.id)}" data-photo="${esc(photo.id)}">←</button>
        <button class="icon-btn" data-action="move-photo-right" data-city="${esc(city.id)}" data-photo="${esc(photo.id)}">→</button>
      </div>
      ${imageBlock({
        image: photo.src || photo.image,
        thumb: photo.thumb,
        background: window.ArchiveData.gradients[index % window.ArchiveData.gradients.length],
        alt: photo.alt || photo.title || photo.caption || `${city.title} ${index + 1}`,
        attrs: attr
      })}
      <div class="photo-copy">
        <h3 class="photo-title">${editable("photo.title", photo.title || "照片标题", photo.styles?.title, attr)}</h3>
        <p class="gallery-caption">${editable("photo.caption", photo.caption || "照片说明可以在这里编辑。", photo.styles?.caption, attr)}</p>
        ${photoMeta(city, photo)}
        <p class="photo-notes">${editable("photo.notes", photo.notes || "备注", photo.styles?.notes, attr)}</p>
      </div>
    </div>`;
  }

  function renderTags(state) {
    const counts = {};
    state.data.journeys.forEach((city) => (city.tags || []).forEach((tag) => { counts[tag] = (counts[tag] || 0) + 1; }));
    const tags = Object.entries(counts);
    const cloud = $("#tagCloud");
    if (!cloud) return;
    cloud.innerHTML = tags.map(([tag, count]) => {
      const size = Math.min(96, 44 + count * 12);
      return `<button class="tag-bubble" data-filter-tag="${esc(tag)}" data-size="${size}" style="font-size:${Math.min(34, 14 + count * 5)}px">#${esc(tag)}</button>`;
    }).join("");
  }

  function renderStats(state) {
    const cities = state.data.journeys.length;
    const photos = state.data.journeys.reduce((sum, city) => sum + city.gallery.filter((photo) => photo.src || photo.image || photo.thumb).length, 0);
    const tags = new Set(state.data.journeys.flatMap((city) => city.tags || [])).size;
    const views = state.data.journeys.reduce((sum, city) => sum + Number(city.views || 0), 0);
    const top = [...state.data.journeys].sort((a, b) => Number(b.views || 0) - Number(a.views || 0))[0];
    const stats = $("#statsGrid");
    if (!stats) return;
    stats.innerHTML = [
      ["城市", cities],
      ["照片", photos],
      ["文章", cities],
      ["Tag", tags],
      ["总浏览", views],
      ["最常翻阅", top?.title || "-"]
    ].map(([label, value]) => `<div class="stat-card reveal"><strong>${esc(value)}</strong><span>${esc(label)}</span></div>`).join("");
  }

  function setEditable(enabled) {
    document.body.classList.toggle("edit-on", enabled);
    document.querySelectorAll(".editable").forEach((node) => {
      node.contentEditable = enabled ? "true" : "false";
      node.spellcheck = false;
    });
  }

  async function imageLoaded(img) {
    img.classList.add("loaded");
    if (!img.hasAttribute("data-theme-source") || !window.ArchiveApp?.state.currentSlug) return;
    const city = window.ArchiveApp.state.data.journeys.find((item) => item.slug === window.ArchiveApp.state.currentSlug);
    if (!city) return;
    const theme = await window.ArchiveImage.extractTheme(img);
    if (theme) {
      city.theme = theme;
      window.ArchiveImage.applyTheme(theme);
    }
  }

  window.ArchiveRender = { renderApp, renderJourney, renderDetail, renderTags, renderStats, setEditable, imageLoaded, editable };
})();
