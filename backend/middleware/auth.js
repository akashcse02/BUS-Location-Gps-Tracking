import jwt from "jsonwebtoken";
import UserRole from "../models/UserRole.js";

// Reads the Bearer token if present and attaches { id, email } to req.user.
// Does NOT reject the request if there's no token — routes decide for
// themselves whether auth is required (mirrors the mix of public/authenticated
// tables the original RLS policies had).
export function attachUser(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (token) {
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      req.user = null;
    }
  }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ message: "Not authenticated" });
  next();
}

// Must run after requireAuth. Looks up the caller's role and rejects
// anyone who isn't admin — used for the issues moderation endpoints.
export async function requireAdmin(req, res, next) {
  const roleDoc = await UserRole.findOne({ user_id: req.user.id }).lean();
  if (roleDoc?.role !== "admin") return res.status(403).json({ message: "Admin access required" });
  next();
}
