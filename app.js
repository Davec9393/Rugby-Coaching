// ===== Elements =====
const boardWrap = document.getElementById("boardWrap");
const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d", { willReadFrequently: false });

const penBtn = document.getElementById("pen");
const eraserBtn = document.getElementById("eraser");
const clearBtn = document.getElementById("clear");
const sizeSlider = document.getElementById("size");

const modeDrawBtn = document.getElementById("modeDraw");
const modePlayersBtn = document.getElementById("modePlayers");

const resetPlayersBtn = document.getElementById("resetPlayers");
const saveImageBtn = document.getElementById("saveImage");

const tokensLayer = document.getElementById("tokensLayer");

// ===== State =====
let tool = "pen";           // "pen" | "eraser"
let mode = "draw";          // "draw" | "players"
let drawing = false;
let last = null;

const TOKEN_SIZE = 46;
let defaultTokenPositions = []; // for reset

// ===== Helpers =====
function setActiveTool(nextTool) {
  tool = nextTool;
  penBtn.classList.toggle("btn--active", tool === "pen");
  eraserBtn.classList.toggle("btn--active", tool === "eraser");
}

function setMode(nextMode) {
  mode = nextMode;
  modeDrawBtn.classList.toggle("btn--active", mode === "draw");
  modePlayersBtn.classList.toggle("btn--active", mode === "players");

  // In Players mode: enable tokens interaction, disable drawing input
  if (mode === "players") {
    tokensLayer.style.pointerEvents = "auto";
    canvas.style.pointerEvents = "none";
  } else {
    tokensLayer.style.pointerEvents = "none";
    canvas.style.pointerEvents = "auto";
  }
}

function resizeCanvasToDisplaySize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  // Keep existing drawing when resizing by copying pixels
  const old = document.createElement("canvas");
  old.width = canvas.width;
  old.height = canvas.height;
  old.getContext("2d").drawImage(canvas, 0, 0);

  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));

  // Draw in CSS pixels
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Restore old drawing scaled to new size (best effort)
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(old, 0, 0, old.width, old.height, 0, 0, canvas.width, canvas.height);
  ctx.restore();
}

function setTokenPos(el, x, y) {
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
}

function clampToBoard(x, y) {
  const rect = boardWrap.getBoundingClientRect();
  const maxX = rect.width - TOKEN_SIZE;
  const maxY = rect.height - TOKEN_SIZE;

  return {
    x: Math.min(Math.max(0, x), maxX),
    y: Math.min(Math.max(0, y), maxY),
  };
}

// ===== Drawing events =====
canvas.addEventListener("pointerdown", (e) => {
  if (mode !== "draw") return;

  drawing = true;
  last = { x: e.offsetX, y: e.offsetY };
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener("pointermove", (e) => {
  if (mode !== "draw") return;
  if (!drawing || !last) return;

  const x = e.offsetX;
  const y = e.offsetY;

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

function stopDrawing(e) {
  if (mode !== "draw") return;

  drawing = false;
  last = null;

  if (e?.pointerId) {
    try { canvas.releasePointerCapture(e.pointerId); } catch {}
  }
}

canvas.addEventListener("pointerup", stopDrawing);
canvas.addEventListener("pointercancel", stopDrawing);
canvas.addEventListener("pointerleave", stopDrawing);

// ===== Buttons =====
penBtn.addEventListener("click", () => setActiveTool("pen"));
eraserBtn.addEventListener("click", () => setActiveTool("eraser"));
modeDrawBtn.addEventListener("click", () => setMode("draw"));
modePlayersBtn.addEventListener("click", () => setMode("players"));

clearBtn.addEventListener("click", () => {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
});

// ===== Player Tokens 1–15 =====
function makeTokenDraggable(token) {
  let draggingToken = false;
  let offset = { x: 0, y: 0 };

  token.addEventListener("pointerdown", (e) => {
    if (mode !== "players") return;

    draggingToken = true;
    token.setPointerCapture(e.pointerId);

    const tokenRect = token.getBoundingClientRect();
    offset.x = e.clientX - tokenRect.left;
    offset.y = e.clientY - tokenRect.top;

    token.style.zIndex = "10";
  });

  token.addEventListener("pointermove", (e) => {
    if (mode !== "players") return;
    if (!draggingToken) return;

    const wrapRect = boardWrap.getBoundingClientRect();
    const rawX = (e.clientX - wrapRect.left) - offset.x;
    const rawY = (e.clientY - wrapRect.top) - offset.y;

    const { x, y } = clampToBoard(rawX, rawY);
    setTokenPos(token, x, y);
  });

  const stop = (e) => {
    if (!draggingToken) return;
    draggingToken = false;
    token.style.zIndex = "1";

    if (e?.pointerId) {
      try { token.releasePointerCapture(e.pointerId); } catch {}
    }
  };

  token.addEventListener("pointerup", stop);
  token.addEventListener("pointercancel", stop);
}

function createTokens() {
  tokensLayer.innerHTML = "";
  defaultTokenPositions = [];

  // Bench layout on left: 3 columns x 5 rows
  const startX = 14;
  const startY = 14;
  const gap = 10;

  for (let i = 1; i <= 15; i++) {
    const token = document.createElement("div");
    token.className = "token token--home";
    token.textContent = String(i);

    const col = Math.floor((i - 1) / 5); // 0..2
    const row = (i - 1) % 5;             // 0..4
    const x = startX + col * (TOKEN_SIZE + gap);
    const y = startY + row * (TOKEN_SIZE + gap);

    setTokenPos(token, x, y);
    defaultTokenPositions.push({ i, x, y });

    makeTokenDraggable(token);
    tokensLayer.appendChild(token);
  }
}

resetPlayersBtn.addEventListener("click", () => {
  const tokens = [...tokensLayer.querySelectorAll(".token")];
  for (const t of tokens) {
    const num = Number(t.textContent);
    const def = defaultTokenPositions.find(p => p.i === num);
    if (def) setTokenPos(t, def.x, def.y);
  }
});

// ===== Save PNG (pitch + drawings + tokens) =====

// Load pitch.svg as an image for export
function loadPitchImage() {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // If you ever host pitch.svg from a different domain, you'd need CORS headers.
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = "./pitch.svg";
  });
}

function downloadDataUrl(dataUrl, filename) {
  // Most browsers: download attribute works
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function openDataUrlFallback(dataUrl) {
  // iOS Safari sometimes ignores download; open in new tab instead
  window.open(dataUrl, "_blank", "noopener,noreferrer");
}

async function saveBoardAsPng() {
  // Export size in CSS pixels (matches what user sees)
  const rect = boardWrap.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width));
  const height = Math.max(1, Math.floor(rect.height));

  // Optional: increase resolution for nicer exports
  const exportScale = 2; // change to 1 for smaller files
  const outW = width * exportScale;
  const outH = height * exportScale;

  const out = document.createElement("canvas");
  out.width = outW;
  out.height = outH;
  const octx = out.getContext("2d");

  // Scale so we can draw in CSS pixels
  octx.setTransform(exportScale, 0, 0, exportScale, 0, 0);

  // 1) Draw pitch
  try {
    const pitchImg = await loadPitchImage();
    octx.drawImage(pitchImg, 0, 0, width, height);
  } catch {
    // If pitch fails, use fallback green
    octx.fillStyle = "#2b8a3e";
    octx.fillRect(0, 0, width, height);
  }

  // 2) Draw canvas strokes
  // Our drawing canvas is device-pixel sized; draw it scaled into CSS pixel space
  octx.drawImage(canvas, 0, 0, width, height);

  // 3) Draw tokens (as circles with numbers)
  const tokens = [...tokensLayer.querySelectorAll(".token")];
  for (const t of tokens) {
    const left = parseFloat(t.style.left || "0");
    const top = parseFloat(t.style.top || "0");
    const number = t.textContent || "";

    // Circle
    octx.beginPath();
    octx.arc(left + TOKEN_SIZE / 2, top + TOKEN_SIZE / 2, TOKEN_SIZE / 2, 0, Math.PI * 2);
    octx.fillStyle = "rgba(25, 113, 194, 0.95)"; // match token--home
    octx.fill();

    // Border
    octx.lineWidth = 2;
    octx.strokeStyle = "rgba(255,255,255,0.85)";
    octx.stroke();

    // Number
    octx.fillStyle = "#fff";
    octx.font = "700 18px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    octx.textAlign = "center";
    octx.textBaseline = "middle";
    octx.fillText(number, left + TOKEN_SIZE / 2, top + TOKEN_SIZE / 2);
  }

  const dataUrl = out.toDataURL("image/png");

  // Try download; if blocked (often iOS), open fallback
  try {
    downloadDataUrl(dataUrl, `rugby-board-${Date.now()}.png`);
  } catch {
    openDataUrlFallback(dataUrl);
  }
}

saveImageBtn.addEventListener("click", saveBoardAsPng);

// ===== Init =====
window.addEventListener("resize", resizeCanvasToDisplaySize);
resizeCanvasToDisplaySize();

setActiveTool("pen");
setMode("draw");
createTokens();
