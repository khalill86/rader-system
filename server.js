import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";
import { exec } from "child_process";
import fetch from "node-fetch";

// ─── CONFIG ───
const BOT_TOKEN = "8697091278:AAHgblU56dfGOptR16ocXAx92UqueDLQSz8";
const CHAT_ID = "6867582844";

// ─── APP ───
const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

// ─── STATE ───
let lastDistance = null;
let lastAlertTime = 0;
let lastCameraTime = 0;

// ─── TELEGRAM ───
function sendTelegram(text) {
  fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text
    })
  }).catch(err => console.log("Telegram error:", err.message));
}

// ─── ANALYSIS ENGINE ───
function analyze(distance) {
  if (distance < 10) return "DANGER";
  if (distance < 20) return "WARNING";

  if (lastDistance !== null && distance < lastDistance - 3) {
    return "APPROACHING";
  }

  return "SAFE";
}

// ─── COOLDOWNS ───
function canAlert() {
  const now = Date.now();
  if (now - lastAlertTime > 5000) {
    lastAlertTime = now;
    return true;
  }
  return false;
}

function canTriggerCamera() {
  const now = Date.now();
  if (now - lastCameraTime > 3000) {
    lastCameraTime = now;
    return true;
  }
  return false;
}

// ─── SOCKET ───
io.on("connection", () => {
  console.log("Client connected");
});

// ─── SERIAL PORT ───
const port = new SerialPort({
  path: "/dev/ttyACM0",
  baudRate: 9600
});

const parser = port.pipe(new ReadlineParser({ delimiter: "\n" }));

port.on("open", () => {
  console.log("✅ Serial connected");
});

parser.on("data", (data) => {
  const msg = data.toString().trim();
  console.log("Arduino:", msg);

  io.emit("status", msg);

  // ─── ALARM FROM ARDUINO ───
  if (msg === "ALARM") {
    console.log("🚨 ALARM TRIGGERED");

    if (canTriggerCamera()) {
      exec("python3 camera.py", (err) => {
        if (err) console.log("Camera error:", err.message);
      });
    }

    io.emit("alarm", {
      type: "ALARM",
      time: new Date().toISOString()
    });

    if (canAlert()) {
      sendTelegram("🚨 ALARM TRIGGERED FROM RADAR");
    }

    return;
  }

  // ─── RADAR DATA ───
  if (!msg.includes(",")) return;

  const [a, d] = msg.split(",");
  const angle = parseFloat(a);
  const distance = parseFloat(d);

  if (isNaN(angle) || isNaN(distance)) return;

  const state = analyze(distance);

  io.emit("ai", { angle, distance, state });

  console.log("AI STATE:", state);

  // ─── ALERTS ───
  if (state === "DANGER" && canAlert()) {
    sendTelegram(`🚨 DANGER TARGET\nAngle: ${angle}°\nDistance: ${distance}`);
  }

  if (state === "APPROACHING" && canAlert()) {
    sendTelegram(`⚠️ OBJECT APPROACHING\nAngle: ${angle}°`);
  }
});

// ─── START SERVER ───
server.listen(3000, () => {
  console.log("🚀 Server running on http://localhost:3000");
});