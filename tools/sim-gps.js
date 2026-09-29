import process from "node:process";

const baseUrl = process.env.API_URL || "http://localhost:5000";
const deviceId = process.env.DEVICE_ID || "GPS-PUB-01";
const deviceToken = process.env.DEVICE_TOKEN || "PASTE_TOKEN_FROM_NPM_RUN_SEED";
let latitude = Number(process.env.LAT || 24.9223067);
let longitude = Number(process.env.LNG || 89.3490259);
let bearing = 90;

if (deviceToken === "PASTE_TOKEN_FROM_NPM_RUN_SEED") {
  console.error("Set DEVICE_TOKEN to the token printed by npm run seed.");
  process.exit(1);
}

async function send() {
  const body = {
    device_id: deviceId,
    device_token: deviceToken,
    latitude,
    longitude,
    speed_kmh: 28,
    bearing,
    accuracy_m: 5,
    satellites: 9,
    device_time: new Date().toISOString(),
  };
  const response = await fetch(`${baseUrl}/api/device/gps`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  console.log(new Date().toISOString(), response.status, await response.text());
  longitude += 0.0008;
  if (longitude > 89.36) longitude = 89.34;
  bearing = bearing === 90 ? 270 : 90;
}

await send();
setInterval(() => send().catch((err) => console.error(err.message)), 10000);
