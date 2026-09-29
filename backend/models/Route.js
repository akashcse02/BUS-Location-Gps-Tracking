// Mirrors public.routes.
import mongoose from "mongoose";
import { idPlugin } from "../lib/idPlugin.js";

const routeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String, default: null },
    path_points: { type: mongoose.Schema.Types.Mixed, default: null },
    stops: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);
routeSchema.plugin(idPlugin);
export default mongoose.model("Route", routeSchema);
