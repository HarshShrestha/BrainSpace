import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt, { type JwtPayload } from "jsonwebtoken";
import type{ Request, Response, NextFunction } from "express";

// Extend Express Request interface
declare global {
    namespace Express {
        interface Request {
            user?: any;
        }
    }
}

interface AccessTokenPayload extends JwtPayload {
    _id: string;
}

export const verifyJWT = asyncHandler(
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            // Access the token
            const token =
                req.cookies?.accessToken ||
                req.header("Authorization")?.replace("Bearer ", "");

            // If token doesn't exist
            if (!token) {
                throw new ApiError(401, "Unauthorized request");
            }

            // Verify and decode the token
            const decodedToken = jwt.verify(
                token,
                process.env.ACCESS_TOKEN_SECRET as string
            ) as AccessTokenPayload;

            // Extract user ID and find user in database
            const user = await User.findById(decodedToken?._id)
                .select("-password -refreshToken");

            // If user doesn't exist
            if (!user) {
                throw new ApiError(401, "Invalid Access Token");
            }

            // Attach user to request object
            req.user = user;

            next();

        } catch (error: any) {
            throw new ApiError(
                401,
                error?.message || "Invalid access token"
            );
        }
    }
);