import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import type { Request, RequestHandler } from "express";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}
/** Returns the user ID for a valid, unrevoked session token, or null. */
export async function sessionUserId(req: Request): Promise<string | null> {
  const token =
    req.cookies?.accessToken ||
    req.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return null;
  const secret = process.env.ACCESS_TOKEN_SECRET;
  if (!secret || secret.length < 32) return null;
  let payload: string | jwt.JwtPayload;
  try {
    payload = jwt.verify(token, secret);
  } catch {
    return null;
  }
  if (
    typeof payload === "string" ||
    typeof payload._id !== "string" ||
    !mongoose.isObjectIdOrHexString(payload._id) ||
    typeof payload.sv !== "number"
  )
    return null;
  const user = await User.findById(payload._id).select("+tokenVersion");
  return user && user.tokenVersion === payload.sv ? payload._id : null;
}
export const verifyJWT: RequestHandler = asyncHandler(
  async (req, _res, next) => {
    const hasToken = Boolean(
      req.cookies?.accessToken ||
        /^Bearer .+$/i.test(req.get("authorization") || ""),
    );
    const id = await sessionUserId(req);
    if (!id)
      throw new ApiError(
        401,
        hasToken ? "Invalid or expired session" : "Please sign in",
      );
    req.userId = id;
    next();
  },
);
