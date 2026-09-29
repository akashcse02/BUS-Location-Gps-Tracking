import express from "express";
import Route from "../models/Route.js";
import UserRole from "../models/UserRole.js";

const router = express.Router();

async function requireAdmin(req, res, next) {
  const role = await UserRole.findOne({ user_id: req.user.id }).lean();
  if (role?.role !== "admin") return res.status(403).json({ message: "Admin access required" });
  next();
}

router.put("/routes/sync", requireAdmin, async (req, res) => {
  try {
    const routes = Array.isArray(req.body?.routes) ? req.body.routes : [];
    if (!routes.length) return res.status(400).json({ message: "At least one route is required" });

    const saved = [];
    for (const item of routes) {
      const name = String(item?.name || "").trim();
      if (!name) continue;
      const stops = Array.isArray(item.stops)
        ? item.stops
            .map((stop) => ({
              name: String(stop?.name || "Stop").trim(),
              position: { lat: Number(stop?.lat), lng: Number(stop?.lng) },
            }))
            .filter((stop) => Number.isFinite(stop.position.lat) && Number.isFinite(stop.position.lng))
        : [];
      const pathPoints = stops.map((stop) => stop.position);
      const existing = await Route.findOne({ name });
      const doc = existing
        ? await Route.findOneAndUpdate(
            { id: existing.id },
            { $set: { description: item.description || `${name} route`, stops, path_points: pathPoints } },
            { new: true },
          )
        : await Route.create({ name, description: item.description || `${name} route`, stops, path_points: pathPoints });
      saved.push(doc.toJSON());
    }

    res.json({ data: saved, message: "Routes synchronized with MongoDB" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
