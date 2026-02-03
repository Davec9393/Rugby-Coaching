window.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);

  // Elements
  const boardWrap = $("boardWrap");
  const canvas = $("board");
  const ctx = canvas.getContext("2d", { willReadFrequently: false });

  const penBtn = $("pen");
  const eraserBtn = $("eraser");
  const clearDrawBtn = $("clearDraw");
  const saveBtn = $("saveImage");

  const sizeSlider = $("size");
  const colorPicker = $("color");

  const clearPlayersBtn = $("clearPlayers");
  const playerTray = $("playerTray");
  const tokensLayer = $("tokensLayer");

  // ---- quick sanity check: show current color on screen (debug) ----
  const debug = document.createElement("div");
  debug.style.cssText =
    "position:fixed;right:10px;bottom:10px;z-index:9999;" +
    "background:#111;color:#fff;padding:6px 10px;border-radius:10px;" +
    "font:12px system-ui;opacity:0.85";
  debug.textContent = `color: ${colorPicker.value}`;
  document.body.appendChild(debug);

  colorPicker.addEventListener("input", () => {
    debug.textContent = `color: ${colorPicker.value}`;
  });

  // ===== Canvas sizing (HiDPI correct) =====
  function resizeCanvasToDisplaySize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // preserve drawing
    const old = document.createElement("canvas");
    old.width = canvas.width;
    old.height = canvas.height;
    old.getContext("2d").drawImage(canvas, 0, 0);

    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));

    // draw in CSS pixels
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // restore drawing scaled
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(old, 0, 0, old.width, old.height, 0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  window.addEventListener("resize", resizeCanvasToDisplaySize);
  resizeCanvasToDisplaySize();

  // ===== Coordinate helpers =====
  function getCanvasPoint(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function getBoardPoint(e) {
    const r = boardWrap.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  // ===== Drawing =====
  let tool = "pen"; // "pen" | "eraser"
  let drawing = false;
  let last = null;

  function setTool(next) {
    tool = next;
    penBtn.classList.toggle("btn--active", tool === "pen");
    eraserBtn.classList.toggle("btn--active", tool === "eraser");
  }
  setTool("pen");

  penBtn.addEventListener("click", () => setTool("pen"));
  eraserBtn.addEventListener("click", () => setTool("eraser"));

  clearDrawBtn.addEventListener("click", () => {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  });

  canvas.addEventListener("pointerdown", (e) => {
    drawing = true;
    last = getCanvasPoint(e);
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!drawing || !last) return;

    const { x, y } = getCanvasPoint(e);

    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(x, y);

    const size = Number(sizeSlider.value || 4);

    if (tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = Math.max(10, size * 5);
    } else {
      ctx.globalCompositeOperation = "source-over";

      // ✅ GUARANTEED: read picker value at draw time
      ctx.strokeStyle = colorPicker.value || "#111111";
      ctx.lineWidth = size;
    }

    ctx.stroke();
    last = { x, y };
  });

  function stopDraw(e) {
    drawing = false;
    last = null;
    try { canvas.releasePointerCapture(e.pointerId); } catch {}
  }

  canvas.addEventListener("pointerup", stopDraw);
  canvas.addEventListener("pointercancel", stopDraw);
  canvas.addEventListener("pointerleave", stopDraw);

  // ===== Players =====
  const TOKEN_SIZE = 46;

  function setTokenPos(el, x, y) {
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }

  function clampToBoard(x, y) {
    const rect = boardWrap.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(x, rect.width - TOKEN_SIZE)),
      y: Math.max(0, Math.min(y, rect.height - TOKEN_SIZE)),
    };
  }

  function startDraggingToken(token, pointerId, startBoardPoint) {
    let dragging = true;

    const curLeft = parseFloat(token.style.left || "0");
    const curTop = parseFloat(token.style.top || "0");
    const offsetX = startBoardPoint.x - curLeft;
    const offsetY = startBoardPoint.y - curTop;

    token.style.zIndex = "10";
    token.setPointerCapture(pointerId);

    const onMove = (ev) => {
      if (!dragging) return;
      const p = getBoardPoint(ev);
      const rawX = p.x - offsetX;
      const rawY = p.y - offsetY;
      const clamped = clampToBoard(rawX, rawY);
      setTokenPos(token, clamped.x, clamped.y);

      ev.preventDefault();
      ev.stopPropagation();
    };

    const onUp = (ev) => {
      dragging = false;
      token.style.zIndex = "1";

      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);

      try { token.releasePointerCapture(pointerId); } catch {}

      ev.preventDefault();
      ev.stopPropagation();
    };

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp, { passive: false });
    window.addEventListener("pointercancel", onUp, { passive: false });
  }

  function makeTokenDraggable(token) {
    token.addEventListener("pointerdown", (e) => {
      const p = getBoardPoint(e);
      startDraggingToken(token, e.pointerId, p);
      e.preventDefault();
      e.stopPropagation();
    });
  }

  function createBoardToken(number, x, y) {
    const t = document.createElement("div");
    t.className = "token";
    t.textContent = String(number);

    const clamped = clampToBoard(x, y);
    setTokenPos(t, clamped.x, clamped.y);

    tokensLayer.appendChild(t);
    makeTokenDraggable(t);
    return t;
  }

  function createTrayToken(number) {
    const t = document.createElement("div");
    t.className = "tray-token";
    t.textContent = String(number);

    t.addEventListener("pointerdown", (e) => {
      const p = getBoardPoint(e);
      const token = createBoardToken(number, p.x - TOKEN_SIZE / 2, p.y - TOKEN_SIZE / 2);
      startDraggingToken(token, e.pointerId, p);
      e.preventDefault();
    });

    playerTray.appendChild(t);
  }

  // Populate tray 1–15
  playerTray.innerHTML = "";
  for (let i = 1; i <= 15; i++) createTrayToken(i);

  // Clear players
  clearPlayersBtn.addEventListener("click", () => {
    tokensLayer.innerHTML = "";
  });

  // ===== Save PNG =====
  function loadPitchImage() {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = "./pitch.svg";
    });
  }

  function downloadDataUrl(dataUrl, filename) {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function saveBoardAsPng() {
    const rect = boardWrap.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));

    const scale = 2;
    const out = document.createElement("canvas");
    out.width = w * scale;
    out.height = h * scale;
    const octx = out.getContext("2d");
    octx.setTransform(scale, 0, 0, scale, 0, 0);

    // Pitch
    try {
      const pitch = await loadPitchImage();
      octx.drawImage(pitch, 0, 0, w, h);
    } catch {
      octx.fillStyle = "#2b8a3e";
      octx.fillRect(0, 0, w, h);
    }

    // Drawings
    octx.drawImage(canvas, 0, 0, w, h);

    // Tokens
    const TOKEN = 46;
    const tokens = [...tokensLayer.querySelectorAll(".token")];
    for (const t of tokens) {
      const x = parseFloat(t.style.left || "0");
      const y = parseFloat(t.style.top || "0");
      const n = t.textContent || "";

      octx.beginPath();
      octx.arc(x + TOKEN / 2, y + TOKEN / 2, TOKEN / 2, 0, Math.PI * 2);
      octx.fillStyle = "rgba(201, 42, 42, 0.95)";
      octx.fill();

      octx.lineWidth = 2;
      octx.strokeStyle = "rgba(255,255,255,0.9)";
      octx.stroke();

      octx.fillStyle = "#fff";
      octx.font = "800 18px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      octx.textAlign = "center";
      octx.textBaseline = "middle";
      octx.fillText(n, x + TOKEN / 2, y + TOKEN / 2);
    }

    downloadDataUrl(out.toDataURL("image/png"), `rugby-board-${Date.now()}.png`);
  }

  saveBtn.addEventListener("click", saveBoardAsPng);
});
