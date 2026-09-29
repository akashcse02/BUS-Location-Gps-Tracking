// Mirrors public.profiles (id = the user's id).
import mongoose from "mongoose";

const profileSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true }, // == User.id
    full_name: { type: String, required: true },
    id_number: { type: String, default: null },
    department: { type: String, default: null },
    avatar_url: { type: String, default: null },
    phone_number: { type: String, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);
profileSchema.set("toJSON", { transform: (_d, r) => { delete r._id; delete r.__v; return r; } });
export default mongoose.model("Profile", profileSchema);
