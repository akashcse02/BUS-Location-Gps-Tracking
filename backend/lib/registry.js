import Profile from "../models/Profile.js";
import UserRole from "../models/UserRole.js";
import Route from "../models/Route.js";
import Bus from "../models/Bus.js";
import Trip from "../models/Trip.js";
import Issue from "../models/Issue.js";
import Announcement from "../models/Announcement.js";
import AppConfig from "../models/AppConfig.js";
import Review from "../models/Review.js";
import ClassSchedule from "../models/ClassSchedule.js";
import AttendanceRecord from "../models/AttendanceRecord.js";

// Maps the Postgrest-style table names the frontend already uses
// (unchanged from the original schema design) to their Mongoose model.
export const registry = {
  profiles: Profile,
  user_roles: UserRole,
  routes: Route,
  buses: Bus,
  trips: Trip,
  issues: Issue,
  announcements: Announcement,
  app_config: AppConfig,
  reviews: Review,
  class_schedules: ClassSchedule,
  attendance_records: AttendanceRecord,
};

// Tables that unauthenticated visitors may SELECT from directly
// (matches roughly what the original RLS policies made public-readable).
export const publicReadTables = new Set(["routes", "buses", "reviews", "app_config"]);
