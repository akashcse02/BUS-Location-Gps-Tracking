// Mirrors public.class_schedules.
import mongoose from "mongoose";
import { idPlugin } from "../lib/idPlugin.js";

const classScheduleSchema = new mongoose.Schema(
  {
    teacher_id: { type: String, required: true },
    course_name: { type: String, required: true },
    section: { type: String, default: null },
    room: { type: String, default: null },
    day_of_week: { type: String, default: null },
    start_time: { type: String, default: null },
    end_time: { type: String, default: null },
    approved: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);
classScheduleSchema.plugin(idPlugin);
export default mongoose.model("ClassSchedule", classScheduleSchema);
