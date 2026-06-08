const socket = io("http://localhost:3000");

const canvas = document.getElementById("radarCanvas");
const ctx = canvas.getContext("2d");

//  HUD elements
const hudAngle = document.getElementById("hudAngle");
const hudDistance = document.getElementById("hudDistance");
const hudTime = document.getElementById("hudTime");

// parameters
let center = { x: 0, y: 0 };
let radius = 0;

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  center.x = canvas.width / 2;
  center.y = canvas.height * 0.95;

  radius = Math.min(canvas.width, canvas.height) * 0.9;
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// targets
let targets = [];
let currentAngle = 0;

const TARGET_LIFETIME = 1200;
const SWEEP_WIDTH = 2;
const MIN_DISTANCE = 2;
const MAX_DISTANCE = 15;

// GRID
function drawGrid() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(0,255,0,0.5)";
  ctx.lineWidth = 2;

  for (let i = 1; i <= 5; i++) {
    ctx.beginPath();
    ctx.arc(center.x, center.y, i * (radius / 5), Math.PI, 2 * Math.PI);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.moveTo(center.x - radius, center.y);
  ctx.lineTo(center.x + radius, center.y);
  ctx.stroke();
}

// SWEEP
function drawSweep() {
  const rad = (currentAngle * Math.PI) / 180;

  ctx.beginPath();
  ctx.moveTo(center.x, center.y);

  ctx.lineTo(
    center.x + Math.cos(rad) * radius,
    center.y - Math.sin(rad) * radius
  );

  ctx.strokeStyle = "lime";
  ctx.lineWidth = 3;
  ctx.shadowBlur = 25;
  ctx.shadowColor = "lime";
  ctx.stroke();

  ctx.shadowBlur = 0;
}

// TARGETS
function drawTargets() {
  const now = Date.now();

  targets = targets.filter(t => now - t.time < TARGET_LIFETIME);

  targets.forEach(t => {

    let diff = Math.abs((currentAngle - t.deg + 540) % 360 - 180);

    if (diff > SWEEP_WIDTH) return;

    const x = center.x + Math.cos(t.angle) * t.distance;
    const y = center.y - Math.sin(t.angle) * t.distance;

    const lifeRatio = (now - t.time) / TARGET_LIFETIME;
    ctx.globalAlpha = 1 - lifeRatio;

    ctx.beginPath();
    ctx.fillStyle = "red";
    ctx.shadowBlur = 20;
    ctx.shadowColor = "red";
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  });
}

// LOOP
function animate() {
  drawGrid();
  drawSweep();
  drawTargets();
  requestAnimationFrame(animate);
}

animate();

// SOCKET DATA
socket.on("status", (msg) => {

  if (msg === "CLEAR") {
    targets = [];
    return;
  }

  if (msg === "ALARM") return;

  const [angle, distance] = msg.split(",");

  const a = parseFloat(angle);
  const d = parseFloat(distance);

  if (!isNaN(a) && !isNaN(d)) {

    currentAngle = a;

    // 🔥 HUD UPDATE
    hudAngle.textContent = a.toFixed(0);
    hudDistance.textContent = d.toFixed(1);
    hudTime.textContent = new Date().toLocaleTimeString();

    if (d > MIN_DISTANCE && d <= MAX_DISTANCE) {

      const normalized = (d - MIN_DISTANCE) / (MAX_DISTANCE - MIN_DISTANCE);

      targets.push({
        deg: a,
        angle: (a * Math.PI) / 180,
        distance: normalized * radius,
        time: Date.now()
      });
    }
  }
});