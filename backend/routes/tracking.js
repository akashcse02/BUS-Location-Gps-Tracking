import express from "express";
import Trip from "../models/Trip.js";
import Bus from "../models/Bus.js";
import Route from "../models/Route.js";
import Issue from "../models/Issue.js";
import UserRole from "../models/UserRole.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();
const VALID_OCCUPANCY = ["low", "medium", "high"];

function distanceKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function etaFor(route, lat, lng) {
  if (!route?.stops?.length || typeof lat !== "number" || typeof lng !== "number") return { nextStop: null, etaMinutes: null, distanceKm: null };
  const current = { lat, lng };
  let nearestIndex = 0;
  let nearestDistance = Infinity;
  route.stops.forEach((stop, index) => {
    const position = stop.position || stop;
    if (typeof position?.lat !== "number" || typeof position?.lng !== "number") return;
    const d = distanceKm(current, position);
    if (d < nearestDistance) { nearestDistance = d; nearestIndex = index; }
  });
  const next = route.stops[Math.min(nearestIndex + 1, route.stops.length - 1)];
  if (!next) return { nextStop: null, etaMinutes: null, distanceKm: null };
  const position = next.position || next;
  const km = distanceKm(current, position);
  const minutes = Math.max(1, Math.round((km / 25) * 60));
  return { nextStop: next.name, etaMinutes: minutes, distanceKm: Number(km.toFixed(2)) };
}

async function driverRole(req, res, next) {
  const role = await UserRole.findOne({ user_id: req.user.id }).lean();
  if (role?.role !== "driver") return res.status(403).json({ message: "Driver access required" });
  next();
}

router.get("/live", requireAuth, async (_req, res) => {
  try {
    const [buses, routes, trips] = await Promise.all([
      Bus.find({}).lean(),
      Route.find({}).lean(),
      Trip.find({ status: { $in: ["in_progress", "delayed"] } }).lean(),
    ]);

    const routeMap = Object.fromEntries(routes.map((r) => [r.id, r]));
    const tripMap = Object.fromEntries(trips.map((t) => [t.bus_id, t]));

    const data = buses.map((bus) => {
      const trip = tripMap[bus.id] || null;
      const route = routeMap[trip?.route_id || bus.current_route_id] || null;
      const eta = trip && route ? etaFor(route, trip.current_lat, trip.current_lng) : { nextStop: null, etaMinutes: null, distanceKm: null };
      return {
        bus_id: bus.id,
        bus_number: bus.bus_number,
        bus_status: bus.status,
        route_id: route?.id || bus.current_route_id || null,
        route_name: route?.name || null,
        route,
        trip_id: trip?.id || null,
        trip_status: trip?.status || "not_started",
        current_lat: trip?.current_lat ?? null,
        current_lng: trip?.current_lng ?? null,
        speed: trip?.speed ?? null,
        bearing: trip?.bearing ?? null,
        accuracy: trip?.accuracy ?? null,
        occupancy: trip?.occupancy ?? "low",
        last_gps_at: trip?.last_gps_at ?? null,
        gps_device_id: bus.gps_device_id || null,
        last_device_at: bus.last_device_at || null,
        device_online: Boolean(bus.last_device_at && Date.now() - new Date(bus.last_device_at).getTime() < 45000),
        tracking_source: bus.tracking_source || "sim-gps",
        updated_at: trip?.updated_at || trip?.created_at || bus.created_at,
        ...eta,
      };
    });

    res.json({ data, serverTime: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/start", requireAuth, driverRole, async (req, res) => {
  try {
    const { busId, routeId, occupancy = "low" } = req.body;
    if (!VALID_OCCUPANCY.includes(occupancy)) return res.status(400).json({ message: "Invalid occupancy" });
    const active = await Trip.findOne({ driver_id: req.user.id, status: { $in: ["in_progress", "delayed"] } });
    if (active) return res.status(409).json({ message: "You already have an active trip", trip: active.toJSON() });

    let bus = busId ? await Bus.findOne({ id: busId }) : null;
    if (!bus) bus = await Bus.findOne({ driver_id: req.user.id, status: "active" });
    if (!bus) bus = await Bus.findOne({ status: "active" }).sort({ created_at: 1 });
    if (!bus) return res.status(404).json({ message: "No active bus is available" });

    const route = routeId ? await Route.findOne({ id: routeId }) : await Route.findOne({ id: bus.current_route_id });
    if (!route) return res.status(404).json({ message: "No route is assigned to this bus" });

    const trip = await Trip.create({ bus_id: bus.id, driver_id: req.user.id, route_id: route.id, status: "in_progress", start_time: new Date().toISOString(), occupancy });
    await Bus.updateOne({ id: bus.id }, { $set: { current_route_id: route.id } });
    res.status(201).json({ data: trip.toJSON(), bus: bus.toJSON(), route: route.toJSON() });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.patch("/:tripId/location", requireAuth, driverRole, async (req, res) => {
  try {
    const { lat, lng, speed = null, bearing = null, accuracy = null } = req.body;
    if (![lat, lng].every((v) => typeof v === "number" && Number.isFinite(v))) return res.status(400).json({ message: "Valid latitude and longitude are required" });
    const trip = await Trip.findOneAndUpdate(
      { id: req.params.tripId, driver_id: req.user.id, status: { $in: ["in_progress", "delayed"] } },
      { $set: { current_lat: lat, current_lng: lng, speed, bearing, accuracy, last_gps_at: new Date().toISOString() } },
      { new: true }
    );
    if (!trip) return res.status(404).json({ message: "Active trip not found" });
    res.json({ data: trip.toJSON() });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.patch("/:tripId/status", requireAuth, driverRole, async (req, res) => {
  try {
    const { status } = req.body;
    if (!["in_progress", "delayed", "completed", "cancelled"].includes(status)) return res.status(400).json({ message: "Invalid trip status" });
    const trip = await Trip.findOneAndUpdate(
      { id: req.params.tripId, driver_id: req.user.id, status: { $in: ["in_progress", "delayed"] } },
      { $set: { status, ...(status === "completed" || status === "cancelled" ? { end_time: new Date().toISOString() } : {}) } },
      { new: true }
    );
    if (!trip) return res.status(404).json({ message: "Active trip not found" });
    res.json({ data: trip.toJSON() });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.patch("/:tripId/occupancy", requireAuth, driverRole, async (req, res) => {
  if (!VALID_OCCUPANCY.includes(req.body?.occupancy)) return res.status(400).json({ message: "Invalid occupancy" });
  const trip = await Trip.findOneAndUpdate({ id: req.params.tripId, driver_id: req.user.id, status: { $in: ["in_progress", "delayed"] } }, { $set: { occupancy: req.body.occupancy } }, { new: true });
  if (!trip) return res.status(404).json({ message: "Active trip not found" });
  res.json({ data: trip.toJSON() });
});

router.post("/sos", requireAuth, driverRole, async (req, res) => {
  try {
    const { tripId, lat, lng, message = "Driver emergency alert" } = req.body;
    const issue = await Issue.create({ user_id: req.user.id, title: "SOS / Emergency Alert", description: `${message}${typeof lat === "number" && typeof lng === "number" ? ` | Location: ${lat}, ${lng}` : ""}${tripId ? ` | Trip: ${tripId}` : ""}`, category: "emergency", status: "pending" });
    if (tripId) await Trip.updateOne({ id: tripId, driver_id: req.user.id }, { $set: { status: "delayed" } });
    res.status(201).json({ data: issue.toJSON(), message: "Emergency alert sent to the admin queue" });
  } catch (err) { res.status(500).json({ message: err.message }); }
});


router.get("/bus/:busId/history", requireAuth, async (req, res) => {
  try {
    const { default: GpsPoint } = await import("../models/GpsPoint.js");
    const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 2000);
    const data = await GpsPoint.find({ bus_id: req.params.busId }).sort({ received_at: -1 }).limit(limit).lean();
    res.json({ data });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/eta/:tripId", async (req, res) => {
  try {
    const trip = await Trip.findOne({ id: req.params.tripId }).lean();
    if (!trip) return res.status(404).json({ message: "Trip not found" });
    const route = await Route.findOne({ id: trip.route_id }).lean();
    res.json({ data: etaFor(route, trip.current_lat, trip.current_lng) });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

export default router;
