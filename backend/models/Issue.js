// Mirrors public.issues.
import mongoose from "mongoose";
import { idPlugin } from "../lib/idPlugin.js";

const issueSchema = new mongoose.Schema(
  {
    user_id: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, default: null },
    category: { type: String, default: null },
    status: { type: String, enum: ["pending", "investigating", "resolved", "closed"], default: "pending" },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);
issueSchema.plugin(idPlugin);
export default mongoose.model("Issue", issueSchema);
