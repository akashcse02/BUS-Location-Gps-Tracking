// Mirrors public.buses.
import mongoose from "mongoose";
import { idPlugin } from "../lib/idPlugin.js";

const busSchema = new mongoose.Schema(
  {
    bus_number: { type: String, required: true, unique: true },
    license_plate: { type: String, default: null },
    capacity: { type: Number, default: 52 },
    status: { type: String, enum: ["active", "maintenance", "inactive"], default: "active" },
    current_route_id: { type: String, default: null },
    driver_id: { type: String, default: null, index: true },
    gps_device_id: { type: String, default: null, unique: true, sparse: true, index: true },
    gps_device_token: { type: String, default: null, select: false },
    tracking_source: { type: String, enum: ["sim-gps", "driver-phone", "manual"], default: "sim-gps" },
    last_device_at: { type: String, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);
busSchema.plugin(idPlugin);
export default mongoose.model("Bus", busSchema);
