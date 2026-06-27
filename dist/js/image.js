(function () {
  let resolver = null;
  let state = null;
  const dialog = () => document.getElementById("cropDialog");
  const stage = () => document.getElementById("cropStage");
  const image = () => document.getElementById("cropImage");
  const zoom = () => document.getElementById("cropZoom");
  const zoomText = () => document.getElementById("cropZoomText");
  const aspect = () => document.getElementById("cropAspect");

  async function cropFile(file) {
    if (!file || !file.type.startsWith("image/")) return "";
    const src = URL.createObjectURL(file);
    return new Promise((resolve) => {
      resolver = resolve;
      const img = new Image();
      img.onload = () => {
        state = {
          src,
          file,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          x: 0,
          y: 0,
          scale: 1,
          dragging: false,
          pointers: new Map(),
          freeFrame: null,
          cropAction: ""
        };
        state.cropRatio = img.naturalWidth / img.naturalHeight;
        image().src = src;
        zoom().value = "1";
        aspect().value = "original";
        zoomText().textContent = "100%";
        if (typeof dialog().showModal === "function") dialog().showModal();
        else dialog().setAttribute("open", "open");
        requestAnimationFrame(fit);
      };
      img.onerror = () => {
        URL.revokeObjectURL(src);
        resolver = null;
        window.ArchiveUI?.toast("无法解码这张照片。HEIC / Live Photo 请先在相册中导出为普通照片后重试");
        resolve("");
      };
      img.src = src;
    });
  }

  function frame() {
    const rect = stage().getBoundingClientRect();
    if (state?.cropRatio === "free" && state.freeFrame) {
      applyFrame(state.freeFrame);
      return { ...state.freeFrame };
    }
    const maxWidth = rect.width * .84;
    const maxHeight = rect.height * .84;
    const ratio = state?.cropRatio || maxWidth / maxHeight;
    let width = maxWidth;
    let height = width / ratio;
    if (height > maxHeight) {
      height = maxHeight;
      width = height * ratio;
    }
    const result = { x: (rect.width - width) / 2, y: (rect.height - height) / 2, width, height };
    applyFrame(result);
    return result;
  }

  function applyFrame(value) {
    const frameNode = document.querySelector(".crop-frame");
    if (!frameNode) return;
    frameNode.style.inset = "auto";
    frameNode.style.left = `${value.x}px`;
    frameNode.style.top = `${value.y}px`;
    frameNode.style.width = `${value.width}px`;
    frameNode.style.height = `${value.height}px`;
    frameNode.classList.toggle("is-free", state?.cropRatio === "free");
  }

  function fit() {
    if (!state) return;
    const f = frame();
    const scale = Math.max(f.width / state.naturalWidth, f.height / state.naturalHeight);
    state.baseScale = scale;
    image().style.width = `${state.naturalWidth * scale}px`;
    image().style.height = `${state.naturalHeight * scale}px`;
    state.x = 0;
    state.y = 0;
    state.scale = 1;
    update();
  }

  function initialFreeFrame() {
    const rect = stage().getBoundingClientRect();
    state.freeFrame = {
      x: rect.width * .08,
      y: rect.height * .08,
      width: rect.width * .84,
      height: rect.height * .84
    };
  }

  function resizeFreeFrame(event) {
    const rect = stage().getBoundingClientRect();
    const start = state.frameStart;
    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    const handle = state.cropAction;
    let left = start.x;
    let top = start.y;
    let right = start.x + start.width;
    let bottom = start.y + start.height;
    if (handle.includes("w")) left += dx;
    if (handle.includes("e")) right += dx;
    if (handle.includes("n")) top += dy;
    if (handle.includes("s")) bottom += dy;
    if (handle === "move") {
      const width = start.width;
      const height = start.height;
      left = Math.min(rect.width - width, Math.max(0, start.x + dx));
      top = Math.min(rect.height - height, Math.max(0, start.y + dy));
      right = left + width;
      bottom = top + height;
    } else {
      left = Math.max(0, Math.min(left, right - 72));
      top = Math.max(0, Math.min(top, bottom - 72));
      right = Math.min(rect.width, Math.max(right, left + 72));
      bottom = Math.min(rect.height, Math.max(bottom, top + 72));
    }
    state.freeFrame = { x: left, y: top, width: right - left, height: bottom - top };
    applyFrame(state.freeFrame);
  }

  async function rotateSource() {
    if (!state) return;
    const source = image();
    const canvas = document.createElement("canvas");
    canvas.width = state.naturalHeight;
    canvas.height = state.naturalWidth;
    const ctx = canvas.getContext("2d");
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(source, -state.naturalWidth / 2, -state.naturalHeight / 2);
    const rotated = canvas.toDataURL("image/webp", .94);
    if (state.src?.startsWith("blob:")) URL.revokeObjectURL(state.src);
    state.src = rotated;
    state.naturalWidth = canvas.width;
    state.naturalHeight = canvas.height;
    state.freeFrame = null;
    image().src = rotated;
    await image().decode().catch(() => {});
    if (aspect().value === "original") state.cropRatio = state.naturalWidth / state.naturalHeight;
    if (aspect().value === "free") {
      state.cropRatio = "free";
      initialFreeFrame();
    }
    fit();
  }

  function update() {
    stage().style.setProperty("--crop-x", `${state.x}px`);
    stage().style.setProperty("--crop-y", `${state.y}px`);
    stage().style.setProperty("--crop-scale", state.scale);
    zoomText().textContent = `${Math.round(state.scale * 100)}%`;
  }

  function finish(value = "") {
    if (state?.src?.startsWith("blob:")) URL.revokeObjectURL(state.src);
    if (resolver) resolver(value);
    resolver = null;
    state = null;
    image().removeAttribute("src");
    if (typeof dialog().close === "function") dialog().close();
    else dialog().removeAttribute("open");
  }

  function saveCrop() {
    if (!state) return;
    const rect = stage().getBoundingClientRect();
    const f = frame();
    const displayedWidth = state.naturalWidth * state.baseScale * state.scale;
    const displayedHeight = state.naturalHeight * state.baseScale * state.scale;
    const left = rect.width / 2 + state.x - displayedWidth / 2;
    const top = rect.height / 2 + state.y - displayedHeight / 2;
    const sx = Math.max(0, (f.x - left) / (state.baseScale * state.scale));
    const sy = Math.max(0, (f.y - top) / (state.baseScale * state.scale));
    const sw = Math.min(state.naturalWidth - sx, f.width / (state.baseScale * state.scale));
    const sh = Math.min(state.naturalHeight - sy, f.height / (state.baseScale * state.scale));
    const outputRatio = f.width / f.height;
    const width = outputRatio >= 1 ? 1800 : Math.round(1800 * outputRatio);
    const height = outputRatio >= 1 ? Math.round(1800 / outputRatio) : 1800;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#f7f3eb";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image(), sx, sy, sw, sh, 0, 0, width, height);
    const quality = Number(window.ArchiveApp?.state?.data?.settings?.imageQuality || .82);
    const output = canvas.toDataURL("image/webp", Math.min(.95, Math.max(.55, quality)));
    const outputBytes = Math.round((output.length - output.indexOf(",") - 1) * .75);
    window.ArchiveImage.lastCompression = {
      name: state.file?.name || "image",
      originalBytes: state.file?.size || 0,
      outputBytes,
      width,
      height,
      aspectMode: aspect().value,
      uploadedAt: new Date().toISOString()
    };
    finish(output);
  }

  function thumb(dataUrl) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 320;
        canvas.height = 220;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/webp", .72));
      };
      img.src = dataUrl;
    });
  }

  function imageFromDataUrl(dataUrl) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  }

  async function extractTheme(source) {
    try {
      const img = typeof source === "string" ? await imageFromDataUrl(source) : source;
      if (!img) return null;
      const canvas = document.createElement("canvas");
      const size = 32;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, size, size);
      const pixels = ctx.getImageData(0, 0, size, size).data;
      let r = 0, g = 0, b = 0, count = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        const bright = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
        if (pixels[i + 3] < 220 || bright < 20 || bright > 246) continue;
        r += pixels[i]; g += pixels[i + 1]; b += pixels[i + 2]; count++;
      }
      if (!count) return null;
      const avg = [Math.round(r / count), Math.round(g / count), Math.round(b / count)];
      const mix = (base, amount) => `rgb(${avg.map((v, i) => Math.round(v * (1 - amount) + base[i] * amount)).join(",")})`;
      return {
        paper: mix([247, 243, 235], .78),
        cream: mix([255, 250, 242], .84),
        accent: mix([223, 233, 231], .70),
        accent2: mix([232, 237, 223], .72),
        line: `rgba(${avg[0]}, ${avg[1]}, ${avg[2]}, .16)`,
        shadow: `0 24px 70px rgba(${avg[0]}, ${avg[1]}, ${avg[2]}, .12)`,
        deepShadow: `0 36px 92px rgba(${avg[0]}, ${avg[1]}, ${avg[2]}, .20)`
      };
    } catch {
      return null;
    }
  }

  function applyTheme(theme) {
    const root = document.documentElement;
    if (!theme) {
      ["--paper","--cream","--accent","--accent-2","--line","--shadow","--deep-shadow"].forEach((key) => root.style.removeProperty(key));
      return;
    }
    root.style.setProperty("--paper", theme.paper);
    root.style.setProperty("--cream", theme.cream);
    root.style.setProperty("--accent", theme.accent);
    root.style.setProperty("--accent-2", theme.accent2);
    root.style.setProperty("--line", theme.line);
    root.style.setProperty("--shadow", theme.shadow);
    root.style.setProperty("--deep-shadow", theme.deepShadow);
  }

  function bindCropper() {
    const s = stage();
    const distance = () => {
      const points = [...state.pointers.values()];
      if (points.length < 2) return 0;
      return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
    };
    s.addEventListener("pointerdown", (event) => {
      if (!state) return;
      event.preventDefault();
      const handle = event.target.closest("[data-crop-handle]");
      const freeFrame = event.target.closest(".crop-frame");
      if (state.cropRatio === "free" && (handle || freeFrame)) {
        state.cropAction = handle?.dataset.cropHandle || "move";
        state.frameStart = { ...frame() };
        state.startX = event.clientX;
        state.startY = event.clientY;
        state.dragging = true;
        s.setPointerCapture(event.pointerId);
        return;
      }
      state.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      state.dragging = true;
      state.startX = event.clientX; state.startY = event.clientY;
      state.baseX = state.x; state.baseY = state.y;
      if (state.pointers.size === 2) {
        state.pinchStart = distance();
        state.pinchScale = state.scale;
      }
      s.classList.add("dragging");
      s.setPointerCapture(event.pointerId);
    });
    s.addEventListener("pointermove", (event) => {
      if (!state?.dragging) return;
      event.preventDefault();
      if (state.cropAction) {
        resizeFreeFrame(event);
        return;
      }
      state.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (state.pointers.size >= 2) {
        const ratio = distance() / Math.max(1, state.pinchStart || distance());
        state.scale = Math.min(3, Math.max(1, state.pinchScale * ratio));
        zoom().value = String(state.scale);
        update();
        return;
      }
      state.x = state.baseX + event.clientX - state.startX;
      state.y = state.baseY + event.clientY - state.startY;
      update();
    });
    const endPointer = (event) => {
      if (!state) return;
      state.pointers.delete(event.pointerId);
      state.dragging = false;
      state.cropAction = "";
      s.classList.remove("dragging");
      try { s.releasePointerCapture(event.pointerId); } catch {}
    };
    s.addEventListener("pointerup", endPointer);
    s.addEventListener("pointercancel", endPointer);
    s.addEventListener("dblclick", (event) => {
      event.preventDefault();
      fit();
    });
    s.addEventListener("wheel", (event) => {
      if (!state) return;
      event.preventDefault();
      const next = Math.min(3, Math.max(1, state.scale + (event.deltaY > 0 ? -.08 : .08)));
      state.scale = next;
      zoom().value = String(next);
      update();
    }, { passive: false });
    zoom().addEventListener("input", () => { if (state) { state.scale = Number(zoom().value); update(); } });
    aspect().addEventListener("change", () => {
      if (!state) return;
      if (aspect().value === "free") {
        state.cropRatio = "free";
        initialFreeFrame();
      } else {
        state.freeFrame = null;
        state.cropRatio = aspect().value === "original"
          ? state.naturalWidth / state.naturalHeight
          : Number(aspect().value);
      }
      fit();
    });
    document.querySelector('[data-action="crop-save"]').addEventListener("click", saveCrop);
    document.querySelector('[data-action="crop-reset"]').addEventListener("click", fit);
    document.querySelector('[data-action="crop-rotate"]').addEventListener("click", rotateSource);
    document.querySelector('[data-action="crop-cancel"]').addEventListener("click", () => finish(""));
  }

  window.ArchiveImage = { cropFile, thumb, extractTheme, applyTheme, bindCropper };
})();
