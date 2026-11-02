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
export const Content = mongoose.model("Content", schema);
