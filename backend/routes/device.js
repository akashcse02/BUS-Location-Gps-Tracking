import express from "express";
import crypto from "node:crypto";
import Bus from "../models/Bus.js";
import Trip from "../models/Trip.js";
import Route from "../models/Route.js";
import GpsPoint from "../models/GpsPoint.js";

const router = express.Router();

function validCoordinate(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function normalizeNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

router.post("/gps", async (req, res) => {
  try {
    const body = req.body || {};
    const deviceId = String(body.device_id || body.deviceId || "").trim();
    const token = String(body.device_token || body.deviceToken || "").trim();
    const lat = normalizeNumber(body.latitude ?? body.lat);
    const lng = normalizeNumber(body.longitude ?? body.lng);

    if (!deviceId || !token || !validCoordinate(lat, lng)) {
      return res.status(400).json({ message: "device_id, device_token, latitude and longitude are required" });
    }

    const bus = await Bus.findOne({ gps_device_id: deviceId }).select("+gps_device_token");
    const tokenOk = bus?.gps_device_token && Buffer.byteLength(token) === Buffer.byteLength(bus.gps_device_token) && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(bus.gps_device_token));
    if (!bus || !tokenOk) {
      return res.status(401).json({ message: "Invalid GPS device credentials" });
    }

    const receivedAt = new Date().toISOString();
    const speed = normalizeNumber(body.speed_kmh ?? body.speed);
    const bearing = normalizeNumber(body.bearing);
    const accuracy = normalizeNumber(body.accuracy_m ?? body.accuracy);
    const satellites = normalizeNumber(body.satellites);
    const deviceTime = body.device_time || body.timestamp || null;

    let trip = await Trip.findOne({ bus_id: bus.id, status: { $in: ["in_progress", "delayed"] } }).sort({ created_at: -1 });
    if (!trip) {
      const route = bus.current_route_id ? await Route.findOne({ id: bus.current_route_id }) : null;
      if (!route) return res.status(409).json({ message: "No route is assigned to this bus" });
      trip = await Trip.create({
        bus_id: bus.id,
        driver_id: bus.driver_id || `gps:${deviceId}`,
        route_id: route.id,
        status: "in_progress",
        start_time: receivedAt,
        gps_source: "sim-gps",
        gps_device_id: deviceId,
      });
    }

    trip.current_lat = lat;
    trip.current_lng = lng;
    trip.speed = speed;
    trip.bearing = bearing;
    trip.accuracy = accuracy;
    trip.last_gps_at = receivedAt;
    trip.gps_source = "sim-gps";
    trip.gps_device_id = deviceId;
    await trip.save();

    await Bus.updateOne({ id: bus.id }, { $set: { last_device_at: receivedAt, tracking_source: "sim-gps" } });

    const point = await GpsPoint.create({
      bus_id: bus.id,
      trip_id: trip.id,
      device_id: deviceId,
      latitude: lat,
      longitude: lng,
      speed_kmh: speed,
      bearing,
      accuracy_m: accuracy,
      satellites,
      device_time: deviceTime,
      received_at: receivedAt,
      source: "sim-gps",
    });

    return res.status(201).json({
      ok: true,
      message: "GPS location received",
      data: {
        bus_id: bus.id,
        bus_number: bus.bus_number,
        trip_id: trip.id,
        gps_point_id: point.id,
        latitude: lat,
        longitude: lng,
        received_at: receivedAt,
        gps_source: "sim-gps",
      },
    });
  } catch (err) {
    console.error("GPS device error:", err);
    return res.status(500).json({ message: err.message });
  }
});

router.post("/heartbeat", async (req, res) => {
  try {
    const deviceId = String(req.body?.device_id || "").trim();
    const token = String(req.body?.device_token || "").trim();
    if (!deviceId || !token) return res.status(400).json({ message: "device_id and device_token are required" });
    const bus = await Bus.findOne({ gps_device_id: deviceId }).select("+gps_device_token");
    if (!bus || bus.gps_device_token !== token) return res.status(401).json({ message: "Invalid GPS device credentials" });
    const at = new Date().toISOString();
    await Bus.updateOne({ id: bus.id }, { $set: { last_device_at: at } });
    res.json({ ok: true, bus_id: bus.id, received_at: at });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

export default router;
