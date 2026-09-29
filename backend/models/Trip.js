// Mirrors public.trips.
import mongoose from "mongoose";
import { idPlugin } from "../lib/idPlugin.js";

const tripSchema = new mongoose.Schema(
  {
    bus_id: { type: String, required: true, index: true },
    driver_id: { type: String, required: true },
    route_id: { type: String, required: true },
    status: { type: String, enum: ["not_started", "in_progress", "completed", "delayed", "cancelled"], default: "not_started" },
    start_time: { type: String, default: null },
    end_time: { type: String, default: null },
    current_lat: { type: Number, default: null },
    current_lng: { type: Number, default: null },
    occupancy: { type: String, enum: ["low", "medium", "high"], default: "low" },
    speed: { type: Number, default: null },
    bearing: { type: Number, default: null },
    accuracy: { type: Number, default: null },
    last_gps_at: { type: String, default: null },
    gps_source: { type: String, enum: ["sim-gps", "driver-phone", "manual"], default: "sim-gps" },
    gps_device_id: { type: String, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);
tripSchema.plugin(idPlugin);
export default mongoose.model("Trip", tripSchema);
