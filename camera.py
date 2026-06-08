import cv2
import requests
import time
import serial

# ─── CONFIG ───
BOT_TOKEN = "8697091278:AAHgblU56dfGOptR16ocXAx92UqueDLQSz8"
CHAT_ID = "6867582844"

SERIAL_PORT = "/dev/ttyACM0"
BAUD_RATE = 9600

last_alert = 0
camera_cooldown = 3  # seconds

# ─── TELEGRAM ───
def send_photo(path, caption="Intruder detected"):
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendPhoto"

    with open(path, "rb") as photo:
        requests.post(
            url,
            data={
                "chat_id": CHAT_ID,
                "caption": caption
            },
            files={"photo": photo}
        )

# ─── CAMERA ───
def capture():
    cam = cv2.VideoCapture(0)
    time.sleep(1)

    ret, frame = cam.read()

    if ret:
        filename = f"intruder_{int(time.time())}.jpg"
        cv2.imwrite(filename, frame)
        send_photo(filename)
        print("📸 Sent")

    cam.release()

# ─── SERIAL ───
arduino = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
time.sleep(2)

print("🚀 Radar system running...")

# ─── LOOP ───
while True:
    try:
        line = arduino.readline().decode().strip()
        if not line:
            continue

        print("Arduino:", line)

        # ─── ALARM MODE ───
        if line == "ALARM":
            now = time.time()
            if now - last_alert > camera_cooldown:
                print("🚨 ALARM DETECTED")
                capture()
                last_alert = now
            continue

        # ─── RADAR MODE angle,distance ───
        if "," in line:
            angle, distance = line.split(",")
            angle = float(angle)
            distance = float(distance)

            print(f"Angle: {angle} Distance: {distance}")

            # ─── SIMPLE AI DETECTION ───
            if distance < 10:
                now = time.time()
                if now - last_alert > camera_cooldown:
                    print("🚨 DANGER OBJECT CLOSE")
                    capture()
                    last_alert = now

    except Exception as e:
        print("Error:", e)