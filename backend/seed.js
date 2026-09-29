// Seeds the 5 routes / 10 buses this app is built around, plus one admin
// account (from ADMIN_EMAIL/ADMIN_PASSWORD in .env) so the hidden admin
// login on the Login page has something real to authenticate against.
//
// Run with: npm run seed  (after MONGODB_URI is set in backend/.env)
import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import Route from "./models/Route.js";
import Bus from "./models/Bus.js";
import User from "./models/User.js";
import Profile from "./models/Profile.js";
import UserRole from "./models/UserRole.js";
import crypto from "node:crypto";

dotenv.config();

const routesData = [
  { name: "Gobindaganj", description: "Gobindaganj → Fashitola → Mokamtola → Mohasthan → PUB Campus", stops: [
    { name: "Gobindaganj", position: { lat: 25.1449, lng: 89.3781 } },
    { name: "Fashitola", position: { lat: 25.0532, lng: 89.3712 } },
    { name: "Mokamtola", position: { lat: 24.9744, lng: 89.3661 } },
    { name: "Mohasthan", position: { lat: 24.9646, lng: 89.34 } },
    { name: "PUB Campus", position: { lat: 24.9223067, lng: 89.3490259 } },
  ] },
  { name: "Sherpur", description: "Sherpur → Inner Road → Sathmatha → Rail Gate → PUB Campus", stops: [
    { name: "Sherpur", position: { lat: 24.6684, lng: 89.4183 } },
    { name: "Inner Road", position: { lat: 24.7601, lng: 89.4004 } },
    { name: "Sathmatha", position: { lat: 24.8482, lng: 89.372 } },
    { name: "Rail Gate", position: { lat: 24.8523, lng: 89.3705 } },
    { name: "PUB Campus", position: { lat: 24.9223067, lng: 89.3490259 } },
  ] },
  { name: "Gabtoli", description: "Gabtoli → Sukhanpukur → Mohasthan Bazar → PUB Campus", stops: [
    { name: "Gabtoli", position: { lat: 24.907, lng: 89.2758 } },
    { name: "Sukhanpukur", position: { lat: 24.9256, lng: 89.3053 } },
    { name: "Mohasthan Bazar", position: { lat: 24.9598, lng: 89.3358 } },
    { name: "PUB Campus", position: { lat: 24.9223067, lng: 89.3490259 } },
  ] },
  { name: "Sathmatha/Bogura", description: "Sathmatha → Town Hall → College Road → Charmatha → PUB Campus", stops: [
    { name: "Sathmatha (Bogura)", position: { lat: 24.8482, lng: 89.372 } },
    { name: "Town Hall", position: { lat: 24.8535, lng: 89.3701 } },
    { name: "College Road", position: { lat: 24.8641, lng: 89.3652 } },
    { name: "Charmatha", position: { lat: 24.8815, lng: 89.3585 } },
    { name: "PUB Campus", position: { lat: 24.9223067, lng: 89.3490259 } },
  ] },
  { name: "Dupchachia", description: "Dupchachia → Market Area → Bus Stand → Kahaloo → PUB Campus", stops: [
    { name: "Dupchachia", position: { lat: 24.9192, lng: 89.07 } },
    { name: "Market Area", position: { lat: 24.9207, lng: 89.0741 } },
    { name: "Bus Stand", position: { lat: 24.9179, lng: 89.1503 } },
    { name: "Kahaloo", position: { lat: 24.8901, lng: 89.2333 } },
    { name: "PUB Campus", position: { lat: 24.9223067, lng: 89.3490259 } },
  ] },
];

async function run() {
  if (!process.env.MONGODB_URI) {
    console.error("Set MONGODB_URI in backend/.env before seeding.");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected. Seeding...");

  const routeDocs = {};
  for (const r of routesData) {
    const existing = await Route.findOne({ name: r.name });
    routeDocs[r.name] = existing ? (await Route.findOneAndUpdate({ id: existing.id }, { $set: { description: r.description, stops: r.stops } }, { new: true })) : (await Route.create(r));
  }

  const busPlan = [
    ["01", "Gobindaganj", true],
    ["02", "Gobindaganj", false],
    ["03", "Gobindaganj", false],
    ["04", "Sherpur", false],
    ["05", "Sherpur", false],
    ["06", "Gabtoli", false],
    ["07", "Sathmatha/Bogura", false],
    ["08", "Dupchachia", false],
    ["09", "Gabtoli", false],
    ["10", "Dupchachia", false],
  ];

  for (const [num, routeName] of busPlan) {
    const busNumber = `PUB-${num}`;
    const existing = await Bus.findOne({ bus_number: busNumber }).select("+gps_device_token");
    const deviceId = `GPS-${busNumber}`;
    const envKey = `GPS_DEVICE_TOKEN_PUB_${num}`;
    const deviceToken = process.env[envKey] || crypto.randomBytes(18).toString("hex");
    if (!existing) {
      await Bus.create({
        bus_number: busNumber,
        current_route_id: routeDocs[routeName].id,
        gps_device_id: deviceId,
        gps_device_token: deviceToken,
        tracking_source: "sim-gps",
      });
      console.log(`Created bus ${busNumber} (${routeName})`);
      console.log(`  GPS device: ${deviceId}`);
      console.log(`  GPS token : ${deviceToken}`);
    } else if (!existing.gps_device_id || !existing.gps_device_token) {
      await Bus.updateOne({ id: existing.id }, { $set: { gps_device_id: existing.gps_device_id || deviceId, gps_device_token: existing.gps_device_token || deviceToken, tracking_source: "sim-gps" } });
      console.log(`Provisioned SIM GPS for ${busNumber}`);
      console.log(`  GPS device: ${existing.gps_device_id || deviceId}`);
      console.log(`  GPS token : ${existing.gps_device_token || deviceToken}`);
    }
  }

  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    const existingAdmin = await User.findOne({ email: process.env.ADMIN_EMAIL.toLowerCase() });
    if (!existingAdmin) {
      const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
      const admin = await User.create({ email: process.env.ADMIN_EMAIL.toLowerCase(), password: hash, email_verified: true, email_verified_at: new Date() });
      await Profile.create({ id: admin.id, full_name: "Admin" });
      await UserRole.create({ user_id: admin.id, role: "admin" });
      console.log(`Created admin account: ${process.env.ADMIN_EMAIL}`);
    } else {
      await User.updateOne({ id: existingAdmin.id }, { $set: { email_verified: true, email_verified_at: existingAdmin.email_verified_at || new Date() } });
      console.log("Admin account already exists, skipping.");
    }
  } else {
    console.log("ADMIN_EMAIL/ADMIN_PASSWORD not set in .env — skipping admin account creation.");
  }

  if (process.env.DRIVER_EMAIL && process.env.DRIVER_PASSWORD) {
    const email = process.env.DRIVER_EMAIL.toLowerCase();
    let driver = await User.findOne({ email });
    if (!driver) {
      driver = await User.create({ email, password: await bcrypt.hash(process.env.DRIVER_PASSWORD, 10), email_verified: true, email_verified_at: new Date() });
      await Profile.create({ id: driver.id, full_name: "PUB Driver", phone_number: process.env.DRIVER_PHONE || null });
      await UserRole.create({ user_id: driver.id, role: "driver" });
      console.log(`Created driver account: ${email}`);
    }
    const firstBus = await Bus.findOne({ bus_number: "PUB-01" });
    await User.updateOne({ id: driver.id }, { $set: { email_verified: true, email_verified_at: driver.email_verified_at || new Date() } });
    if (firstBus) await Bus.updateOne({ id: firstBus.id }, { $set: { driver_id: driver.id } });
  }

  console.log("Seed complete.");
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
