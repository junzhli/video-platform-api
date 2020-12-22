import {DEFINITIONS} from "../../models//types/video";
import { Tag } from "../../models/types/video";

interface IResponseBodyGenericMessageObjectId {
    objectId: string;
}

export type IResponseBodyUploadedVideo = IResponseBodyGenericMessageObjectId;
export type IResponseBodyUploadedTempClip = IResponseBodyGenericMessageObjectId;

export interface IResponseBodySearchUserPublicVideos {
    total: number;
    results: IResponseBodyUserVideos;
}
export type IResponseBodyUserVideos = IReponseBodyUserVideo[];

export interface IReponseBodyUserVideo {
    user: {
        fullname: string;
        avatar: string;
    };
    videoId: string;
    tags: Tag[];
    available: boolean;
    isPublic: boolean;
    title: string;
    time: number;
    likes: number;
    views: number;
    clips?: IResponseBodyClip[];
    thumbnail?: string;
    duration?: number;
}

export interface IResponseBodyClip {
    definition: typeof DEFINITIONS[number];
}

// TODO moreee details on comment for better readiblity
export type IResponseBodyComments = IResponseBodyComment[];

export interface IResponseBodyComment {
    id: any;
    userId: string;
    userFullname: string;
    userAvatar: string;
    content: string;
    edit: boolean;
    updated_timestamp: number;
}

export interface IResponseBodyUserPreVideoPlayback {
    tags: Tag[];
    title: string;
    time: number;
    playbacks: IResponseBodyClipPreVideoPlaybacks;
    duration: number;
    thumbnail?: string;
    isPublic?: boolean;
    likes: number;
    liked: boolean;
    views: number;
    comments: number;
    topComments?: IResponseBodyComment[];
}

export type IResponseBodyClipPreVideoPlaybacks = {
    [key in typeof DEFINITIONS[number]]?: IResponseBodyClipPreVideoPlayback;
};

export type IResponseBodyClipPreVideoPlayback = IResponseBodyGenericMessageObjectId;

export type IResponseBodyCreateVideoComment = IResponseBodyGenericMessageObjectId;