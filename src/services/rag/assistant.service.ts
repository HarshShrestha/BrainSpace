import mongoose from "mongoose";
import { Content } from "../../models/content.model.js";
import { ApiError } from "../../utils/ApiError.js";
import { runWorker } from "./worker.js";

const abstention = {
  answer:
    "I couldn’t find enough reliable evidence in your indexed sources to answer that. Try another question or index a relevant source.",
  sources: [],
  abstained: true,
};
function embeddingModel() {
  if (process.env.RAG_ENABLED !== "true" || !process.env.OPENAI_API_KEY?.trim())
    throw new ApiError(
      503,
      "AI search is not configured. Ask the administrator to enable it.",
    );
  return process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
}
export async function status(userId: string) {
  const configured =
    process.env.RAG_ENABLED === "true" &&
    Boolean(process.env.OPENAI_API_KEY?.trim());
  const indexed = await Content.countDocuments({
    userId,
    "rag.indexedAt": { $exists: true },
  });
  const compatible = configured
    ? await Content.countDocuments({
        userId,
        "rag.indexedAt": { $exists: true },
        "rag.model":
          process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
      })
    : 0;
  return { configured, indexed, compatible };
}
export async function indexItem(userId: string, id: string, pasted?: string) {
  embeddingModel();
  if (!mongoose.isValidObjectId(id))
    throw new ApiError(400, "Invalid content ID");
  const item = await Content.findOne({ _id: id, userId });
  if (!item) throw new ApiError(404, "Content not found");
  if (
    !item.rag?.indexedAt &&
    (await Content.countDocuments({
      userId,
      "rag.indexedAt": { $exists: true },
    })) >= 250
  )
    throw new ApiError(
      400,
      "The current index limit is 250 sources per account",
    );
  const result = await runWorker<{
    model: string;
    sourceType: "pasted" | "page";
    chunks: { text: string; embedding: number[] }[];
  }>("index", { link: item.link, text: pasted || "" });
  const indexedAt = new Date();
  const updated = await Content.findOneAndUpdate(
    { _id: id, userId },
    { $set: { rag: { ...result, indexedAt } } },
    { returnDocument: "after", projection: { "rag.chunks": 0 } },
  );
  if (!updated) throw new ApiError(404, "Content no longer exists");
  return {
    indexedAt,
    sourceType: result.sourceType,
    chunks: result.chunks.length,
  };
}
export async function removeIndex(userId: string, id: string) {
  if (!mongoose.isValidObjectId(id))
    throw new ApiError(400, "Invalid content ID");
  const result = await Content.updateOne(
    { _id: id, userId },
    { $unset: { rag: 1 } },
  );
  if (!result.matchedCount) throw new ApiError(404, "Content not found");
}
export async function ask(userId: string, question: string) {
  const model = embeddingModel();
  const documents = await Content.find({
    userId,
    "rag.indexedAt": { $exists: true },
    "rag.model": model,
  })
    .select("title link rag")
    .lean();
  if (!documents.length) return abstention;
  if (documents.length > 250)
    throw new ApiError(
      400,
      "Too many indexed sources; remove or reconfigure the index before searching.",
    );
  const candidates = [];
  for (const item of documents)
    for (const chunk of item.rag?.chunks || [])
      candidates.push({
        id: `S${candidates.length + 1}`,
        contentId: item._id.toString(),
        title: item.title,
        link: item.link,
        text: chunk.text,
        embedding: chunk.embedding,
        ...(item.rag?.sourceType ? { sourceType: item.rag.sourceType } : {}),
        ...(item.rag?.indexedAt ? { indexedAt: item.rag.indexedAt } : {}),
      });
  if (!candidates.length) return abstention;
  return runWorker("ask", { question, candidates });
}
