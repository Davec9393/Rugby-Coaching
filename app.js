window.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);

  const boardWrap = $("boardWrap");
  const canvas = $("board");
  const ctx = canvas.getContext("2d", { willReadFrequently: false });

  const penBtn = $("pen");
  const eraserBtn = $("eraser");
  const clearBtn = $("clear");
  const saveBtn = $("saveImage");
  const sizeSlider = $("size");

  const clearPlayersBtn = $("clearPlayers");
  const resetPlayersBtn = $("resetPlayers");

  const playerTray = $("playerTray");
  const tokensLayer = $("tokensLayer");

  // ===== Canvas sizing (HiDPI correct) =====
  function resizeCanvasToDisplaySize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // preserve drawing when resizing
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

    // restore old drawing scaled
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(old, 0, 0, old.width, old.height, 0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  window.addEventListener("resize", resizeCanvasToDisplaySize);
  resizeCanvasToDisplaySize();

  // ===== Correct pointer-to-canvas coordinates (fixes offset) =====
  function getCanvasPoint(e) {
    const r = canvas.getBoundingClientRect();
    return {
      x: e.clientX - r.left,
      y: e.clientY - r.top,
    };
  }

  // ===== Drawing =====
  let tool = "pen";
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

  clearBtn.addEventListener("click", () => {
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
      ctx.strokeStyle = "#111";
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

  // ===== Players (tray spawns copies) =====
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

  function makeTokenDraggable(token) {
    let dragging = false;
    let offX = 0, offY = 0;

    token.addEventListener("pointerdown", (e) => {
      dragging = true;
      token.setPointerCapture(e.pointerId);

      const r = token.getBoundingClientRect();
      offX = e.clientX - r.left;
      offY = e.clientY - r.top;

      token.style.zIndex = "10";
      e.preventDefault();
      e.stopPropagation(); // prevents drawing underneath
    });

    token.addEventListener("pointermove", (e) => {
      if (!dragging) return;

      const wrap = boardWrap.getBoundingClientRect();
      const rawX = (e.clientX - wrap.left) - offX;
      const rawY = (e.clientY - wrap.top) - offY;

      const p = clampToBoard(rawX, rawY);
      setTokenPos(token, p.x, p.y);

      e.preventDefault();
      e.stopPropagation();
    });

    const stop = (e) => {
      if (!dragging) return;
      dragging = false;
      token.style.zIndex = "1";
      try { token.releasePointerCapture(e.pointerId); } catch {}
      e.preventDefault();
      e.stopPropagation();
    };

    token.addEventListener("pointerup", stop);
    token.addEventListener("pointercancel", stop);
  }

  function createBoardToken(number, x, y) {
    const t = document.createElement("div");
    t.className = "token";
    t.textContent = String(number);
    setTokenPos(t, x, y);
    tokensLayer.appendChild(t);
    makeTokenDraggable(t);
    return t;
  }

  function createTrayToken(number) {
    const t = document.createElement("div");
    t.className = "tray-token";
    t.textContent = String(number);

    // Drag from tray => create a token and drag it immediately
    t.addEventListener("pointerdown", (e) => {
      const start = clampToBoard(20, 20);
      const token = createBoardToken(number, start.x, start.y);

      const wrap = boardWrap.getBoundingClientRect();
      const tr = token.getBoundingClientRect();
      const offX = e.clientX - tr.left;
      const offY = e.clientY - tr.top;

      token.setPointerCapture(e.pointerId);
      token.style.zIndex = "10";

      const onMove = (ev) => {
        const rawX = (ev.clientX - wrap.left) - offX;
        const rawY = (ev.clientY - wrap.top) - offY;
        const p = clampToBoard(rawX, rawY);
        setTokenPos(token, p.x, p.y);
        ev.preventDefault();
      };

      const onUp = (ev) => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        token.style.zIndex = "1";
        try { token.releasePointerCapture(e.pointerId); } catch {}
        ev.preventDefault();
      };

      window.addEventListener("pointermove", onMove, { passive: false });
      window.addEventListener("pointerup", onUp, { passive: false });
      window.addEventListener("pointercancel", onUp, { passive: false });

      e.preventDefault();
    });

    playerTray.appendChild(t);
  }

  // Populate tray
  playerTray.innerHTML = "";
  for (let i = 1; i <= 15; i++) createTrayToken(i);

  // ===== Clear / Reset players =====
  function clearPlayers() {
    tokensLayer.innerHTML = "";
  }

  function resetPlayers() {
    // With tray-spawns-copies, reset == clear the placed tokens
    clearPlayers();
  }

  clearPlayersBtn.addEventListener("click", clearPlayers);
  resetPlayersBtn.addEventListener("click", resetPlayers);

  // ===== Save PNG (pitch + drawings + tokens) =====
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

    const scale = 2; // increase to 3 if you want even sharper images
    const out = document.createElement("canvas");
    out.width = w * scale;
    out.height = h * scale;
    const octx = out.getContext("2d");
    octx.setTransform(scale, 0, 0, scale, 0, 0);

    // 1) pitch background
    try {
      const pitch = await loadPitchImage();
      octx.drawImage(pitch, 0, 0, w, h);
    } catch {
      octx.fillStyle = "#2b8a3e";
      octx.fillRect(0, 0, w, h);
    }

    // 2) drawing
    octx.drawImage(canvas, 0, 0, w, h);

    // 3) tokens
    const tokens = [...tokensLayer.querySelectorAll(".token")];
    for (const t of tokens) {
      const x = parseFloat(t.style.left || "0");
      const y = parseFloat(t.style.top || "0");
      const n = t.textContent || "";

      octx.beginPath();
      octx.arc(x + TOKEN_SIZE / 2, y + TOKEN_SIZE / 2, TOKEN_SIZE / 2, 0, Math.PI * 2);
      octx.fillStyle = "rgba(201, 42, 42, 0.95)";
      octx.fill();

      octx.lineWidth = 2;
      octx.strokeStyle = "rgba(255,255,255,0.9)";
      octx.stroke();

      octx.fillStyle = "#fff";
      octx.font = "800 18px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      octx.textAlign = "center";
      octx.textBaseline = "middle";
      octx.fillText(n, x + TOKEN_SIZE / 2, y + TOKEN_SIZE / 2);
    }

    downloadDataUrl(out.toDataURL("image/png"), `rugby-board-${Date.now()}.png`);
  }

  saveBtn.addEventListener("click", saveBoardAsPng);
});
