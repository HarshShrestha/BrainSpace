import mongoose from "mongoose";
import { z } from "zod";
import { Folder } from "../models/folder.model.js";
import { Content } from "../models/content.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
export const list = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await Folder.find({ userId: req.userId! }).sort({ name: 1 }).lean(),
  });
});
export const create = asyncHandler(async (req, res) => {
  const { name } = z
    .object({ name: z.string().trim().min(1).max(100) })
    .parse(req.body);
  const folder = await Folder.create({ name, userId: req.userId! });
  res.status(201).json({ success: true, data: folder });
});
export const remove = asyncHandler(async (req, res) => {
  const id = String(req.params.id);
  if (!mongoose.isValidObjectId(id))
    throw new ApiError(400, "Invalid folder ID");
  const folder = await Folder.findOne({ _id: id, userId: req.userId! });
  if (!folder) throw new ApiError(404, "Folder not found");
  if (await Content.exists({ userId: req.userId!, folderId: id }))
    throw new ApiError(409, "Move all items out before deleting this folder");
  await Folder.deleteOne({ _id: id, userId: req.userId! });
  res.json({ success: true, data: null });
});
