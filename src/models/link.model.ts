import mongoose, { Schema } from 'mongoose';
// Only a SHA-256 digest of the random bearer token is stored.
const schema = new Schema({
  hash: { type: String, required: true, unique: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
}, { timestamps: true });
export const Link = mongoose.model('Link', schema);
