import crypto from "node:crypto";
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Profile from "../models/Profile.js";
import UserRole from "../models/UserRole.js";
import { requireAuth } from "../middleware/auth.js";
import EmailVerificationCode from "../models/EmailVerificationCode.js";
import { makeVerificationCode, hashVerificationCode, sendVerificationEmail } from "../lib/email.js";

const googleStates = new Map();

const router = express.Router();

function sign(user) {
  return jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: "30d" });
}

// Builds the { user, session }-shaped payload the frontend client expects,
// including the profile + role since the app reads those right after auth.
async function buildAuthPayload(user) {
  const [profile, roleDoc] = await Promise.all([
    Profile.findOne({ id: user.id }).lean(),
    UserRole.findOne({ user_id: user.id }).lean(),
  ]);
  return {
    token: sign(user),
    user: { id: user.id, email: user.email, user_metadata: profile ? { full_name: profile.full_name } : {} },
    profile: profile ? { ...profile, _id: undefined, __v: undefined } : null,
    role: roleDoc?.role || null,
  };
}


router.get("/google", (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return res.status(503).json({ message: "Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend/.env." });
  const state = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  googleStates.set(state, Date.now() + 10 * 60 * 1000);
  const callback = process.env.GOOGLE_CALLBACK_URL || `${req.protocol}://${req.get("host")}/api/auth/google/callback`;
  const params = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, redirect_uri: callback, response_type: "code", scope: "openid email profile", state, access_type: "offline", prompt: "select_account" });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

router.get("/google/callback", async (req, res) => {
  try {
    const { code, state } = req.query;
    const expires = googleStates.get(state);
    googleStates.delete(state);
    if (!code || !state || !expires || expires < Date.now()) return res.status(400).send("Invalid or expired Google OAuth state.");
    const callback = process.env.GOOGLE_CALLBACK_URL || `${req.protocol}://${req.get("host")}/api/auth/google/callback`;
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code: String(code), client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, redirect_uri: callback, grant_type: "authorization_code" }) });
    const tokens = await tokenRes.json();
    if (!tokenRes.ok || !tokens.access_token) return res.status(401).send("Google token exchange failed.");
    const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { Authorization: `Bearer ${tokens.access_token}` } });
    const profile = await profileRes.json();
    if (!profileRes.ok || !profile.email) return res.status(401).send("Google profile lookup failed.");
    let user = await User.findOne({ email: profile.email.toLowerCase() });
    if (!user) {
      user = await User.create({ email: profile.email.toLowerCase(), password: await bcrypt.hash(`${crypto.randomUUID()}-${Date.now()}`, 10), email_verified: true, email_verified_at: new Date() });
      await Profile.create({ id: user.id, full_name: profile.name || profile.email.split("@")[0], avatar_url: profile.picture || null });
      await UserRole.create({ user_id: user.id, role: "student" });
    } else {
      await Profile.updateOne({ id: user.id }, { $set: { avatar_url: profile.picture || null, full_name: profile.name || undefined } });
    }
    const token = sign(user);
    const frontend = process.env.FRONTEND_URL || process.env.CLIENT_URL || "http://localhost:5173";
    res.redirect(`${frontend}/auth/callback#token=${encodeURIComponent(token)}`);
  } catch (err) { res.status(500).send(`Google sign-in failed: ${err.message}`); }
});

// POST /api/auth/signup
router.post("/signup", async (req, res) => {
  try {
    const { email, password, full_name, role, id_number, department, phone_number } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedEmail || !password || !full_name || !role) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return res.status(400).json({ message: "Enter a valid email address" });
    if (String(password).length < 8) return res.status(400).json({ message: "Password must be at least 8 characters" });
    if (!["student", "teacher", "driver"].includes(role)) return res.status(400).json({ message: "Invalid account role" });

    let user = await User.findOne({ email: normalizedEmail });
    if (user?.email_verified) return res.status(409).json({ message: "An account with this email already exists" });

    if (!user) {
      const hash = await bcrypt.hash(password, 10);
      user = await User.create({ email: normalizedEmail, password: hash, email_verified: false });
      await Profile.create({ id: user.id, full_name, id_number, department, phone_number });
      await UserRole.create({ user_id: user.id, role });
    } else {
      user.password = await bcrypt.hash(password, 10);
      await user.save();
      await Profile.updateOne({ id: user.id }, { $set: { full_name, id_number, department, phone_number } }, { upsert: true });
      await UserRole.updateOne({ user_id: user.id }, { $set: { role } }, { upsert: true });
    }

    const code = makeVerificationCode();
    await EmailVerificationCode.deleteMany({ user_id: user.id, used: false });
    await EmailVerificationCode.create({ user_id: user.id, email: normalizedEmail, code_hash: hashVerificationCode(code), expires_at: new Date(Date.now() + 10 * 60 * 1000) });
    const delivery = await sendVerificationEmail({ to: normalizedEmail, name: full_name, code });

    return res.status(201).json({
      verification_required: true,
      email: normalizedEmail,
      message: "Account created. Check your email for the 6-digit verification code.",
      ...(delivery.developmentCode ? { development_code: delivery.developmentCode } : {}),
    });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ message: err.message });
  }
});

router.post("/verify-email", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const code = String(req.body?.code || "").trim();
    if (!email || !/^\d{6}$/.test(code)) return res.status(400).json({ message: "Enter the 6-digit verification code" });
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "Account not found" });
    if (user.email_verified) return res.json(await buildAuthPayload(user));

    const record = await EmailVerificationCode.findOne({ user_id: user.id, email, used: false }).sort({ created_at: -1 });
    if (!record) return res.status(400).json({ message: "Verification code expired. Request a new code." });
    if (record.expires_at.getTime() < Date.now()) return res.status(400).json({ message: "Verification code expired. Request a new code." });
    if (record.attempts >= 5) return res.status(429).json({ message: "Too many attempts. Request a new code." });

    record.attempts += 1;
    if (record.code_hash !== hashVerificationCode(code)) {
      await record.save();
      return res.status(400).json({ message: "Incorrect verification code", attempts_left: Math.max(0, 5 - record.attempts) });
    }

    record.used = true;
    await record.save();
    user.email_verified = true;
    user.email_verified_at = new Date();
    await user.save();
    return res.json(await buildAuthPayload(user));
  } catch (err) {
    console.error("Email verification error:", err);
    res.status(500).json({ message: err.message });
  }
});

router.post("/resend-verification", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!email) return res.status(400).json({ message: "Email is required" });
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "Account not found" });
    if (user.email_verified) return res.json({ message: "Email is already verified" });

    const recent = await EmailVerificationCode.findOne({ user_id: user.id, created_at: { $gt: new Date(Date.now() - 60 * 1000) } });
    if (recent) return res.status(429).json({ message: "Please wait 60 seconds before requesting another code" });

    const profile = await Profile.findOne({ id: user.id }).lean();
    const code = makeVerificationCode();
    await EmailVerificationCode.deleteMany({ user_id: user.id, used: false });
    await EmailVerificationCode.create({ user_id: user.id, email, code_hash: hashVerificationCode(code), expires_at: new Date(Date.now() + 10 * 60 * 1000) });
    const delivery = await sendVerificationEmail({ to: email, name: profile?.full_name, code });
    return res.json({ message: "A new verification code has been sent", ...(delivery.developmentCode ? { development_code: delivery.developmentCode } : {}) });
  } catch (err) {
    console.error("Resend verification error:", err);
    res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Missing credentials" });
    const user = await User.findOne({ email: String(email).toLowerCase() });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });
    if (!user.email_verified) return res.status(403).json({ message: "Please verify your email before logging in", code: "EMAIL_NOT_VERIFIED", email: user.email });
    res.json(await buildAuthPayload(user));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/auth/session
router.get("/session", requireAuth, async (req, res) => {
  const user = await User.findOne({ id: req.user.id });
  if (!user) return res.status(401).json({ message: "Invalid session" });
  if (!user.email_verified) return res.status(403).json({ message: "Email verification required", code: "EMAIL_NOT_VERIFIED", email: user.email });
  res.json(await buildAuthPayload(user));
});

export default router;
