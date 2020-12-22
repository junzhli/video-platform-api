import mongoose, { model } from "mongoose";
import { IUser, IUserDoc } from "./types/user";

const Schema = mongoose.Schema;

const UserSchemaFields: Record<keyof IUser, any> = {
    username: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    lastname: {
        type: String,
    },
    firstname: {
        type: String,
    },
    avatar: {
        type: String,
    },
    authMethod: [{
        type: String,
        required: true,
    }]
};

const UserSchema = new Schema(UserSchemaFields);

const User = model<IUserDoc>("User", UserSchema);

/** Redis Keys */
const RedisKey = {
    UserId: (userId: string) => `user:object:${userId}:user.id`,
    UserFullName: (userId: string) => `user:object:${userId}:user.full.name`,
    UserAvatar: (userId: string) => `user:object:${userId}:user.avatar`,
};

export default {
    RedisKey
};

export {
    User,
};