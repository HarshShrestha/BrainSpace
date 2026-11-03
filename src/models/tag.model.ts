import mongoose, { Schema } from "mongoose";
// Tags are scoped to their owner so one account's tags never reveal or share another's.
const schema = new Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    maxlength: 40,
  },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
});
schema.index({ userId: 1, title: 1 }, { unique: true });
export const Tag = mongoose.model("Tag", schema);
