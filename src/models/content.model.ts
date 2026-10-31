import mongoose, { Schema, Types } from "mongoose";
import { User } from "./user.model.js";

const contentTypes = ["image", "video", "article", "audio"];

const contentSchema = new Schema({
    link: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: contentTypes,
        required: true
    },
    title: {
        type: String,
        required: true
    },
    tags: [{
        type: Types.ObjectId,
        ref: "Tag"
    }],
    userId: {
        type: Types.ObjectId,
        ref: "User",
        required: true
    }
}, { timestamps: true });

contentSchema.pre('save', async function () {
    const user = await User.findById(this.userId);

    if (!user) {
        throw new Error('User does not exist');
    }
});

export const Content = mongoose.model("Content", contentSchema);