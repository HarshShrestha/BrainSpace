import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt, {} from "jsonwebtoken";
export const verifyJWT = asyncHandler(async (req, res, next) => {
    try {
        // Access the token
        const token = req.cookies?.accessToken ||
            req.header("Authorization")?.replace("Bearer ", "");
        // If token doesn't exist
        if (!token) {
            throw new ApiError(401, "Unauthorized request");
        }
        // Verify and decode the token
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
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
    }
    catch (error) {
        throw new ApiError(401, error?.message || "Invalid access token");
    }
});
