// Auth-only credentials. Kept separate from Profile to mirror the original
// Mirrors an auth-users / profiles split.
import mongoose from "mongoose";
import { idPlugin } from "../lib/idPlugin.js";

const userSchema = new mongoose.Schema(
  { email: { type: String, required: true, unique: true, lowercase: true, trim: true }, password: { type: String, required: true }, email_verified: { type: Boolean, default: false, index: true }, email_verified_at: { type: Date, default: null } },
  { timestamps: false }
);
userSchema.plugin(idPlugin);
export default mongoose.model("User", userSchema);
