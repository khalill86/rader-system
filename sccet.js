
// ─── CONFIG ─────────────────────────────────────────────────────────────────
const BOT_TOKEN = "8697091278:AAHgblU56dfGOptR16ocXAx92UqueDLQSz8";
const CHAT_ID   = "6867582844";
import { io } from "socket.io-client";
import fetch from "node-fetch";

const socket = io("http://localhost:3000");
function sendTelegram(text) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text
    })
  });
}

socket.on("radar-data", (msg) => {
  console.log("BOT received:", msg);

  // alert logic
  if (msg === "ALERT") {
    sendTelegram("🚨 ALERT FROM RADAR");
  }

  if (msg.includes(",")) {
    const [angle, distance] = msg.split(",");

    if (distance < 15) {
      sendTelegram(`🎯 Target: ${angle}° - ${distance}`);
    }
  }
});