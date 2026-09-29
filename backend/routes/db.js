import express from "express";
import { registry, publicReadTables } from "../lib/registry.js";
import { runQuery } from "../lib/queryEngine.js";
import UserRole from "../models/UserRole.js";

const router = express.Router();

// One generic endpoint stands in for every `db.from(table)...` call the
// frontend makes. See src/integrations/backend/client.ts on the frontend
// for the query-builder client that sends this exact spec shape.
router.post("/:table", async (req, res) => {
  const { table } = req.params;
  const Model = registry[table];
  if (!Model) return res.status(404).json({ data: null, error: { message: `Unknown table: ${table}` } });

  const spec = req.body || {};

  const isWrite = spec.action !== "select";
  const isPublicRead = spec.action === "select" && publicReadTables.has(table);

  if ((isWrite || !isPublicRead) && !req.user) {
    return res.status(401).json({ data: null, error: { message: "Not authenticated" } });
  }

  if (isWrite && req.user) {
    const roleDoc = await UserRole.findOne({ user_id: req.user.id }).lean();
    const role = roleDoc?.role;
    if (table === "trips" && spec.action === "insert" && role !== "driver" && role !== "admin") {
      return res.status(403).json({ data: null, error: { message: "Only drivers or admins can start trips" } });
    }
    if (table === "trips" && spec.action === "update" && role !== "admin") {
      const filters = Array.isArray(spec.filters) ? [...spec.filters] : [];
      filters.push(["driver_id", "eq", req.user.id]);
      spec.filters = filters;
    }
    if (table === "class_schedules" && spec.action !== "select" && role !== "teacher" && role !== "admin") {
      return res.status(403).json({ data: null, error: { message: "Teacher or admin access required" } });
    }
    if (table === "attendance_records" && spec.action !== "select" && role !== "teacher" && role !== "admin") {
      return res.status(403).json({ data: null, error: { message: "Teacher or admin access required" } });
    }
    if (table === "announcements" && spec.action !== "select" && role !== "teacher" && role !== "admin") {
      return res.status(403).json({ data: null, error: { message: "Teacher or admin access required" } });
    }
    if (["routes", "buses", "app_config"].includes(table) && !["admin"].includes(role)) {
      return res.status(403).json({ data: null, error: { message: "Admin access required" } });
    }
    if (table === "user_roles" && role !== "admin") {
      return res.status(403).json({ data: null, error: { message: "Admin access required" } });
    }
  }

  const result = await runQuery(Model, table, spec);
  res.json(result);
});

export default router;
