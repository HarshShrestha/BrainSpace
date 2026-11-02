import mongoose, { Schema, type Model } from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

export interface IUser { username: string; password: string; tokenVersion: number }
interface UserMethods { isPasswordCorrect(password: string): Promise<boolean>; generateAccessToken(): string }
type UserModel = Model<IUser, object, UserMethods>;
const schema = new Schema<IUser, UserModel, UserMethods>({
  username: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true, select: false },
  tokenVersion: { type: Number, required: true, default: 0, select: false },
}, { timestamps: true });
schema.pre('save', async function () { if (this.isModified('password')) this.password = await bcrypt.hash(this.password, 12); });
schema.methods.isPasswordCorrect = function (password: string) { return bcrypt.compare(password, this.password); };
schema.methods.generateAccessToken = function () {
  const secret = process.env.ACCESS_TOKEN_SECRET;
  if (!secret || secret.length < 32) throw new Error('ACCESS_TOKEN_SECRET must be at least 32 characters');
  return jwt.sign({ _id: this._id.toString(), sv: this.tokenVersion }, secret, { expiresIn: '7d' });
};
export const User = mongoose.model<IUser, UserModel>('User', schema);
