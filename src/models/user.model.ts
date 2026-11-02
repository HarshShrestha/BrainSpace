
import mongoose, { Schema, type Model } from "mongoose";
import bcrypt from "bcrypt";
import jwt, { type SignOptions } from "jsonwebtoken";

// User properties
interface IUser {
    username: string;
    password: string;
    refreshToken : string;
}

// Custom user methods
interface IUserMethods {
    isPasswordCorrect(password: string): Promise<boolean>;
    generateAccessToken(): string;
    generateRefreshToken(): string;
}

type UserModel = Model<IUser, {}, IUserMethods>;

// Validate environment variables
const getEnv = (key: string): string => {
    const value = process.env[key];

    if (!value) {
        throw new Error(`Missing environment variable: ${key}`);
    }

    return value;
};

// JWT expiry helper
const getExpiry = (
    key: string
): NonNullable<SignOptions["expiresIn"]> => {
    const value = getEnv(key);

    return value as NonNullable<SignOptions["expiresIn"]>;
};

// User schema
const userSchema = new Schema<IUser, UserModel, IUserMethods>(
    {
        username: {
            type: String,
            unique: true,
            trim: true,
            required: true
        },
        password: {
            type: String,
            required: true
        },
        refreshToken : {
            type : String
        }
    },
    { timestamps: true }
);

// Hash password before saving
userSchema.pre("save", async function () {
    if (!this.isModified("password")) return;

    this.password = await bcrypt.hash(this.password, 10);
});

// Compare password
userSchema.methods.isPasswordCorrect = async function (
    password: string
): Promise<boolean> {
    return bcrypt.compare(password, this.password);
};

// Generate access token
userSchema.methods.generateAccessToken = function (): string {
    return jwt.sign(
        {
            _id: this._id.toString(),
            username: this.username
        },
        getEnv("ACCESS_TOKEN_SECRET"),
        {
            expiresIn: getExpiry("ACCESS_TOKEN_EXPIRY")
        }
    );
};

// Generate refresh token
userSchema.methods.generateRefreshToken = function (): string {
    return jwt.sign(
        {
            _id: this._id.toString()
        },
        getEnv("REFRESH_TOKEN_SECRET"),
        {
            expiresIn: getExpiry("REFRESH_TOKEN_EXPIRY")
        }
    );
};

// Export User model
export const User = mongoose.model<IUser, UserModel>(
    "User",
    userSchema
);
