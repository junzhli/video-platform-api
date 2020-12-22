import { Document, Types } from "mongoose";

/** Video comment */
export interface IVideoCommentDoc extends IVideoComment, Document {}

export interface IVideoComment {
    _id?: any;
    parentId?: string;
    content: string;
    edit?: boolean;
    created_timestamp?: Date;
    updated_timestamp?: Date;
    userId: UserID;
    videoId: VideoID;
    likes?: number;
    top_replies?: IVideoCommentDoc[];
}

/** Clip */
export const DEFINITIONS = ["HD", "SD", "FullHD"] as const;

export interface IClipDoc extends IClip, Document {}

export interface IClip {
    _id?: any;
    object: string;
    definition: typeof DEFINITIONS[number];
    thumbnails?: string[];
}

/** Temp Clip */
export const STATES = ["Initial", "Queued", "Processing", "Finished", "Failed"] as const;

export interface ITempClipDoc extends ITempClip, Document {}

export interface ITempClip {
    object: string;
    uploaded_timestamp: Date;
    ownerId: UserID;
    videoId?: VideoID;
    state: typeof STATES[number];
}

/** Video likes */
export interface IVideoLikesDoc extends IVideoLikes, Document {}

export interface IVideoLikes {
    videoId: VideoID;
    userId: UserID;
    created_timestamp: Date;
}

/** Video */
export const TAGS = ["FUN", "EDUCATION", "POLITIC"] as const;
export type Tag = typeof TAGS[number];

export interface IVideoDoc extends IVideo, Document {}


type UserID = Types.ObjectId;
type VideoID = Types.ObjectId;

export interface IVideo {
    _id?: any;
    owner: UserID;
    title: string;
    created_timestamp: Date;
    updated_timestamp: Date;
    clips?: IClip[];
    duration?: number;
    available: boolean;
    views?: number;
    likes?: number;
    isPublic?: boolean;
    tags: Tag[];
    comments?: number;
    top_comments?: IVideoComment[];
}