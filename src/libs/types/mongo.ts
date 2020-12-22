import { IUser, IUserDoc } from "../../models/types/user";
import {IClip, IVideoComment, IVideoCommentDoc, IVideoDoc, IVideoLikesDoc} from "../../models/types/video";

export interface IMongoConfigOptions {
    ipAddr?: string;
    port?: string;
    username?: string;
    password?: string;
}

export interface IMongo {
    close(): void;
    findUserByUsername(username: string): Promise<IUserDoc[]>;
    findUserById(userId: string): Promise<IUserDoc | null>;
    createUser(user: IUser): Promise<IUserDoc>;
    updateUser(user: IUserDoc): Promise<IUserDoc>;
    findVideosByUserId(userId: string, page: number): Promise<IVideoDoc[]>;
    findVideosByIds(ids: string[]): Promise<IVideoDoc[]>;
    createVideoLike(videoId: string, userId: string): Promise<IVideoLikesDoc | null>;
    findVideoLikeById(videoId: string, userId: string): Promise<IVideoLikesDoc | null>;
    removeVideoLike(videoId: string, userId: string): Promise<IVideoLikesDoc | null>;
    getVideoLikes(videoId: string): Promise<number>;
    updateVideo(video: IVideoDoc): Promise<IVideoDoc>;
    findUserVideoById(videoId: string): Promise<IVideoDoc | null>;
    removeVideo(videoId: string, userId: string): Promise<void>;
    findClipById(clipId: string): Promise<IClip | null>;
    addVideoComment(videoDoc: IVideoDoc, comment: IVideoComment): Promise<IVideoCommentDoc>;
    findVideoCommentById(videoId: string, commentId: string): Promise<IVideoComment | null>;
    findVideoCommentsByIdV2(videoId: string, lastCommentId?: string): Promise<IVideoComment[] | null>;
    findVideoCommentsById(videoId: string, page: number): Promise<IVideoComment[] | null>;
    updateVideoComment(comment: IVideoComment): Promise<IVideoComment | null>;
    removeVideoComment(videoId: string, commentId: string, userId: string): Promise<void>;
}