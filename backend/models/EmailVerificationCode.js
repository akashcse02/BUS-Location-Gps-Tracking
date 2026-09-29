import mongoose from "mongoose";
import { idPlugin } from "../lib/idPlugin.js";

const schema = new mongoose.Schema(
  {
    user_id: { type: String, required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    code_hash: { type: String, required: true },
    expires_at: { type: Date, required: true, index: true },
    attempts: { type: Number, default: 0 },
    used: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } },
);
schema.plugin(idPlugin);
schema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("EmailVerificationCode", schema);
