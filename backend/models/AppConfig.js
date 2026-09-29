// Mirrors public.app_config (key/value store, e.g. "fleet_routes").
import mongoose from "mongoose";

const appConfigSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: mongoose.Schema.Types.Mixed, default: {} },
    updated_by: { type: String, default: null },
  },
  { timestamps: { createdAt: false, updatedAt: "updated_at" } }
);
appConfigSchema.set("toJSON", { transform: (_d, r) => { delete r._id; delete r.__v; return r; } });
export default mongoose.model("AppConfig", appConfigSchema);
