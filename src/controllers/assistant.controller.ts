import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as assistant from "../services/rag/assistant.service.js";
export const getStatus = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await assistant.status(req.userId!) });
});
export const index = asyncHandler(async (req, res) => {
  const input = z
    .object({
      consent: z.literal(true),
      text: z.string().max(24000).optional(),
    })
    .parse(req.body);
  res.json({
    success: true,
    data: await assistant.indexItem(
      req.userId!,
      String(req.params.id),
      input.text,
    ),
  });
});
export const ask = asyncHandler(async (req, res) => {
  const { question } = z
    .object({ question: z.string().trim().min(3).max(1000) })
    .parse(req.body);
  res.json({ success: true, data: await assistant.ask(req.userId!, question) });
});

export const removeIndex = asyncHandler(async (req, res) => {
  await assistant.removeIndex(req.userId!, String(req.params.id));
  res.json({ success: true, data: null });
});
