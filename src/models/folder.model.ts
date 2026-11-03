import mongoose, { Schema } from "mongoose";
const schema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  { timestamps: true },
);
schema.index({ userId: 1, name: 1 }, { unique: true });
export const Folder = mongoose.model("Folder", schema);
