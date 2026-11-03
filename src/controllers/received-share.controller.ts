import { createHash } from "node:crypto";
import mongoose from "mongoose";
import { z } from "zod";
import { Link } from "../models/link.model.js";
import { ReceivedShare } from "../models/received-share.model.js";
import { User } from "../models/user.model.js";
import { listContent } from "../services/content.service.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
const digest = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export const save = asyncHandler(async (req, res) => {
  const { url } = z
    .object({ url: z.string().trim().max(2048) })
    .parse(req.body);
  let token: string;
  try {
    const parsed = new URL(url);
    if (!["https:", "http:"].includes(parsed.protocol)) throw new Error();
    const match = parsed.pathname.match(/^\/shared\/([A-Za-z0-9_-]{43})\/?$/);
    if (
      !match ||
      parsed.search ||
      parsed.hash ||
      parsed.username ||
      parsed.password
    )
      throw new Error();
    token = match[1]!;
  } catch {
    throw new ApiError(400, "Enter a valid BrainSpace share link");
  }
  const hash = digest(token);
  const link = await Link.findOne({ hash }).lean();
  if (!link) throw new ApiError(404, "Shared space not found or revoked");
  if (link.userId.toString() === req.userId)
    throw new ApiError(400, "You cannot add your own shared space");
  const key = { userId: req.userId!, shareHash: hash };
  const existing = await ReceivedShare.findOne(key).lean();
  if (existing) {
    res.json({ success: true, data: { id: existing._id } });
    return;
  }
  try {
    const saved = await ReceivedShare.create(key);
    res.status(201).json({ success: true, data: { id: saved._id } });
  } catch (err) {
    // A concurrent request saved the same link first.
    if ((err as { code?: number }).code !== 11000) throw err;
    const raced = await ReceivedShare.findOne(key).lean();
    res.json({ success: true, data: { id: raced!._id } });
  }
});
export const list = asyncHandler(async (req, res) => {
  const saved = await ReceivedShare.find({ userId: req.userId! })
    .sort({ createdAt: -1 })
    .lean();
  const links = await Link.find({
    hash: { $in: saved.map((s) => s.shareHash) },
  }).lean();
  const users = await User.find({ _id: { $in: links.map((l) => l.userId) } })
    .select("username")
    .lean();
  const entries = saved.map((entry) => {
    const link = links.find((l) => l.hash === entry.shareHash);
    const user =
      link && users.find((u) => u._id.toString() === link.userId.toString());
    return {
      id: entry._id,
      username: user?.username || null,
      available: Boolean(user),
      createdAt: entry.createdAt,
    };
  });
  res.json({ success: true, data: entries });
});
export const view = asyncHandler(async (req, res) => {
  const id = String(req.params.id);
  if (!mongoose.isValidObjectId(id))
    throw new ApiError(400, "Invalid shared space ID");
  const saved = await ReceivedShare.findOne({
    _id: id,
    userId: req.userId!,
  }).lean();
  if (!saved) throw new ApiError(404, "Shared space not found");
  const link = await Link.findOne({ hash: saved.shareHash }).lean();
  if (!link) throw new ApiError(404, "This shared space was revoked");
  const owner = await User.findById(link.userId).select("username").lean();
  if (!owner) throw new ApiError(404, "Shared space not found");
  const items = await listContent(link.userId.toString());
  res.json({
    success: true,
    data: {
      username: owner.username,
      content: items.map(
        ({ title, link: url, type, tags, createdAt, _id }) => ({
          _id,
          title,
          link: url,
          type,
          tags,
          createdAt,
        }),
      ),
    },
  });
});
export const remove = asyncHandler(async (req, res) => {
  const id = String(req.params.id);
  if (!mongoose.isValidObjectId(id))
    throw new ApiError(400, "Invalid shared space ID");
  if (
    !(await ReceivedShare.deleteOne({ _id: id, userId: req.userId! }))
      .deletedCount
  )
    throw new ApiError(404, "Shared space not found");
  res.json({ success: true, data: null });
});
