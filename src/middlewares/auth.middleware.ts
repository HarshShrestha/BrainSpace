import jwt from 'jsonwebtoken';
import type { RequestHandler } from 'express';
import { User } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

declare global { namespace Express { interface Request { userId?: string } } }
export const verifyJWT: RequestHandler = asyncHandler(async (req, _res, next) => {
  const token = req.cookies?.accessToken || req.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) throw new ApiError(401, 'Please sign in');
  let id: string;
  try {
    const secret = process.env.ACCESS_TOKEN_SECRET;
    if (!secret || secret.length < 32) throw new Error('Invalid token configuration');
    const payload = jwt.verify(token, secret);
    if (typeof payload === 'string' || typeof payload._id !== 'string') throw new Error('Invalid payload');
    id = payload._id;
  } catch { throw new ApiError(401, 'Invalid or expired session'); }
  if (!await User.exists({ _id: id })) throw new ApiError(401, 'Invalid or expired session');
  req.userId = id;
  next();
});
