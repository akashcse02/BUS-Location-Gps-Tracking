// Mirrors public.user_roles.
import mongoose from "mongoose";
import { idPlugin } from "../lib/idPlugin.js";

const userRoleSchema = new mongoose.Schema({
  user_id: { type: String, required: true, index: true },
  role: { type: String, enum: ["student", "teacher", "driver", "admin"], required: true },
});
userRoleSchema.plugin(idPlugin);
export default mongoose.model("UserRole", userRoleSchema);
