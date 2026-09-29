// Mirrors public.announcements.
import mongoose from "mongoose";
import { idPlugin } from "../lib/idPlugin.js";

const announcementSchema = new mongoose.Schema(
  {
    author_id: { type: String, required: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    target_role: { type: String, enum: ["student", "teacher", "driver", "admin", null], default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);
announcementSchema.plugin(idPlugin);
export default mongoose.model("Announcement", announcementSchema);
