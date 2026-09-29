// Mirrors public.attendance_records.
import mongoose from "mongoose";
import { idPlugin } from "../lib/idPlugin.js";

const attendanceSchema = new mongoose.Schema(
  {
    class_id: { type: String, required: true },
    teacher_id: { type: String, required: true },
    student_name: { type: String, required: true },
    status: { type: String, default: "present" },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);
attendanceSchema.plugin(idPlugin);
export default mongoose.model("AttendanceRecord", attendanceSchema);
