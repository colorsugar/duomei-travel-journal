(function () {
  const $ = (selector, root = document) => root.querySelector(selector);
  const today = () => new Date().toISOString().slice(0, 10);

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

  async function cropAndTheme(file) {
    const image = await window.ArchiveImage.cropFile(file);
    if (!image) return null;
    const thumb = await window.ArchiveImage.thumb(image);
    const theme = await window.ArchiveImage.extractTheme(image);
    return { image, thumb, theme };
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

  async function addGalleryFiles(city, files) {
    city.gallery = city.gallery || [];
    const uploadedIds = [];
    for (const file of files) {
      const result = await cropAndTheme(file);
      if (!result) continue;
      const photo = emptyPhotoSlot(city) || createPhoto();
      photo.src = result.image;
      photo.thumb = result.thumb;
      uploadedIds.push(photo.id);
      if (!city.gallery.includes(photo)) city.gallery.push(photo);
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
    $("#cityTags").value = city?.tags?.join(", ") || "";
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
    city.place = formValue("cityPlace") || "还没有写地点";
    city.published = formValue("cityPublished") || today();
    city.updated = today();
    city.category = formValue("cityCategory") || "Travel";
    city.excerpt = formValue("cityExcerpt") || "这一页还在慢慢书写。";
    city.bodyTop = formValue("cityBody") || city.bodyTop || "把一天里最想留下的画面写在这里。";
    city.tags = formValue("cityTags").split(/[,，\s]+/).map((tag) => tag.trim()).filter(Boolean);

    const cover = filesFrom($("#cityCover"))[0];
    if (cover) {
      const result = await cropAndTheme(cover);
      if (result) {
        city.coverImage = result.image;
        city.coverThumb = result.thumb;
        city.cardImage = city.cardImage || result.image;
        city.cardThumb = city.cardThumb || result.thumb;
        city.theme = result.theme;
      }
    }

    const gallery = filesFrom($("#cityGallery"));
    if (gallery.length) await addGalleryFiles(city, gallery);

    if (!existing) state.data.journeys.push(city);
    state.currentSlug = city.slug;
    state.data = window.ArchiveStore.normalize(state.data);
    window.ArchiveStore.save(state.data);
    closeDialog($("#cityDialog"));
    window.ArchiveRender.renderApp(state);
    window.ArchiveApp.openCity(city.slug);
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
  }

  function styleRootFor(state, editable) {
    const path = editable.dataset.bind;
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
    input.click();

    input.addEventListener("change", async () => {
      const files = filesFrom(input);
      if (!files.length) return;
      let uploadedIds = [];

      if (target.dataset.uploadCard) {
        const result = await cropAndTheme(files[0]);
        if (result) {
          city.cardImage = result.image;
          city.cardThumb = result.thumb;
        }
      }

      if (target.dataset.uploadCover) {
        const result = await cropAndTheme(files[0]);
        if (result) {
          city.coverImage = result.image;
          city.coverThumb = result.thumb;
          city.theme = result.theme;
        }
      }

      if (target.dataset.uploadGallery) {
        const photo = city.gallery.find((item) => item.id === target.dataset.uploadGallery);
        const result = await cropAndTheme(files[0]);
        if (photo && result) {
          photo.src = result.image;
          photo.thumb = result.thumb;
          uploadedIds.push(photo.id);
        }
      }

      if (target.dataset.addGallery) uploadedIds = await addGalleryFiles(city, files);

      touch(city);
      state.data = window.ArchiveStore.normalize(state.data);
      window.ArchiveStore.save(state.data);
      window.ArchiveRender.renderApp(state);
      focusUploadedPhoto(uploadedIds[0]);
    }, { once: true });
  }

  function deleteCity(state, id) {
    const city = cityById(state.data, id);
    if (!city) return;
    if (!confirm(`确定删除「${city.title}」吗？`)) return;
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
    const [city] = state.data.journeys.splice(index, 1);
    state.data.journeys.splice(next, 0, city);
    window.ArchiveStore.save(state.data);
    window.ArchiveRender.renderApp(state);
  }

  function deletePhoto(state, cityId, photoId) {
    const city = cityById(state.data, cityId);
    if (!city) return;
    city.gallery = city.gallery.filter((photo) => photo.id !== photoId);
    touch(city);
    window.ArchiveStore.save(state.data);
    window.ArchiveRender.renderApp(state);
  }

  function movePhoto(state, cityId, photoId, direction) {
    const city = cityById(state.data, cityId);
    if (!city) return;
    const index = city.gallery.findIndex((photo) => photo.id === photoId);
    const next = direction === "left" ? index - 1 : index + 1;
    if (index < 0 || next < 0 || next >= city.gallery.length) return;
    const [photo] = city.gallery.splice(index, 1);
    city.gallery.splice(next, 0, photo);
    touch(city);
    window.ArchiveStore.save(state.data);
    window.ArchiveRender.renderApp(state);
  }

  function toggleEditMode(state) {
    if (!document.body.classList.contains("admin-authenticated")) return;
    state.editMode = !state.editMode;
    $("#editToggle").setAttribute("aria-pressed", String(state.editMode));
    $("#editToggle").textContent = state.editMode ? "完成编辑" : "编辑模式";
    window.ArchiveRender.setEditable(state.editMode);
    document.body.classList.toggle("edit-on", state.editMode);
    window.ArchiveRender.renderApp(state);
    if (!state.editMode) {
      state.activeEditable = null;
      $("#textToolbar")?.classList.remove("show");
    }
  }

  function bindGlobalActions(state) {
    $("#editToggle")?.addEventListener("click", () => toggleEditMode(state));

    document.addEventListener("click", async (event) => {
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
      if (name === "delete-city" && isEditing(state)) deleteCity(state, action.dataset.id);
      if (name === "move-city-up" && isEditing(state)) moveCity(state, action.dataset.id, "up");
      if (name === "move-city-down" && isEditing(state)) moveCity(state, action.dataset.id, "down");
      if (name === "delete-photo" && isEditing(state)) deletePhoto(state, action.dataset.city, action.dataset.photo);
      if (name === "move-photo-left" && isEditing(state)) movePhoto(state, action.dataset.city, action.dataset.photo, "left");
      if (name === "move-photo-right" && isEditing(state)) movePhoto(state, action.dataset.city, action.dataset.photo, "right");
      if (name === "export" && isEditing(state)) window.ArchiveStore.exportJson(state.data);
      if (name === "import" && isEditing(state)) $("#importInput")?.click();
      if (name === "top") window.scrollTo({ top: 0, behavior: "smooth" });
      if (name === "random") window.ArchiveApp.openRandom();
      if (name === "next") window.ArchiveApp.openNext();
    });

    document.addEventListener("click", (event) => {
      if (event.target.closest(".card-tools, .image-tools, [data-action], [data-upload-card], [data-upload-cover], [data-upload-gallery], [data-add-gallery]")) return;
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

    $("#importInput")?.addEventListener("change", async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      state.data = await window.ArchiveStore.importJson(file);
      state.currentSlug = "";
      window.ArchiveStore.save(state.data);
      window.ArchiveRender.renderApp(state);
    });
  }

  function init(state) {
    bindGlobalActions(state);
  }

  window.ArchiveEditor = { init };
})();
