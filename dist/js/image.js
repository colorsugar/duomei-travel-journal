(function () {
  let resolver = null;
  let state = null;
  const dialog = () => document.getElementById("cropDialog");
  const stage = () => document.getElementById("cropStage");
  const image = () => document.getElementById("cropImage");
  const zoom = () => document.getElementById("cropZoom");
  const zoomText = () => document.getElementById("cropZoomText");

  function read(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(file);
    });
  }

  async function cropFile(file) {
    if (!file || !file.type.startsWith("image/")) return "";
    const src = await read(file);
    return new Promise((resolve) => {
      resolver = resolve;
      const img = new Image();
      img.onload = () => {
        state = { src, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight, x: 0, y: 0, scale: 1, dragging: false };
        image().src = src;
        zoom().value = "1";
        zoomText().textContent = "100%";
        if (typeof dialog().showModal === "function") dialog().showModal();
        else dialog().setAttribute("open", "open");
        requestAnimationFrame(fit);
      };
      img.src = src;
    });
  }

  function frame() {
    const rect = stage().getBoundingClientRect();
    return { x: rect.width * .08, y: rect.height * .08, width: rect.width * .84, height: rect.height * .84 };
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

  function update() {
    stage().style.setProperty("--crop-x", `${state.x}px`);
    stage().style.setProperty("--crop-y", `${state.y}px`);
    stage().style.setProperty("--crop-scale", state.scale);
    zoomText().textContent = `${Math.round(state.scale * 100)}%`;
  }

  function finish(value = "") {
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
    const width = 1600;
    const height = Math.round(width * f.height / f.width);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#f7f3eb";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image(), sx, sy, sw, sh, 0, 0, width, height);
    finish(canvas.toDataURL("image/jpeg", .86));
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
        resolve(canvas.toDataURL("image/jpeg", .72));
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
    s.addEventListener("pointerdown", (event) => {
      if (!state) return;
      state.dragging = true;
      state.startX = event.clientX; state.startY = event.clientY;
      state.baseX = state.x; state.baseY = state.y;
      s.classList.add("dragging");
      s.setPointerCapture(event.pointerId);
    });
    s.addEventListener("pointermove", (event) => {
      if (!state?.dragging) return;
      state.x = state.baseX + event.clientX - state.startX;
      state.y = state.baseY + event.clientY - state.startY;
      update();
    });
    s.addEventListener("pointerup", (event) => {
      if (!state) return;
      state.dragging = false;
      s.classList.remove("dragging");
      try { s.releasePointerCapture(event.pointerId); } catch {}
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
    document.querySelector('[data-action="crop-save"]').addEventListener("click", saveCrop);
    document.querySelector('[data-action="crop-reset"]').addEventListener("click", fit);
    document.querySelector('[data-action="crop-cancel"]').addEventListener("click", () => finish(""));
  }

  window.ArchiveImage = { cropFile, thumb, extractTheme, applyTheme, bindCropper };
})();
