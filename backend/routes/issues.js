import express from "express";
import Issue from "../models/Issue.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = express.Router();

// POST /api/issues — any logged-in user (student/teacher/driver) reports an issue.
router.post("/", requireAuth, async (req, res) => {
  try {
    const { title, description, category } = req.body;
    if (!title) return res.status(400).json({ message: "Title is required" });

    const issue = await Issue.create({
      user_id: req.user.id,
      title,
      description: description || null,
      category: category || "general",
      status: "pending",
    });
    res.status(201).json(issue.toJSON());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/issues — admin only. Optional ?status=pending filter.
router.get("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const issues = await Issue.find(filter).sort({ created_at: -1 }).lean();
    res.json(issues.map((d) => { delete d._id; delete d.__v; return d; }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/issues/mine — the logged-in user's own reported issues.
router.get("/mine", requireAuth, async (req, res) => {
  try {
    const issues = await Issue.find({ user_id: req.user.id }).sort({ created_at: -1 }).lean();
    res.json(issues.map((d) => { delete d._id; delete d.__v; return d; }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/issues/:id — admin only. Update status (pending/investigating/resolved/closed).
router.patch("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const valid = ["pending", "investigating", "resolved", "closed"];
    if (!valid.includes(status)) return res.status(400).json({ message: `status must be one of: ${valid.join(", ")}` });

    const issue = await Issue.findOneAndUpdate({ id: req.params.id }, { $set: { status } }, { new: true }).lean();
    if (!issue) return res.status(404).json({ message: "Issue not found" });
    delete issue._id; delete issue.__v;
    res.json(issue);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/issues/:id — admin only.
router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    await Issue.deleteOne({ id: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
