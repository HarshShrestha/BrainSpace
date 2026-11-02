import mongoose, { Schema } from 'mongoose';
const schema = new Schema({ title: { type: String, unique: true, required: true, trim: true, lowercase: true, maxlength: 40 } });
export const Tag = mongoose.model('Tag', schema);
