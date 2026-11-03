import mongoose, { Schema } from "mongoose";
// Store only the digest of a received bearer link, never the raw token.
const schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    shareHash: { type: String, required: true },
  },
  { timestamps: true },
);
schema.index({ userId: 1, shareHash: 1 }, { unique: true });
export const ReceivedShare = mongoose.model("ReceivedShare", schema);
