import { Content } from "../models/content.model.js";
import { Tag } from "../models/tag.model.js";
import { ApiError } from "../utils/ApiError.js";
import mongoose from "mongoose";
import { Folder } from "../models/folder.model.js";

export async function listContent(userId: string) {
  return Content.find({ userId })
    .select("-rag.chunks")
    .populate("tags", "title")
    .sort({ createdAt: -1 })
    .lean();
}
export async function addContent(
  userId: string,
  data: {
    title: string;
    link: string;
    type: "image" | "video" | "article" | "audio";
    tags: string[];
  },
) {
  const tags = await Promise.all(
    [...new Set(data.tags)].map((title) =>
      Tag.findOneAndUpdate(
        { userId, title },
        { $setOnInsert: { userId, title } },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
      ),
    ),
  );
  const content = await Content.create({
    ...data,
    tags: tags.map((tag) => tag._id),
    userId,
  });
  return content.populate("tags", "title");
}
export async function removeContent(userId: string, id: string) {
  if (!mongoose.isValidObjectId(id))
    throw new ApiError(400, "Invalid content ID");
  const deleted = await Content.findOneAndDelete({ _id: id, userId });
  if (!deleted) throw new ApiError(404, "Content not found");
}

export async function moveContent(
  userId: string,
  id: string,
  folderId: string | null,
) {
  if (
    !mongoose.isValidObjectId(id) ||
    (folderId !== null && !mongoose.isValidObjectId(folderId))
  )
    throw new ApiError(400, "Invalid content or folder ID");
  if (folderId && !(await Folder.exists({ _id: folderId, userId })))
    throw new ApiError(404, "Folder not found");
  const item = await Content.findOneAndUpdate(
    { _id: id, userId },
    { $set: { folderId } },
    { returnDocument: "after", projection: { "rag.chunks": 0 } },
  )
    .populate("tags", "title")
    .lean();
  if (!item) throw new ApiError(404, "Content not found");
  // The folder may have been deleted between the check above and the write.
  if (folderId && !(await Folder.exists({ _id: folderId, userId }))) {
    await Content.updateOne(
      { _id: id, userId, folderId },
      { $set: { folderId: null } },
    );
    throw new ApiError(404, "Folder not found");
  }
  return item;
}
