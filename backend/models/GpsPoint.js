import mongoose from "mongoose";
import { idPlugin } from "../lib/idPlugin.js";

const gpsPointSchema = new mongoose.Schema(
  {
    bus_id: { type: String, required: true, index: true },
    trip_id: { type: String, default: null, index: true },
    device_id: { type: String, required: true, index: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    speed_kmh: { type: Number, default: null },
    bearing: { type: Number, default: null },
    accuracy_m: { type: Number, default: null },
    satellites: { type: Number, default: null },
    device_time: { type: String, default: null },
    received_at: { type: String, default: () => new Date().toISOString(), index: true },
    source: { type: String, default: "sim-gps" },
  },
  { timestamps: false }
);

gpsPointSchema.plugin(idPlugin);
gpsPointSchema.index({ bus_id: 1, received_at: -1 });

gpsPointSchema.index({ received_at: 1 }, { expireAfterSeconds: 7776000 });

export default mongoose.model("GpsPoint", gpsPointSchema);
