import mongoose, { Schema } from "mongoose";
const schema = new Schema(
  {
    link: { type: String, required: true, maxlength: 2048 },
    type: {
      type: String,
      enum: ["image", "video", "article", "audio"],
      required: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    tags: [{ type: Schema.Types.ObjectId, ref: "Tag" }],
    rag: {
      indexedAt: { type: Date },
      model: { type: String },
      sourceType: { type: String, enum: ["page", "pasted"] },
      chunks: [
        {
          text: { type: String, required: true },
          embedding: { type: [Number], required: true },
          _id: false,
        },
      ],
    },
    folderId: { type: Schema.Types.ObjectId, ref: "Folder", default: null },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  { timestamps: true },
);
schema.index({ userId: 1, createdAt: -1 });
schema.index({ userId: 1, folderId: 1 });
export const Content = mongoose.model("Content", schema);
