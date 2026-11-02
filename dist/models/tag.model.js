import mongoose, { Schema } from "mongoose";
const tagSchema = new Schema({
    title: {
        type: String,
        unique: true,
        required: true
    }
});
export const Tag = mongoose.model("Tag", tagSchema);
