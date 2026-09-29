// Mirrors public.reviews.
import mongoose from "mongoose";
import { idPlugin } from "../lib/idPlugin.js";

const reviewSchema = new mongoose.Schema(
  {
    user_id: { type: String, required: true },
    display_name: { type: String, required: true },
    role_label: { type: String, default: "Student" },
    comment: { type: String, required: true },
    rating: { type: Number, default: 5 },
    approved: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);
reviewSchema.plugin(idPlugin);
export default mongoose.model("Review", reviewSchema);
