(function () {
  const $ = (selector, root = document) => root.querySelector(selector);
  const today = () => new Date().toISOString().slice(0, 10);
  const RECENT_TAGS_KEY = "duomei_recent_tags";
  const undoStack = [];
  let uploadBatch = null;
  let editSessionSnapshot = "";
  let editSessionWasDirty = false;

  function remember(state) {
    undoStack.push(JSON.stringify(state.data));
    if (undoStack.length > 20) undoStack.shift();
  }

  function markDirty(state) {
    state.hasUnpublishedChanges = true;
    window.ArchiveManager?.scheduleRecovery(state.data, "内容修改");
  }

  function undo(state) {
    const snapshot = undoStack.pop();
    if (!snapshot) {
      window.ArchiveUI?.toast("没有可以撤销的操作");
      return;
    }
    state.data = window.ArchiveStore.normalize(JSON.parse(snapshot));
    window.ArchiveStore.save(state.data, true);
    markDirty(state);
    window.ArchiveRender.renderApp(state);
    window.ArchiveUI?.toast("已撤销上一步");
  }

  function slugify(value) {
    const slug = (value || "")
      .trim()
      .toLowerCase()
      .replace(/[\s_]+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    return slug || `journey-${Date.now().toString(36)}`;
  }

  function cityById(data, id) {
    return data.journeys.find((city) => city.id === id || city.slug === id);
  }

  function touch(city) {
    city.updated = today();
  }

  function filesFrom(input) {
    return input?.files ? Array.from(input.files) : [];
  }

  function openDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "open");
  }

  function closeDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  function formValue(id) {
    return $(`#${id}`)?.value.trim() || "";
  }

  function tagValues() {
    return formValue("cityTags").split(",").map((tag) => tag.trim()).filter(Boolean);
  }

  function simpleTags(value = "") {
    return [...new Set(String(value).split(/[,，\s]+/).map((tag) => tag.replace(/^#/, "").trim()).filter(Boolean))];
  }

  function renderTagChips(tags) {
    const unique = [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
    $("#cityTags").value = unique.join(",");
    $("#cityTagChips").innerHTML = unique.map((tag) => {
      const safe = tag.replace(/[<>&"]/g, "");
      return `<span class="tag-chip">#${safe}<button type="button" data-remove-tag="${encodeURIComponent(tag)}" aria-label="删除 ${safe}">×</button></span>`;
    }).join("");
  }

  function recentTags() {
    try { return JSON.parse(localStorage.getItem(RECENT_TAGS_KEY) || "[]"); } catch { return []; }
  }

  function rememberTag(tag) {
    const tags = [tag, ...recentTags().filter((item) => item !== tag)].slice(0, 8);
    localStorage.setItem(RECENT_TAGS_KEY, JSON.stringify(tags));
  }

  function renderTagSuggestions(query = "") {
    const root = $("#cityTagSuggestions");
    if (!root || !window.ArchiveApp?.state?.data) return;
    const counts = {};
    window.ArchiveApp.state.data.journeys.forEach((city) => (city.tags || []).forEach((tag) => { counts[tag] = (counts[tag] || 0) + 1; }));
    const current = new Set(tagValues());
    const candidates = [...new Set([...recentTags(), ...Object.keys(counts).sort((a, b) => counts[b] - counts[a])])]
      .filter((tag) => !current.has(tag) && (!query || tag.toLowerCase().includes(query.toLowerCase())))
      .slice(0, 8);
    root.innerHTML = candidates.length
      ? `<span>${query ? "自动补全" : "最近 / 热门"}</span>${candidates.map((tag) => `<button type="button" data-suggest-tag="${encodeURIComponent(tag)}">#${tag.replace(/[<>&"]/g, "")}${counts[tag] ? ` · ${counts[tag]}` : ""}</button>`).join("")}`
      : "";
  }

  function addPendingTag() {
    const input = $("#cityTagInput");
    const value = input.value.trim().replace(/^#/, "");
    if (!value) return;
    renderTagChips([...tagValues(), value]);
    rememberTag(value);
    renderTagSuggestions();
    input.value = "";
  }

  async function ensureFileReady(file) {
    if (!file) throw new Error("没有读取到图片文件");
    const progress = $("#uploadProgress");
    if (progress) progress.hidden = false;
    $("#uploadProgressTitle").textContent = "正在从 iCloud / 相册读取照片...";
    const startedAt = Date.now();
    let lastError = null;
    while (Date.now() - startedAt < 15000) {
      try {
        if (file.size > 0) {
          await file.slice(0, Math.min(file.size, 256 * 1024)).arrayBuffer();
          return file;
        }
      } catch (error) {
        lastError = error;
      }
      $("#uploadProgressTitle").textContent = "正在从 iCloud 读取照片...";
      await new Promise((resolve) => setTimeout(resolve, 650));
    }
    throw new Error(lastError ? "照片读取失败，请确认 iCloud 下载完成后重试" : "照片还在从 iCloud 下载，请稍后再点完成");
  }

  async function compressDirect(file, onStage = () => {}) {
    await ensureFileReady(file);
    onStage("正在读取图片");
    const bitmap = await createImageBitmap(file);
    const maxSide = 1800;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    onStage("正在压缩并转换 WebP");
    const quality = Number(window.ArchiveApp?.state?.data?.settings?.imageQuality || .82);
    const image = canvas.toDataURL("image/webp", Math.min(.95, Math.max(.55, quality)));
    const outputBytes = Math.round((image.length - image.indexOf(",") - 1) * .75);
    window.ArchiveImage.lastCompression = {
      name: file.name || "image",
      originalBytes: file.size || 0,
      outputBytes,
      width,
      height,
      aspectMode: "original",
      uploadedAt: new Date().toISOString()
    };
    const thumb = await window.ArchiveImage.thumb(image);
    const theme = await window.ArchiveImage.extractTheme(image);
    return { image, thumb, theme, meta: { ...window.ArchiveImage.lastCompression } };
  }

  async function cropAndTheme(file, onStage = () => {}, options = {}) {
    await ensureFileReady(file);
    if (options.crop === false) return compressDirect(file, onStage);
    onStage("正在读取图片");
    const image = await window.ArchiveImage.cropFile(file);
    if (!image) return null;
    onStage("正在压缩并转换 WebP");
    const thumb = await window.ArchiveImage.thumb(image);
    onStage("正在分析照片颜色");
    const theme = await window.ArchiveImage.extractTheme(image);
    return { image, thumb, theme, meta: { ...(window.ArchiveImage.lastCompression || {}) } };
  }

  function emptyPhotoSlot(city) {
    return (city.gallery || []).find((photo) => !(photo.src || photo.image || photo.thumb));
  }

  function isEditing(state) {
    return Boolean(state.editMode && document.body.classList.contains("admin-authenticated"));
  }

  function focusUploadedPhoto(photoId) {
    if (!photoId) return;
    requestAnimationFrame(() => {
      const selector = window.CSS?.escape ? CSS.escape(photoId) : String(photoId).replace(/"/g, '\\"');
      const editable = document.querySelector(`[data-photo="${selector}"]`);
      const item = editable?.closest(".gallery-item");
      if (!item) return;
      item.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      item.classList.add("upload-focus");
      window.setTimeout(() => item.classList.remove("upload-focus"), 1600);
    });
  }

  function createPhoto() {
    return {
      id: window.ArchiveData.id("photo"),
      src: "",
      thumb: "",
      title: "",
      caption: "新的风景",
      alt: "",
      place: "",
      takenAt: "",
      camera: "",
      notes: "",
      styles: {}
    };
  }

  function formatBytes(value) {
    if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
    return `${(value / 1024 / 1024).toFixed(1)} MB`;
  }

  function beginUploadProgress(files) {
    const panel = $("#uploadProgress");
    const items = $("#uploadProgressItems");
    panel.hidden = false;
    panel.classList.remove("is-complete", "is-failed");
    uploadBatch = { startedAt: performance.now(), total: files.length, originalBytes: files.reduce((sum, file) => sum + file.size, 0) };
    $("#uploadProgressTitle").textContent = "正在逐张处理";
    $("#uploadProgressCount").textContent = `0/${files.length}`;
    $("#uploadProgressBar").style.width = "0%";
    items.innerHTML = files.map((file, index) => `<div data-upload-index="${index}"><strong>${file.name}</strong><span>${formatBytes(file.size)} · 等待</span></div>`).join("");
  }

  function updateUploadProgress(index, total, file, status, outputBytes = 0) {
    $("#uploadProgressCount").textContent = `${index + 1}/${total}`;
    $("#uploadProgressBar").style.width = `${Math.round((index + 1) / total * 100)}%`;
    const item = $(`[data-upload-index="${index}"]`);
    if (item) {
      item.dataset.status = status;
      item.querySelector("span").textContent = outputBytes
        ? `${formatBytes(file.size)} → ${formatBytes(outputBytes)} · ${status}`
        : `${formatBytes(file.size)} · ${status}`;
    }
    if (outputBytes && uploadBatch) {
      const elapsed = Math.max(.1, (performance.now() - uploadBatch.startedAt) / 1000);
      const completed = index + 1;
      const speed = uploadBatch.originalBytes / elapsed;
      const remaining = Math.max(0, Math.round((elapsed / completed) * (total - completed)));
      $("#uploadProgressTitle").textContent = `处理中 · ${formatBytes(speed)}/s${remaining ? ` · 约 ${remaining}s` : ""}`;
    }
  }

  function finishUploadProgress() {
    $("#uploadProgressTitle").textContent = "图片处理完成";
    $("#uploadProgress").classList.add("is-complete");
    uploadBatch = null;
    window.setTimeout(() => { $("#uploadProgress").hidden = true; }, 2600);
  }

  async function addGalleryFiles(city, files) {
    city.gallery = city.gallery || [];
    const uploadedIds = [];
    beginUploadProgress(files);
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      if (file.size > 20 * 1024 * 1024) {
        window.ArchiveUI?.toast(`${file.name} 超过 20MB，建议先压缩`);
      }
      updateUploadProgress(index, files.length, file, "读取与裁剪");
      try {
        const result = await cropAndTheme(file, (status) => updateUploadProgress(index, files.length, file, status), { crop: files.length === 1 ? true : false });
        if (!result) {
          updateUploadProgress(index, files.length, file, "已取消");
          continue;
        }
        const photo = emptyPhotoSlot(city) || createPhoto();
        photo.src = result.image;
        photo.thumb = result.thumb;
        Object.assign(photo, result.meta || {});
        uploadedIds.push(photo.id);
        if (!city.gallery.includes(photo)) city.gallery.push(photo);
        updateUploadProgress(index, files.length, file, "已完成", window.ArchiveImage.lastCompression?.outputBytes || 0);
      } catch (error) {
        updateUploadProgress(index, files.length, file, "失败，可重新选择");
        window.ArchiveUI?.toast(`${file.name}：${error.message || "处理失败"}`);
      }
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    touch(city);
    return uploadedIds;
  }

  function setPath(root, path, value) {
    const keys = path.split(".");
    const last = keys.pop();
    const target = keys.reduce((acc, key) => {
      if (!acc[key] || typeof acc[key] !== "object") acc[key] = {};
      return acc[key];
    }, root);
    target[last] = value;
  }

  function fillCityDialog(state, city) {
    state.editingCityId = city?.id || "";
    $("#cityDialogTitle").textContent = city ? "编辑城市" : "新增城市";
    $("#cityTitle").value = city?.title || "";
    $("#citySlug").value = city?.slug || "";
    $("#cityPlace").value = city?.place || "";
    $("#cityPublished").value = city?.published || today();
    $("#cityCategory").value = city?.category || "Travel";
    $("#cityGalleryLayout").value = city?.galleryLayout || state.data.settings.galleryLayout || "auto";
    renderTagChips(city?.tags || []);
    $("#cityTagInput").value = "";
    renderTagSuggestions();
    $("#cityExcerpt").value = city?.excerpt || "";
    $("#cityBody").value = city?.bodyTop || "";
    $("#cityCover").value = "";
    $("#cityGallery").value = "";
  }

  function openCityEditor(state, city) {
    fillCityDialog(state, city);
    openDialog($("#cityDialog"));
  }

  async function saveCityDialog(state) {
    const title = formValue("cityTitle") || "未命名的旅程";
    const slug = slugify(formValue("citySlug") || title);
    const existing = state.data.journeys.find((city) => city.id === state.editingCityId);
    const duplicate = state.data.journeys.find((city) => city.slug === slug && city.id !== state.editingCityId);
    if (duplicate) {
      window.ArchiveUI?.toast("这个英文 slug 已经存在");
      return;
    }

    const city = existing || window.ArchiveData.createCity(slug, title, formValue("cityPublished"), formValue("cityPlace"), formValue("cityExcerpt"));
    city.title = title;
    city.slug = slug;
    city.place = formValue("cityPlace");
    city.published = formValue("cityPublished") || today();
    city.updated = today();
    city.category = formValue("cityCategory");
    city.galleryLayout = $("#cityGalleryLayout")?.value || "auto";
    city.excerpt = formValue("cityExcerpt");
    city.bodyTop = formValue("cityBody");
    addPendingTag();
    city.tags = tagValues();

    const cover = filesFrom($("#cityCover"))[0];
    if (cover) {
      beginUploadProgress([cover]);
      const result = await cropAndTheme(cover, (status) => updateUploadProgress(0, 1, cover, status));
      if (result) {
        city.coverImage = result.image;
        city.coverThumb = result.thumb;
        city.coverMeta = result.meta || {};
        if (!city.cardImage) {
          city.cardImage = result.image;
          city.cardThumb = result.thumb;
          city.cardMeta = result.meta || {};
        }
        city.theme = result.theme;
        updateUploadProgress(0, 1, cover, "已更新封面", window.ArchiveImage.lastCompression?.outputBytes || 0);
      }
      finishUploadProgress();
    }

    const gallery = filesFrom($("#cityGallery"));
    if (gallery.length) {
      await addGalleryFiles(city, gallery);
      finishUploadProgress();
    }

    if (!existing) state.data.journeys.push(city);
    state.currentSlug = city.slug;
    state.data = window.ArchiveStore.normalize(state.data);
    markDirty(state);
    window.ArchiveStore.save(state.data);
    closeDialog($("#cityDialog"));
    window.ArchiveRender.renderApp(state);
    window.ArchiveApp.openCity(city.slug);
  }

  function contentLabel(type) {
    return type === "photography" ? "Photography" : type === "essay" ? "Essay" : "Thought";
  }

  function openContentEditor(state, type = "thought", item = null) {
    const dialog = $("#contentDialog");
    if (!dialog) return;
    $("#contentDialogTitle").textContent = item ? `编辑 ${contentLabel(type)}` : `新增 ${contentLabel(type)}`;
    $("#contentId").value = item?.id || "";
    $("#contentType").value = type;
    $("#contentTitle").value = item?.title || "";
    $("#contentPublished").value = item?.published || today();
    $("#contentPlace").value = item?.place || "";
    $("#contentCategory").value = item?.category || (type === "essay" ? "Essay" : type === "photography" ? "Photography" : "Thought");
    $("#contentTagsInput").value = (item?.tags || []).join(" ");
    $("#contentCaption").value = item?.caption || "";
    $("#contentBody").value = item?.body || "";
    $("#contentImage").value = "";
    dialog.dataset.type = type;
    dialog.querySelector(".content-place-field").hidden = type === "essay";
    dialog.querySelector(".content-category-field").hidden = type !== "essay";
    dialog.querySelector(".content-tags-field").hidden = type === "photography";
    dialog.querySelector(".content-caption-field").hidden = type === "thought" || type === "essay";
    dialog.querySelector(".content-body-field").hidden = type === "photography";
    dialog.querySelector(".content-image-field").hidden = type === "thought";
    openDialog(dialog);
  }

  async function saveContentDialog(state) {
    const type = $("#contentType").value || "thought";
    const content = state.data.settings.content || { photography: [], thought: [], essay: [] };
    state.data.settings.content = content;
    content[type] = content[type] || [];
    const id = $("#contentId").value;
    const existing = content[type].find((item) => item.id === id);
    const item = existing || {
      id: window.ArchiveData.id(type),
      type,
      status: "public",
      styles: {}
    };
    item.title = formValue("contentTitle") || (type === "photography" ? "未命名照片" : type === "essay" ? "未命名文章" : "未命名随想");
    item.published = formValue("contentPublished") || today();
    item.updated = today();
    item.place = formValue("contentPlace");
    item.category = formValue("contentCategory") || contentLabel(type);
    item.tags = simpleTags($("#contentTagsInput")?.value || "");
    item.caption = formValue("contentCaption");
    item.body = formValue("contentBody");
    const file = filesFrom($("#contentImage"))[0];
    if (file) {
      beginUploadProgress([file]);
      const result = await cropAndTheme(file, (status) => updateUploadProgress(0, 1, file, status), { crop: true });
      if (result) {
        if (type === "photography") {
          item.image = result.image;
          item.thumb = result.thumb;
        } else {
          item.coverImage = result.image;
          item.coverThumb = result.thumb;
        }
        Object.assign(item, result.meta || {});
        updateUploadProgress(0, 1, file, "已完成", window.ArchiveImage.lastCompression?.outputBytes || 0);
      }
      finishUploadProgress();
    }
    if (!existing) content[type].push(item);
    state.data = window.ArchiveStore.normalize(state.data);
    markDirty(state);
    window.ArchiveStore.save(state.data);
    closeDialog($("#contentDialog"));
    window.ArchiveRender.renderApp(state);
    window.ArchiveApp.showContent(type);
  }

  function saveEditable(state, target) {
    const path = target.dataset.bind;
    if (!path) return;
    const value = target.innerHTML.trim();

    if (path.startsWith("site.")) {
      setPath(state.data, path, value);
    } else if (target.dataset.photo) {
      const city = cityById(state.data, target.dataset.city);
      const photo = city?.gallery.find((item) => item.id === target.dataset.photo);
      if (photo) {
        photo[path.replace("photo.", "")] = value;
        touch(city);
      }
    } else if (target.dataset.city) {
      const city = cityById(state.data, target.dataset.city);
      if (city) {
        setPath(city, path.replace("city.", ""), value);
        touch(city);
      }
    }

    window.ArchiveStore.save(state.data, true);
    markDirty(state);
  }

  function styleRootFor(state, editable) {
    const path = editable.dataset.bind;
    if (editable.dataset.homeSection) {
      const section = state.data.site.homeSections.find((item) => item.id === editable.dataset.homeSection);
      if (!section) return null;
      const key = path.split(".").pop();
      section.styles = section.styles || {};
      section.styles[key] = section.styles[key] || {};
      return section.styles[key];
    }
    if (path?.startsWith("site.")) {
      const key = path.split(".").pop();
      state.data.site.styles[key] = state.data.site.styles[key] || {};
      return state.data.site.styles[key];
    }

    const city = cityById(state.data, editable.dataset.city);
    if (!city) return null;

    if (editable.dataset.photo) {
      const photo = city.gallery.find((item) => item.id === editable.dataset.photo);
      if (!photo) return null;
      const key = path.replace("photo.", "") || "caption";
      photo.styles = photo.styles || {};
      photo.styles[key] = photo.styles[key] || {};
      return photo.styles[key];
    }

    const key = path.split(".").pop();
    city.styles = city.styles || {};
    city.styles[key] = city.styles[key] || {};
    return city.styles[key];
  }

  function applyStyleControl(state, control) {
    const editable = state.activeEditable;
    if (!editable) return;
    const styles = styleRootFor(state, editable);
    if (!styles) return;

    const key = control.dataset.style;
    const value = control.value;
    styles[key] = value;
    if (key === "size") editable.style.fontSize = `${value}px`;
    if (key === "color") editable.style.color = value;
    if (key === "weight") editable.style.fontWeight = value;
    if (key === "align") editable.style.textAlign = value;
    if (key === "lineHeight") editable.style.lineHeight = value;
    if (key === "font") editable.style.fontFamily = value;
    window.ArchiveStore.save(state.data, true);
    markDirty(state);
  }

  function syncToolbar(state, editable) {
    if (!isEditing(state)) return;
    state.activeEditable = editable;
    const toolbar = $("#textToolbar");
    if (!toolbar || !editable) return;
    toolbar.classList.add("show");
  }

  async function uploadToTarget(state, target) {
    const cityId = target.dataset.uploadCard || target.dataset.uploadCover || target.dataset.addGallery || target.dataset.city;
    const city = cityById(state.data, cityId);
    if (!city) return;

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = Boolean(target.dataset.addGallery);
    input.className = "sr-file";
    document.body.appendChild(input);
    input.addEventListener("change", async () => {
      try {
        const files = filesFrom(input);
        if (!files.length) return;
        remember(state);
        markDirty(state);
        let uploadedIds = [];
        beginUploadProgress(files);

        if (target.dataset.uploadCard) {
          const result = await cropAndTheme(files[0], (status) => updateUploadProgress(0, 1, files[0], status));
          if (result) {
            city.cardImage = result.image;
            city.cardThumb = result.thumb;
            city.cardMeta = result.meta || {};
            updateUploadProgress(0, 1, files[0], "已更新页面", window.ArchiveImage.lastCompression?.outputBytes || 0);
          }
        }

        if (target.dataset.uploadCover) {
          const result = await cropAndTheme(files[0], (status) => updateUploadProgress(0, 1, files[0], status));
          if (result) {
            city.coverImage = result.image;
            city.coverThumb = result.thumb;
            city.theme = result.theme;
            city.coverMeta = result.meta || {};
            updateUploadProgress(0, 1, files[0], "已更新封面", window.ArchiveImage.lastCompression?.outputBytes || 0);
          }
        }

        if (target.dataset.uploadGallery) {
          const photo = city.gallery.find((item) => item.id === target.dataset.uploadGallery);
          const result = await cropAndTheme(files[0], (status) => updateUploadProgress(0, 1, files[0], status));
          if (photo && result) {
            photo.src = result.image;
            photo.thumb = result.thumb;
            Object.assign(photo, result.meta || {});
            uploadedIds.push(photo.id);
            updateUploadProgress(0, 1, files[0], "已更新页面", window.ArchiveImage.lastCompression?.outputBytes || 0);
          }
        }

        if (target.dataset.addGallery) uploadedIds = await addGalleryFiles(city, files);

        touch(city);
        state.data = window.ArchiveStore.normalize(state.data);
        window.ArchiveStore.save(state.data);
        $("#uploadProgressTitle").textContent = "正在写入 IndexedDB";
        if (window.ArchiveManager) await window.ArchiveManager.backup(state.data, "图片上传完成").catch(() => {});
        $("#uploadProgressTitle").textContent = "正在更新页面";
        window.ArchiveRender.renderApp(state);
        focusUploadedPhoto(uploadedIds[0]);
        finishUploadProgress();
      } catch (error) {
        $("#uploadProgressTitle").textContent = "图片处理失败";
        $("#uploadProgress").classList.add("is-failed");
        const retry = document.createElement("button");
        retry.type = "button";
        retry.className = "pill upload-retry";
        retry.textContent = "重新选择此图片";
        retry.addEventListener("click", () => {
          retry.remove();
          uploadToTarget(state, target);
        }, { once: true });
        $("#uploadProgressItems").appendChild(retry);
        window.ArchiveUI?.toast(error.message || "图片处理失败，请重试");
      } finally {
        input.value = "";
        input.remove();
      }
    }, { once: true });
    input.click();
  }

  function deleteCity(state, id) {
    const city = cityById(state.data, id);
    if (!city) return;
    if (!confirm(`确定删除「${city.title}」吗？`)) return;
    remember(state);
    markDirty(state);
    state.data.journeys = state.data.journeys.filter((item) => item.id !== city.id);
    if (state.currentSlug === city.slug) state.currentSlug = "";
    window.ArchiveStore.save(state.data);
    window.ArchiveRender.renderApp(state);
    window.ArchiveApp.showHome();
  }

  function moveCity(state, id, direction) {
    const index = state.data.journeys.findIndex((city) => city.id === id);
    const next = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || next < 0 || next >= state.data.journeys.length) return;
    remember(state);
    markDirty(state);
    const [city] = state.data.journeys.splice(index, 1);
    state.data.journeys.splice(next, 0, city);
    window.ArchiveStore.save(state.data);
    window.ArchiveRender.renderApp(state);
  }

  function deletePhoto(state, cityId, photoId) {
    const city = cityById(state.data, cityId);
    if (!city) return;
    if (!confirm("确定删除这张图片吗？此操作会保留在恢复备份中。")) return;
    remember(state);
    markDirty(state);
    window.ArchiveManager?.backup(state.data, "删除图片前")?.catch(() => {});
    city.gallery = city.gallery.filter((photo) => photo.id !== photoId);
    touch(city);
    window.ArchiveStore.save(state.data);
    window.ArchiveRender.renderApp(state);
  }

  function deleteCover(state, cityId) {
    const city = cityById(state.data, cityId);
    if (!city || !city.coverImage) return;
    if (!confirm("确定删除封面并恢复为空白吗？")) return;
    remember(state);
    markDirty(state);
    window.ArchiveManager?.backup(state.data, "删除封面前")?.catch(() => {});
    city.coverImage = "";
    city.coverThumb = "";
    city.coverCaption = "";
    city.theme = null;
    touch(city);
    window.ArchiveStore.save(state.data);
    window.ArchiveRender.renderApp(state);
  }

  function mutateHomeSections(state, action, id) {
    const sections = state.data.site.homeSections || (state.data.site.homeSections = []);
    const index = sections.findIndex((section) => section.id === id);
    if (action === "delete" && index >= 0 && !confirm("确定删除这个首页内容区块吗？")) return;
    remember(state);
    markDirty(state);
    if (action === "add") {
      sections.push({
        id: window.ArchiveData.id("home"),
        eyebrow: "New Section",
        title: "新的首页标题",
        subtitle: "",
        body: "",
        buttonLabel: "",
        buttonUrl: "",
        layout: "editorial",
        visible: true,
        order: sections.length,
        styles: {}
      });
    }
    if (action === "delete" && index >= 0) sections.splice(index, 1);
    if (action === "toggle" && index >= 0) sections[index].visible = !sections[index].visible;
    if (action === "layout" && index >= 0) sections[index].layout = sections[index].layout === "centered" ? "editorial" : "centered";
    if ((action === "up" || action === "down") && index >= 0) {
      const next = action === "up" ? index - 1 : index + 1;
      if (next >= 0 && next < sections.length) [sections[index], sections[next]] = [sections[next], sections[index]];
    }
    sections.forEach((section, position) => { section.order = position; });
    window.ArchiveStore.save(state.data, true);
    window.ArchiveRender.renderApp(state);
  }

  function movePhoto(state, cityId, photoId, direction) {
    const city = cityById(state.data, cityId);
    if (!city) return;
    const index = city.gallery.findIndex((photo) => photo.id === photoId);
    const next = direction === "left" ? index - 1 : index + 1;
    if (index < 0 || next < 0 || next >= city.gallery.length) return;
    remember(state);
    markDirty(state);
    const [photo] = city.gallery.splice(index, 1);
    city.gallery.splice(next, 0, photo);
    touch(city);
    window.ArchiveStore.save(state.data);
    window.ArchiveRender.renderApp(state);
  }

  function toggleEditMode(state) {
    if (!document.body.classList.contains("admin-authenticated")) return;
    if (!state.editMode) {
      editSessionSnapshot = JSON.stringify(state.data);
      editSessionWasDirty = Boolean(state.hasUnpublishedChanges);
    }
    state.editMode = !state.editMode;
    $("#editToggle").setAttribute("aria-pressed", String(state.editMode));
    $("#editToggle").textContent = state.editMode ? "完成编辑" : "编辑模式";
    if ($("#adminDashboard")) $("#adminDashboard").textContent = "返回后台";
    if ($("#studioToggleEditor")) $("#studioToggleEditor").textContent = state.editMode ? "退出编辑" : "进入编辑";
    window.ArchiveRender.setEditable(state.editMode);
    document.body.classList.toggle("edit-on", state.editMode);
    window.ArchiveRender.renderApp(state);
    if (!state.editMode) {
      state.activeEditable = null;
      $("#textToolbar")?.classList.remove("show");
    }
  }

  async function uploadHeroBackground(file) {
    const state = window.ArchiveApp?.state;
    if (!state || !isEditing(state) || !file) return;
    beginUploadProgress([file]);
    try {
      const result = await cropAndTheme(file, (status) => updateUploadProgress(0, 1, file, status));
      if (!result) return;
      let asset = state.data.journeys.find((city) => city.status === "asset" && city.slug === "_home-assets");
      if (!asset) {
        asset = window.ArchiveData.createCity("_home-assets", "Home Assets", "", "", "", []);
        asset.id = "system-home-assets";
        asset.status = "asset";
        asset.gallery = [];
        state.data.journeys.push(asset);
      }
      asset.coverImage = result.image;
      asset.coverThumb = result.thumb;
      asset.coverMeta = result.meta || {};
      state.data.site.hero.backgroundAssetId = asset.id;
      state.data.site.hero.mode = "image";
      markDirty(state);
      window.ArchiveStore.save(state.data, true);
      await window.ArchiveManager?.backup(state.data, "修改首页背景")?.catch(() => {});
      window.ArchiveRender.renderApp(state);
      updateUploadProgress(0, 1, file, "首页背景已更新", result.meta?.outputBytes || 0);
      finishUploadProgress();
    } catch (error) {
      window.ArchiveManager?.failOperation(error.message);
      window.ArchiveUI?.toast(error.message || "首页背景处理失败");
    }
  }

  function bindGlobalActions(state) {
    $("#editToggle")?.addEventListener("click", () => toggleEditMode(state));
    $("#editActionBar")?.addEventListener("click", (event) => {
      const action = event.target.closest("[data-editor-action]")?.dataset.editorAction;
      if (!action) return;
      if (action === "save") {
        window.ArchiveStore.save(state.data, true);
        window.ArchiveCMS?.saveDraft(state.data);
        editSessionSnapshot = JSON.stringify(state.data);
        window.ArchiveUI?.toast("草稿已保存");
      }
      if (action === "cancel") {
        if (!editSessionSnapshot || !confirm("放弃本次进入编辑后的修改吗？")) return;
        state.data = window.ArchiveStore.normalize(JSON.parse(editSessionSnapshot));
        window.ArchiveStore.save(state.data, true);
        state.hasUnpublishedChanges = editSessionWasDirty;
        window.ArchiveRender.renderApp(state);
        toggleEditMode(state);
        window.ArchiveUI?.toast("本次修改已取消");
      }
      if (action === "back") {
        if (state.editMode) toggleEditMode(state);
        $("#adminDashboard")?.click();
      }
      if (action === "defaults") {
        if (!confirm("恢复当前文字的默认样式吗？内容不会被删除。")) return;
        const target = state.activeEditable;
        const binding = target?.dataset?.bind;
        if (binding && state.data.styles?.[binding]) {
          delete state.data.styles[binding];
          markDirty(state);
          window.ArchiveStore.save(state.data, true);
          window.ArchiveRender.renderApp(state);
          window.ArchiveUI?.toast("已恢复默认样式");
        } else {
          window.ArchiveUI?.toast("请先选择一个可编辑文字区域");
        }
      }
    });

    document.addEventListener("click", async (event) => {
      if (event.target.closest('[aria-disabled="true"]')) event.preventDefault();
      const upload = event.target.closest("[data-upload-card], [data-upload-cover], [data-upload-gallery], [data-add-gallery]");
      if (upload) {
        event.preventDefault();
        if (!isEditing(state)) return;
        await uploadToTarget(state, upload);
        return;
      }

      const action = event.target.closest("[data-action]");
      if (!action) return;
      const name = action.dataset.action;

      if (name === "home") window.ArchiveApp.showHome();
      if (name === "add-city" && isEditing(state)) openCityEditor(state);
      if (name === "edit-city" && isEditing(state)) openCityEditor(state, cityById(state.data, action.dataset.id));
      if (name === "save-city") {
        event.preventDefault();
        await saveCityDialog(state);
      }
      if (name === "add-content" && isEditing(state)) openContentEditor(state, action.dataset.type || "thought");
      if (name === "edit-content" && isEditing(state)) {
        const type = action.dataset.type || "thought";
        const item = state.data.settings.content?.[type]?.find((entry) => entry.id === action.dataset.id);
        openContentEditor(state, type, item);
      }
      if (name === "delete-content" && isEditing(state)) {
        const type = action.dataset.type || "thought";
        const list = state.data.settings.content?.[type] || [];
        const item = list.find((entry) => entry.id === action.dataset.id);
        if (item && confirm(`确定删除「${item.title}」吗？`)) {
          state.data.settings.content[type] = list.filter((entry) => entry.id !== item.id);
          markDirty(state);
          window.ArchiveStore.save(state.data);
          window.ArchiveRender.renderApp(state);
          window.ArchiveApp.showContent(type);
        }
      }
      if (name === "save-content") {
        event.preventDefault();
        await saveContentDialog(state);
      }
      if (name === "delete-city" && isEditing(state)) deleteCity(state, action.dataset.id);
      if (name === "move-city-up" && isEditing(state)) moveCity(state, action.dataset.id, "up");
      if (name === "move-city-down" && isEditing(state)) moveCity(state, action.dataset.id, "down");
      if (name === "delete-photo" && isEditing(state)) deletePhoto(state, action.dataset.city, action.dataset.photo);
      if (name === "delete-cover" && isEditing(state)) deleteCover(state, action.dataset.city);
      if (name === "add-home-section" && isEditing(state)) mutateHomeSections(state, "add");
      if (name === "delete-home" && isEditing(state)) mutateHomeSections(state, "delete", action.dataset.id);
      if (name === "toggle-home" && isEditing(state)) mutateHomeSections(state, "toggle", action.dataset.id);
      if (name === "layout-home" && isEditing(state)) mutateHomeSections(state, "layout", action.dataset.id);
      if (name === "move-home-up" && isEditing(state)) mutateHomeSections(state, "up", action.dataset.id);
      if (name === "move-home-down" && isEditing(state)) mutateHomeSections(state, "down", action.dataset.id);
      if (name === "move-photo-left" && isEditing(state)) movePhoto(state, action.dataset.city, action.dataset.photo, "left");
      if (name === "move-photo-right" && isEditing(state)) movePhoto(state, action.dataset.city, action.dataset.photo, "right");
      if (name === "export" && isEditing(state)) window.ArchiveStore.exportJson(state.data);
      if (name === "import" && isEditing(state)) $("#importInput")?.click();
      if (name === "undo" && isEditing(state)) undo(state);
      if (name === "publish" && document.body.classList.contains("admin-authenticated")) {
        event.preventDefault();
        window.ArchiveAdmin?.publish?.();
      }
      if (name === "top") window.scrollTo({ top: 0, behavior: "smooth" });
      if (name === "random") window.ArchiveApp.openRandom();
      if (name === "next") window.ArchiveApp.openNext();
    });

    document.addEventListener("click", (event) => {
      if (event.target.closest(".card-tools, .image-tools, [data-action], [data-upload-card], [data-upload-cover], [data-upload-gallery], [data-add-gallery]")) return;
      const contentLink = event.target.closest("[data-open-content]");
      if (contentLink) {
        window.ArchiveApp.openContent(contentLink.dataset.openContent, contentLink.dataset.id);
        return;
      }
      const cityLink = event.target.closest("[data-open-city]");
      if (cityLink) window.ArchiveApp.openCity(cityLink.dataset.openCity);
    });

    document.addEventListener("focusin", (event) => {
      if (event.target.matches(".editable")) syncToolbar(state, event.target);
    });

    document.addEventListener("input", (event) => {
      if (event.target.matches(".editable") && isEditing(state)) saveEditable(state, event.target);
      if (event.target.matches("[data-style]") && isEditing(state)) applyStyleControl(state, event.target);
    });

    document.addEventListener("change", (event) => {
      const photoId = event.target.dataset.photoRatio;
      if (!photoId || !isEditing(state)) return;
      const city = cityById(state.data, event.target.dataset.city);
      const photo = city?.gallery.find((item) => item.id === photoId);
      if (!photo) return;
      remember(state);
      photo.aspectMode = event.target.value;
      touch(city);
      markDirty(state);
      window.ArchiveStore.save(state.data, true);
      window.ArchiveRender.renderApp(state);
    });

    $("#importInput")?.addEventListener("change", async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      await window.ArchiveManager?.backup(state.data, "导入 JSON 前")?.catch(() => {});
      state.data = await window.ArchiveStore.importJson(file);
      markDirty(state);
      state.currentSlug = "";
      window.ArchiveStore.save(state.data);
      window.ArchiveRender.renderApp(state);
    });

    $("#cityTagInput")?.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === "," || event.key === "，" || event.key === " ") {
        event.preventDefault();
        addPendingTag();
      }
    });
    $("#cityTagInput")?.addEventListener("blur", addPendingTag);
    $("#cityTagInput")?.addEventListener("input", (event) => renderTagSuggestions(event.target.value.trim()));
    $("#cityTagChips")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-remove-tag]");
      if (!button) return;
      renderTagChips(tagValues().filter((tag) => tag !== decodeURIComponent(button.dataset.removeTag)));
      renderTagSuggestions();
    });
    $("#cityTagSuggestions")?.addEventListener("mousedown", (event) => event.preventDefault());
    $("#cityTagSuggestions")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-suggest-tag]");
      if (!button) return;
      const tag = decodeURIComponent(button.dataset.suggestTag);
      renderTagChips([...tagValues(), tag]);
      rememberTag(tag);
      renderTagSuggestions();
    });
  }

  function init(state) {
    bindGlobalActions(state);
  }

  window.ArchiveEditor = { init, uploadHeroBackground };
})();
