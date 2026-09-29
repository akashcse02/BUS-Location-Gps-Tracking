# PUB Bus Track — SIM GPS Hardware Integration

This version uses a **GPS module + cellular/SIM modem** on the bus as the primary tracking source.
The bus device does not need a student/driver login. It authenticates to the backend with a per-bus device ID and secret token.

## Data flow

```text
GPS satellite
   ↓
GPS module (for example NEO-6M / NEO-M8N)
   ↓ latitude, longitude, speed, bearing
Cellular modem (SIM800/SIM900/SIM7600/A7670/etc.)
   ↓ mobile data/SIM
Internet
   ↓ HTTP POST
Node.js + Express API
   ↓
MongoDB
   ├── trips (latest live position)
   └── gpspoints (location history)
   ↓
Authenticated web app
   ↓
Student / Teacher / Admin Live Map
```

## Device endpoint

`POST /api/device/gps`

JSON body:

```json
{
  "device_id": "GPS-PUB-01",
  "device_token": "YOUR_BUS_DEVICE_TOKEN",
  "latitude": 24.9223,
  "longitude": 89.3490,
  "speed_kmh": 28.5,
  "bearing": 92,
  "accuracy_m": 5,
  "satellites": 9,
  "device_time": "2026-09-29T02:00:00Z"
}
```

The endpoint automatically creates an active trip for the bus when the bus has a route assigned and no active trip exists. Each accepted packet updates the live position and is also saved to the `gpspoints` collection.

## Important deployment requirement

A SIM device on a real bus **cannot send data to `localhost` on your PC**. The Node/Express backend must be reachable from the public internet through a deployed server/domain with HTTPS (recommended). Put that public API URL into the device firmware.

## Recommended update interval

- Moving: every 5–10 seconds
- Stopped: every 20–60 seconds
- Add a heartbeat when there is no GPS fix

Do not send every second unless there is a specific reason; it increases mobile data use and database writes.

## Device credentials

Run:

```bash
npm run seed
```

The seed creates/provisions `GPS-PUB-01` ... `GPS-PUB-10` and prints each token in the terminal. Keep those tokens secret. They are stored hashed-in-practice only by access control? **This project currently stores the device token in MongoDB for direct device authentication, so protect your database and never commit `.env` or exported credentials.**

For a production deployment, replace the direct token storage with a hashed credential design and rotate compromised tokens.
