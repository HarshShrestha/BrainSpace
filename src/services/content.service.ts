import { Content } from '../models/content.model.js';
import { Tag } from '../models/tag.model.js';
import { ApiError } from '../utils/ApiError.js';
import mongoose from 'mongoose';

export async function listContent(userId: string) {
  return Content.find({ userId }).populate('tags', 'title').sort({ createdAt: -1 }).lean();
}
export async function addContent(userId: string, data: { title: string; link: string; type: 'image'|'video'|'article'|'audio'; tags: string[] }) {
  const tags = await Promise.all([...new Set(data.tags)].map(title =>
    Tag.findOneAndUpdate({ title }, { $setOnInsert: { title } }, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true })));
  const content = await Content.create({ ...data, tags: tags.map(tag => tag._id), userId });
  return content.populate('tags', 'title');
}
export async function removeContent(userId: string, id: string) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(400, 'Invalid content ID');
  const deleted = await Content.findOneAndDelete({ _id: id, userId });
  if (!deleted) throw new ApiError(404, 'Content not found');
}
