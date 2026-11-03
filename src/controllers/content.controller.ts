import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as content from "../services/content.service.js";
const input = z.object({
  title: z.string().trim().min(1).max(200),
  link: z
    .string()
    .url()
    .max(2048)
    .refine((value) => {
      try {
        return ["http:", "https:"].includes(new URL(value).protocol);
      } catch {
        return false;
      }
    }, "Only HTTP and HTTPS links are allowed"),
  type: z.enum(["image", "video", "article", "audio"]),
  tags: z
    .array(z.string().trim().toLowerCase().min(1).max(40))
    .max(20)
    .default([]),
});
export const list = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await content.listContent(req.userId!) });
});
export const create = asyncHandler(async (req, res) => {
  res.status(201).json({
    success: true,
    data: await content.addContent(req.userId!, input.parse(req.body)),
  });
});
export const remove = asyncHandler(async (req, res) => {
  await content.removeContent(req.userId!, String(req.params.id));
  res.json({ success: true, data: null });
});

export const move = asyncHandler(async (req, res) => {
  const { folderId } = z
    .object({ folderId: z.string().nullable() })
    .parse(req.body);
  res.json({
    success: true,
    data: await content.moveContent(
      req.userId!,
      String(req.params.id),
      folderId,
    ),
  });
});
