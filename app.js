const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");

let tool = "pen";
let drawing = false;
let last = null;

// Ensure canvas matches the displayed size (important!)
function resize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);

  // Draw using CSS pixels (not device pixels)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}

window.addEventListener("resize", resize);
resize();

document.getElementById("pen").onclick = () => (tool = "pen");
document.getElementById("eraser").onclick = () => (tool = "eraser");
document.getElementById("clear").onclick = () =>
  ctx.clearRect(0, 0, canvas.width, canvas.height);

canvas.addEventListener("pointerdown", (e) => {
  drawing = true;
  last = { x: e.offsetX, y: e.offsetY };
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener("pointermove", (e) => {
  if (!drawing) return;

  const x = e.offsetX;
  const y = e.offsetY;

  ctx.beginPath();
  ctx.moveTo(last.x, last.y);
  ctx.lineTo(x, y);

  if (tool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.lineWidth = 22;
  } else {
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 4;
  }

  ctx.stroke();
  last = { x, y };
});

function stopDrawing(e) {
  drawing = false;
  last = null;
  if (e?.pointerId) canvas.releasePointerCapture(e.pointerId);
}

canvas.addEventListener("pointerup", stopDrawing);
canvas.addEventListener("pointercancel", stopDrawing);
canvas.addEventListener("pointerleave", stopDrawing);
