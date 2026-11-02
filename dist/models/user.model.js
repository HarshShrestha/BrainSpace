import mongoose, { Schema } from "mongoose";
import bcrypt from "bcrypt";
import jwt, {} from "jsonwebtoken";
// Validate environment variables
const getEnv = (key) => {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Missing environment variable: ${key}`);
    }
    return value;
};
// JWT expiry helper
const getExpiry = (key) => {
    const value = getEnv(key);
    return value;
};
// User schema
const userSchema = new Schema({
    username: {
        type: String,
        unique: true,
        trim: true,
        required: true
    },
    password: {
        type: String,
        required: true
    }
}, { timestamps: true });
// Hash password before saving
userSchema.pre("save", async function () {
    if (!this.isModified("password"))
        return;
    this.password = await bcrypt.hash(this.password, 10);
});
// Compare password
userSchema.methods.isPasswordCorrect = async function (password) {
    return bcrypt.compare(password, this.password);
};
// Generate access token
userSchema.methods.generateAccessToken = function () {
    return jwt.sign({
        _id: this._id.toString(),
        username: this.username
    }, getEnv("ACCESS_TOKEN_SECRET"), {
        expiresIn: getExpiry("ACCESS_TOKEN_EXPIRY")
    });
};
// Generate refresh token
userSchema.methods.generateRefreshToken = function () {
    return jwt.sign({
        _id: this._id.toString()
    }, getEnv("REFRESH_TOKEN_SECRET"), {
        expiresIn: getExpiry("REFRESH_TOKEN_EXPIRY")
    });
};
// Export User model
export const User = mongoose.model("User", userSchema);
