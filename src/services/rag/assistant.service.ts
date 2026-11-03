import mongoose from "mongoose";
import { Content } from "../../models/content.model.js";
import { ApiError } from "../../utils/ApiError.js";
import { runWorker } from "./worker.js";
import { cosine, TopK } from "./retrieval.js";

const abstention = {
  answer:
    "I couldn’t find enough reliable evidence in your indexed sources to answer that. Try another question or index a relevant source.",
  sources: [],
  abstained: true,
};
function embeddingModel() {
  if (process.env.RAG_ENABLED !== "true" || !process.env.GEMINI_API_KEY?.trim())
    throw new ApiError(
      503,
      "AI search is not configured. Ask the administrator to enable it.",
    );
  return process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
}
export async function status(userId: string) {
  const configured =
    process.env.RAG_ENABLED === "true" &&
    Boolean(process.env.GEMINI_API_KEY?.trim());
  const indexed = await Content.countDocuments({
    userId,
    "rag.indexedAt": { $exists: true },
  });
  const compatible = configured
    ? await Content.countDocuments({
        userId,
        "rag.indexedAt": { $exists: true },
        "rag.model":
          process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001",
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
type Candidate = {
  id: string;
  contentId: string;
  title: string;
  link: string;
  text: string;
  sourceType?: "page" | "pasted";
  indexedAt?: Date;
};
/** Embeds the question, then streams the user's chunks and keeps only the best matches. */
export async function retrieve(userId: string, question: string) {
  const model = embeddingModel();
  const filter = {
    userId,
    "rag.indexedAt": { $exists: true },
    "rag.model": model,
  };
  const total = await Content.countDocuments(filter);
  if (!total) return [];
  if (total > 250)
    throw new ApiError(
      400,
      "Too many indexed sources; remove or reconfigure the index before searching.",
    );
  const vector = await runWorker<number[]>("embed_query", { question });
  const best = new TopK<Omit<Candidate, "id">>();
  const cursor = Content.find(filter)
    .select("title link rag")
    .lean()
    .cursor({ batchSize: 10 });
  for await (const item of cursor)
    for (const chunk of item.rag?.chunks || [])
      best.offer(cosine(vector, chunk.embedding), {
        contentId: item._id.toString(),
        title: item.title,
        link: item.link,
        text: chunk.text,
        ...(item.rag?.sourceType ? { sourceType: item.rag.sourceType } : {}),
        ...(item.rag?.indexedAt ? { indexedAt: item.rag.indexedAt } : {}),
      });
  return best
    .results()
    .map((candidate, i): Candidate => ({ id: `S${i + 1}`, ...candidate }));
}
export async function ask(userId: string, question: string) {
  const candidates = await retrieve(userId, question);
  if (!candidates.length) return abstention;
  return runWorker("answer", { question, candidates });
}
