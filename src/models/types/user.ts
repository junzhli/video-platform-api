import { Document } from "mongoose";

export type Auth = "local" | "google";

export interface IUserDoc extends IUser, Document {}

export interface IUser {
    username?: string;
    password?: string;
    email: string;
    lastname?: string;
    firstname?: string;
    avatar?: string;
    authMethod: Auth[];
}