// ===== Elements =====
const boardWrap = document.getElementById("boardWrap");
const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d", { willReadFrequently: false });

const penBtn = document.getElementById("pen");
const eraserBtn = document.getElementById("eraser");
const clearBtn = document.getElementById("clear");
const saveBtn = document.getElementById("saveImage");
const sizeSlider = document.getElementById("size");

const playerTray = document.getElementById("playerTray");
const tokensLayer = document.getElementById("tokensLayer");

// ===== State =====
let tool = "pen";
let drawing = false;
let last = null;

const TOKEN_SIZE = 46;

// ===== Canvas sizing (must match CSS size) =====
function resizeCanvasToDisplaySize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  // Keep existing drawing when resizing
  const old = document.createElement("canvas");
  old.width = canvas.width;
  old.height = canvas.height;
  old.getContext("2d").drawImage(canvas, 0, 0);

  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));

  // Draw using CSS pixels
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Restore old drawing scaled
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(old, 0, 0, old.width, old.height, 0, 0, canvas.width, canvas.height);
  ctx.restore();
}

window.addEventListener("resize", resizeCanvasToDisplaySize);
resizeCanvasToDisplaySize();

// ===== Tool buttons =====
function setActiveTool(nextTool) {
  tool = nextTool;
  penBtn.classList.toggle("btn--active", tool === "pen");
  eraserBtn.classList.toggle("btn--active", tool === "eraser");
}
penBtn.addEventListener("click", () => setActiveTool("pen"));
eraserBtn.addEventListener("click", () => setActiveTool("eraser"));
setActiveTool("pen");

clearBtn.addEventListener("click", () => {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
});

// ===== Drawing (always enabled; tokens intercept their own drags) =====
canvas.addEventListener("pointerdown", (e) => {
  // If the user tapped a token, the token element will receive the event, not the canvas.
  drawing = true;
  last = { x: e.offsetX, y: e.offsetY };
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener("pointermove", (e) => {
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
  drawing = false;
  last = null;
  if (e?.pointerId) {
    try { canvas.releasePointerCapture(e.pointerId); } catch {}
  }
}

canvas.addEventListener("pointerup", stopDrawing);
canvas.addEventListener("pointercancel", stopDrawing);
canvas.addEventListener("pointerleave", stopDrawing);

// ===== Tokens: drag from tray -> creates a board token =====
function clampToBoard(x, y) {
  const rect = boardWrap.getBoundingClientRect();
  const maxX = rect.width - TOKEN_SIZE;
  const maxY = rect.height - TOKEN_SIZE;
  return {
    x: Math.min(Math.max(0, x), maxX),
    y: Math.min(Math.max(0, y), maxY),
  };
}

function setTokenPos(el, x, y) {
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
}

function makeBoardToken(number, startX, startY) {
  const token = document.createElement("div");
  token.className = "token";
  token.textContent = String(number);
  setTokenPos(token, startX, startY);
  tokensLayer.appendChild(token);
  makeTokenDraggable(token);
  return token;
}

function makeTokenDraggable(token) {
  let draggingToken = false;
  let offset = { x: 0, y: 0 };

  token.addEventListener("pointerdown", (e) => {
    draggingToken = true;
    token.setPointerCapture(e.pointerId);

    const tokenRect = token.getBoundingClientRect();
    offset.x = e.clientX - tokenRect.left;
    offset.y = e.clientY - tokenRect.top;

    token.style.zIndex = "10";
    e.preventDefault();
    e.stopPropagation();
  });

  token.addEventListener("pointermove", (e) => {
    if (!draggingToken) return;

    const wrapRect = boardWrap.getBoundingClientRect();
    const rawX = (e.clientX - wrapRect.left) - offset.x;
    const rawY = (e.clientY - wrapRect.top) - offset.y;

    const { x, y } = clampToBoard(rawX, rawY);
    setTokenPos(token, x, y);

    e.preventDefault();
    e.stopPropagation();
  });

  const stop = (e) => {
    if (!draggingToken) return;
    draggingToken = false;
    token.style.zIndex = "1";
    if (e?.pointerId) {
      try { token.releasePointerCapture(e.pointerId); } catch {}
    }
    e.preventDefault();
    e.stopPropagation();
  };

  token.addEventListener("pointerup", stop);
  token.addEventListener("pointercancel", stop);
}

function makeTrayToken(number) {
  const t = document.createElement("div");
  t.className = "tray-token";
  t.textContent = String(number);

  // Dragging from tray spawns a board token and drags it immediately
  t.addEventListener("pointerdown", (e) => {
    const wrapRect = boardWrap.getBoundingClientRect();

    // Spawn near the top-left of the pitch area by default
    const start = clampToBoard(20, 20);
