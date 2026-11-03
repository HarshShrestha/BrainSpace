import mongoose from "mongoose";
import { z } from "zod";
import { Content } from "../../models/content.model.js";
import { ApiError } from "../../utils/ApiError.js";
import { fetchPublicText } from "./extraction.js";
import {
  chunkText,
  retrieve,
  validateEvidence,
  type Candidate,
} from "./retrieval.js";
import { embed, generate, verify, ragConfiguration } from "./provider.js";
const abstention = {
  answer:
    "I couldn’t find enough reliable evidence in your indexed sources to answer that. Try another question or index a relevant source.",
  sources: [],
  abstained: true,
};
const responseSchema = z.object({
  answer: z.string().trim().max(5000),
  evidence: z
    .array(z.object({ id: z.string(), quote: z.string().max(1500) }))
    .max(5),
});
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
  const { embeddingModel } = ragConfiguration();
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
  const text = pasted?.trim() || (await fetchPublicText(item.link));
  if (text.trim().length < 80)
    throw new ApiError(
      422,
      "Not enough readable text. Paste at least 80 characters from the source.",
    );
  const chunks = chunkText(text.slice(0, 24000));
  const embeddings = await embed(chunks);
  const updated = await Content.findOneAndUpdate(
    { _id: id, userId },
    {
      $set: {
        rag: {
          indexedAt: new Date(),
          model: embeddingModel,
          sourceType: pasted?.trim() ? "pasted" : "page",
          chunks: chunks.map((part, i) => ({
            text: part,
            embedding: embeddings[i],
          })),
        },
      },
    },
    { returnDocument: "after", projection: { "rag.chunks": 0 } },
  );
  if (!updated) throw new ApiError(404, "Content no longer exists");
  return {
    indexedAt: updated.rag?.indexedAt,
    sourceType: updated.rag?.sourceType,
    chunks: chunks.length,
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
  const { embeddingModel } = ragConfiguration();
  const documents = await Content.find({
    userId,
    "rag.indexedAt": { $exists: true },
    "rag.model": embeddingModel,
  })
    .select("title link rag")
    .lean();
  if (!documents.length) return abstention;
  if (documents.length > 250)
    throw new ApiError(
      400,
      "Too many indexed sources; remove or reconfigure the index before searching.",
    );
  const candidates: Candidate[] = [];
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
  const [vector] = await embed([question]);
  const selected = retrieve(vector!, candidates);
  if (!selected.length) return abstention;
  const raw = await generate(question, selected);
  const parsed = responseSchema.safeParse(raw);
  if (
    !parsed.success ||
    !parsed.data.answer ||
    !validateEvidence(parsed.data.evidence, selected)
  )
    return abstention;
  const quotes = parsed.data.evidence.map((e) => e.quote);
  if (!(await verify(question, parsed.data.answer, quotes))) return abstention;
  const sources = parsed.data.evidence.map((e) => {
    const candidate = selected.find((c) => c.id === e.id)!;
    return {
      contentId: candidate.contentId,
      title: candidate.title,
      link: candidate.link,
      sourceType: candidate.sourceType,
      indexedAt: candidate.indexedAt,
      quote: e.quote,
    };
  });
  return { answer: parsed.data.answer, sources, abstained: false };
}
