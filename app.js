const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d", { willReadFrequently: false });

const penBtn = document.getElementById("pen");
const eraserBtn = document.getElementById("eraser");
const clearBtn = document.getElementById("clear");
const sizeSlider = document.getElementById("size");

let tool = "pen"; // "pen" | "eraser"
let drawing = false;
let last = null;

function setActiveTool(nextTool) {
  tool = nextTool;
  penBtn.classList.toggle("btn--active", tool === "pen");
  eraserBtn.classList.toggle("btn--active", tool === "eraser");
}

penBtn.addEventListener("click", () => setActiveTool("pen"));
eraserBtn.addEventListener("click", () => setActiveTool("eraser"));

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

  // Draw in CSS pixels while backing store uses device pixels
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Restore old drawing scaled to new size (best-effort)
  // This keeps things from wiping when you rotate/rescale.
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(old, 0, 0, old.width, old.height, 0, 0, canvas.width, canvas.height);
  ctx.restore();
}

window.addEventListener("resize", resizeCanvasToDisplaySize);
resizeCanvasToDisplaySize();

clearBtn.addEventListener("click", () => {
  // Clear the whole canvas reliably
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
});

// Pointer Events: one API for mouse + touch + stylus
canvas.addEventListener("pointerdown", (e) => {
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
    ctx.lineWidth = Math.max(8, size * 5); // eraser is bigger
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
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch {
      // ignore if already released
    }
  }
}

canvas.addEventListener("pointerup", stopDrawing);
canvas.addEventListener("pointercancel", stopDrawing);
canvas.addEventListener("pointerleave", stopDrawing);

// Default tool
setActiveTool("pen");
