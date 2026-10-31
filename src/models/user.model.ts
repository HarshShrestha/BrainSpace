import mongoose, { Schema } from "mongoose"


const userSchema = new Schema({
    username : {
        type : String,
        unique: true,
        trim : true,
        required : true
    },
    password : {
        type : String,
        required : true
    }
},{timestamps : true})

export const User = mongoose.model("User", userSchema)