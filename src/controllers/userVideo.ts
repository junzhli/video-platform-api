import express from "express";
import httpStatus from "http-status-codes";
import {ObjectId} from "mongodb";
import {Error, Types} from "mongoose";
import path from "path";
import {
    loadUserInfoInRedis,
    loadVideoLikesInRedis,
    loadVideoViewsInRedis, RECENT_VIDEOS, REDIS_KEY_RECENT_VIDEOS_LIST,
    updateVideoLikesInMongoOnDemand,
    updateVideoViewsInMongoOnDemand
} from "../libs/cache";
import {queryUserVideo} from "../libs/elasticsearch";
import logger from "../libs/logger";
import mongo from "../libs/mongo";
import rabbitmq, {genPayloadVideoConversion} from "../libs/rabbitmq";
import redis from "../libs/redis";
import {ACCECPTED_VIDEO_TYPES, checkFileAuthenticity} from "../middlewares/multer";
import {IUserDoc} from "../models/types/user";
import {ITempClip, IVideo, IVideoComment, IVideoCommentDoc, IVideoDoc} from "../models/types/video";
import userModel from "../models/user";
import videoModel from "../models/video";
import {
    IResponseBodyGeneralMessage,
    IResponseBodyUserLike,
    IResponseErrorMessage
} from "./types";
import {
    IResponseBodyClipPreVideoPlayback,
    IResponseBodyClipPreVideoPlaybacks,
    IResponseBodyComment,
    IResponseBodyComments,
    IResponseBodyCreateVideoComment,
    IResponseBodySearchUserPublicVideos,
    IResponseBodyUploadedTempClip,
    IResponseBodyUploadedVideo,
    IResponseBodyUserPreVideoPlayback,
    IResponseBodyUserVideos
} from "./types/userVideo";

const log = logger("user-video-controller");

const createVideo = async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
) => {
    try {
        if (!req.user) {
            throw new Error("no user passed in");
        }
    
        const {objectId, title, tags, isPublic} = req.body;
        const user = req.user as IUserDoc;

        const tempClips = await mongo.findTempClip(objectId);
        if (!tempClips) {
            res.status(httpStatus.BAD_REQUEST).json({ error: 0, message: "invalid video id" } as IResponseErrorMessage);
            return;
        }

        const newVideoClip: IVideo = {
            _id: Types.ObjectId(),
            owner: user._id,
            title,
            created_timestamp: new Date(),
            updated_timestamp: new Date(),
            available: false,
            tags: tags || [],
            isPublic
        };

        const tempClipDoc = tempClips;
        const queued = rabbitmq.pushVideoConversionRequest(
            genPayloadVideoConversion(
                tempClipDoc._id, 
                tempClipDoc.object, 
                newVideoClip._id
                ));
        if (!queued) {
            next(new Error("unable to push video conversion request to queue"));
            return;
        }
        tempClipDoc.videoId = newVideoClip._id;
        tempClipDoc.state = "Queued";
        await tempClipDoc.save();

        const videoDoc = await mongo.createVideo(newVideoClip);
        res.status(httpStatus.OK).send({ objectId: videoDoc._id } as IResponseBodyUploadedVideo);
    } catch (error) {
        next(error);
    } 
};


// TODO upload to s3, another storage (e.g. mongodb, in form of hex string, base64)

const postUploadingVideo = async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
) => {
    try {
        if (!req.user) {
            throw new Error("no user passed in");
        }
    
        if (!req.file) {
            res.status(httpStatus.BAD_REQUEST).json({ error: 0, message: "Bad file" } as IResponseErrorMessage);
            return;
        }
    

        if (!await checkFileAuthenticity(req.file, ACCECPTED_VIDEO_TYPES)) {
            res.status(httpStatus.BAD_REQUEST).json({ error: 0, message: "Bad file" } as IResponseErrorMessage);
            return;
        }
    
        const user = req.user as IUserDoc;
        const newVideoClip: ITempClip = {
            ownerId: user._id,
            object: path.join(process.cwd(), req.file.path),
            uploaded_timestamp: new Date(),
            state: "Initial"
        };
        const tempClipDoc = await mongo.createTempClip(newVideoClip);
        res.status(httpStatus.OK).send({ objectId: tempClipDoc._id } as IResponseBodyUploadedTempClip);
    } catch(error) {
        next(error);
    }
};

const videoDocsToResponseBodyUserVideos = async (doc: IVideoDoc) => {
    await loadVideoViewsInRedis(doc._id);
    const views = Number(await redis.get(videoModel.RedisKey.VideoViews(doc._id)));
    if (views) {
        await updateVideoViewsInMongoOnDemand(views, doc, doc._id);
    }

    const ownerId = doc.owner.toHexString();
    await loadUserInfoInRedis(ownerId);
    const fullname = await redis.get(userModel.RedisKey.UserFullName(ownerId));
    const avatar = await redis.get(userModel.RedisKey.UserAvatar(ownerId));

    await loadVideoLikesInRedis(doc._id);
    const likes = Number(await redis.get(videoModel.RedisKey.VideoLikes(doc._id)));

    return {
        user: {
            fullname: fullname || "",
            avatar: avatar || ""
        },
        videoId: doc._id,
        title: doc.title,
        available: doc.available,
        isPublic: doc.isPublic || false,
        likes: likes || 0,
        views: views || 0,
        time: doc.created_timestamp.getTime(),
        tags: doc.tags,
        duration: doc.duration
    };
};

const userPublicVideosSearch = async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
) => {
    try {
        const page = !isNaN(Number(req.query.p)) ? Number(req.query.p) : 1;
        const query = !Array.isArray(req.query.query) ? (req.query.query) ?
                            unescape(req.query.query.toString()) :
                            null : null;
        if (!query) {
            res.status(httpStatus.BAD_REQUEST).json({ error: 1, message: "user mismatch" } as IResponseErrorMessage);
            return;
        }

        let result = null;
        try {
            result = await queryUserVideo(query, page);
        } catch (error) {
            log.error("failed to fetch query result from elastic search");
            next(error);
            return;
        }

        if (!result) {
            throw new Error("result is null");
        }
        const data = result.data;
        const hits = data.hits.total.value;
        if (hits === 0) {
            res.status(httpStatus.NOT_FOUND).json({ error: 1, message: "no such videos" } as IResponseErrorMessage);
            return;
        }

        const ids = data.hits.hits.map(_data => _data._id);


        const userVideoDocs = await mongo.findVideosByIds(ids);

        const responseBody: IResponseBodyUserVideos = await Promise.all(userVideoDocs.map(videoDocsToResponseBodyUserVideos));

        if (responseBody.length === 0) {
            res.status(httpStatus.NOT_FOUND).json({ error: 1, message: "no such videos" } as IResponseErrorMessage);
            return;
        }

        res.status(httpStatus.OK).json({ total: hits, results: responseBody } as IResponseBodySearchUserPublicVideos);
    } catch (error) {
        next(error);
    }
};

const recentVideos = async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
) => {
    try {
        const ids = await redis.lrange(REDIS_KEY_RECENT_VIDEOS_LIST, 0, RECENT_VIDEOS);
        // TODO: do caching
        const VideoDocs = await mongo.findVideosByIds(ids);

        const responseBody: IResponseBodyUserVideos = await Promise.all(VideoDocs.map(videoDocsToResponseBodyUserVideos));

        res.status(httpStatus.OK).json(responseBody);
    } catch (error) {
        next(error);
    }
};

const userVideos = async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
) => {
    try {
        if (!req.user) {
            throw new Error("no user passed in");
        }
    
        const page = !isNaN(Number(req.query.p)) ? Number(req.query.p) : 1;
        const { _id } = req.user as IUserDoc;
    
        const userVideoDocs = await mongo.findVideosByUserId(_id, page);
    
        const responseBody: IResponseBodyUserVideos = await Promise.all(userVideoDocs.map(videoDocsToResponseBodyUserVideos));

        if (responseBody.length === 0) {
            res.status(httpStatus.NOT_FOUND).json({ error: 1, message: "no such videos" } as IResponseErrorMessage);
            return;
        }
        
        res.status(httpStatus.OK).json(responseBody);
    } catch (error) {
        next(error);
    }
};

const userPreVideoPlayback = async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
) => {
    try {
        const videoId = req.params.videoId;

        const userVideoDoc = await mongo.findUserVideoById(videoId);
        if (userVideoDoc === null) {
            res.status(httpStatus.NOT_FOUND).json({ error: 0, message: "not such video object" } as IResponseErrorMessage);
            return;
        }

        if (!userVideoDoc.available) {
            res.status(httpStatus.NOT_FOUND).json({ error: 0, message: "not such video object" } as IResponseErrorMessage);
            return;
        }

        if (!userVideoDoc.clips || !userVideoDoc.duration || !userVideoDoc.clips) {
            throw new Error("expected values not filled");
        }

        let liked = false;
        if (req.user) {
            const { _id } = req.user as IUserDoc;
            const userVideoLikeDoc = await mongo.findVideoLikeById(videoId, _id);
            if (userVideoLikeDoc) {
                liked = true;
            }
        }

        const playbacks: IResponseBodyClipPreVideoPlaybacks = userVideoDoc.clips.reduce<IResponseBodyClipPreVideoPlaybacks>(
            (accu, curr) => {
            Object.assign<IResponseBodyClipPreVideoPlaybacks, IResponseBodyClipPreVideoPlaybacks>(accu, {
                [curr.definition]: {
                    objectId: curr._id
                } as IResponseBodyClipPreVideoPlayback
            });
            return accu;
        }, {});

        // update video views on demand
        await loadVideoViewsInRedis(videoId);
        const views = await redis.incr(videoModel.RedisKey.VideoViews(videoId));
        await updateVideoViewsInMongoOnDemand(views, userVideoDoc, videoId);

        await loadVideoLikesInRedis(videoId);
        const likes = Number(await redis.get(videoModel.RedisKey.VideoLikes(videoId)));

        const preVideoPlayback: IResponseBodyUserPreVideoPlayback = {
            title: userVideoDoc.title,
            duration: userVideoDoc.duration,
            time: userVideoDoc.created_timestamp.getTime(),
            tags: userVideoDoc.tags,
            isPublic: userVideoDoc.isPublic,
            likes: likes || 0,
            liked,
            views,
            playbacks,
            comments: userVideoDoc.comments || 0,
            topComments: await Promise.all(userVideoDoc.top_comments!!.map((async comment => {
                if (!comment.updated_timestamp) {
                    throw new Error("updated_timestamp is undefined");
                }

                const userIdHex = comment.userId.toHexString();
                await loadUserInfoInRedis(userIdHex);
                const userFullname = await redis.get(userModel.RedisKey.UserFullName(userIdHex));
                const userAvatar = await redis.get(userModel.RedisKey.UserAvatar(userIdHex));

                return {
                    id: comment._id,
                    userId: comment.userId.toHexString(),
                    userFullname: userFullname || "",
                    userAvatar: userAvatar || "",
                    content: comment.content,
                    edit: comment.edit || false,
                    updated_timestamp: comment.updated_timestamp.getTime()
                };
            })))
        };
        
        res.status(httpStatus.OK).json(preVideoPlayback);
    } catch (error) {
        next(error);
    }
    
};

const updateUserVideo = async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
) => {
    try {
        if (!req.user) {
            throw new Error("no user passed in");
        }


        const videoId = req.params.videoId;
        const { _id } = req.user as IUserDoc;
        const {title, tags, isPublic} = req.body;

        const video = await mongo.findUserVideoById(videoId);
        if (!video) {
            res.status(httpStatus.NOT_FOUND).json({ error: 0, message: "not such video object" } as IResponseErrorMessage);
            return;
        }
        if (!video.owner.equals(_id)) {
            res.status(httpStatus.BAD_REQUEST).json({ error: 1, message: "user mismatch" } as IResponseErrorMessage);
            return;
        }

        video.title = title || video.title;
        video.tags = tags || video.tags;
        video.isPublic = isPublic || video.isPublic;
        video.updated_timestamp = new Date();
        
        await mongo.updateVideo(video);
        res.status(httpStatus.OK).json({ message: "Ok" } as IResponseBodyGeneralMessage);
    } catch (error) {
        next(error);
    }
};

const removeUserVideo = async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
) => {
    try {
        if (!req.user) {
            throw new Error("no user passed in");
        }

        const videoId = req.params.videoId;
        const { _id } = req.user as IUserDoc;

        const video = await mongo.findUserVideoById(videoId);
        if (!video) {
            res.status(httpStatus.NOT_FOUND).json({ error: 0, message: "not such video object" } as IResponseErrorMessage);
            return;
        }
        if (!video.owner.equals(_id)) {
            res.status(httpStatus.BAD_REQUEST).json({ error: 1, message: "user mismatch" } as IResponseErrorMessage);
            return;
        }

        

        // TODO remove video clips and leftovers
        // if (video.available) {
        //     video.available = false;
        //     await video.save();
        // }

        // const clipsBeDeleted = await video.clips || [];
        // for ()

        await mongo.removeVideo(videoId, _id);
        res.status(httpStatus.OK).json({ message: "Ok" } as IResponseBodyGeneralMessage);
    } catch (error) {
        next(error);
    }
};

const getUserVideoComments = async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
) => {
    try {
        const videoId = req.params.videoId;
        const lastCommentId = (!Array.isArray(req.query.skipped)) ?
            (req.query.skipped) ? String(req.query.skipped) : undefined : undefined;
        // const page = (Number(req.query.p) > 0) ? Number(req.query.p) : 1;

        const userVideoDoc = await mongo.findUserVideoById(videoId);
        if (userVideoDoc === null) {
            res.status(httpStatus.NOT_FOUND).json({ error: 0, message: "not such video object" } as IResponseErrorMessage);
            return;
        }

        if (!userVideoDoc.available) {
            res.status(httpStatus.NOT_FOUND).json({ error: 0, message: "not such video object" } as IResponseErrorMessage);
            return;
        }

        if (lastCommentId) {
            const lastCommentDoc = await mongo.findVideoCommentById(videoId, lastCommentId);
            if (!lastCommentDoc) {
                res.status(httpStatus.NOT_FOUND).json({ error: 2, message: "not such comment object" } as IResponseErrorMessage);
                return;
            }
        }

        let comments: IVideoComment[] = [];
        if (!lastCommentId) {
            comments = await mongo.findVideoCommentsById(videoId) || [];
        } else {
            comments = (await mongo.findVideoCommentsByIdV2(videoId, lastCommentId)) || [];
        }
        
        const response: IResponseBodyComments = await Promise.all(comments.map<Promise<IResponseBodyComment>>(async comment => {
            const { userId, content, edit, _id, updated_timestamp } = comment;
            if (!updated_timestamp) {
                throw new Error("updated_timestamp is null");
            }

            const userIdHex = userId.toHexString();
            await loadUserInfoInRedis(userIdHex);
            const userFullname = await redis.get(userModel.RedisKey.UserFullName(userIdHex));
            const userAvatar = await redis.get(userModel.RedisKey.UserAvatar(userIdHex));

            return {
                id: _id,
                userId: userId.toHexString(),
                userFullname: userFullname || "",
                userAvatar: userAvatar || "",
                content,
                edit: edit || false,
                updated_timestamp: updated_timestamp.getTime()
            };
        }));

        if (response.length === 0) {
            res.status(httpStatus.NOT_FOUND).json({ error: 1, message: "not such comments in video" } as IResponseErrorMessage);
            return;
        }

        res.status(httpStatus.OK).json(response);
    } catch (error) {
        next(error);
    }
};

const addUserVideoComment = async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
) => {
    try {
        if (!req.user) {
            throw new Error("no user passed in");
        }
    
        const { _id } = req.user as IUserDoc;
    
        const videoId = req.params.videoId;
        const commentContent = escape(req.body.content);
    
        let userVideoDoc = await mongo.findUserVideoById(videoId);
        if (userVideoDoc === null ||
            (userVideoDoc !== null && !userVideoDoc.available)) {
            res.status(httpStatus.BAD_REQUEST).json({ error: 0, message: "no such video object" } as IResponseErrorMessage);
            return;
        }

        if (!userVideoDoc.comments) {
            userVideoDoc.comments = 1;
        } else {
            userVideoDoc.comments++;
        }
        try {
            await mongo.updateVideo(userVideoDoc);
        } catch (error) {
            if (error instanceof Error.VersionError) {
                res.status(httpStatus.BAD_REQUEST).json({ error: 1, message: "please try again later" } as IResponseErrorMessage);
                return;
            }
            throw error;
        }

    
        const comment: IVideoComment = {
            _id: new ObjectId(),
            userId: _id,
            videoId: Types.ObjectId(videoId),
            content: commentContent
        };
    
        let commentDoc: IVideoCommentDoc;
        try {
            commentDoc = await mongo.addVideoComment(userVideoDoc, comment);
        } catch (error) {
            if (error instanceof Error.VersionError) {
                res.status(httpStatus.BAD_REQUEST).json({ error: 1, message: "please try again later" } as IResponseErrorMessage);
                return;
            }


            let success = false;
            while (!success) {
                try {
                    userVideoDoc = await mongo.findUserVideoById(videoId);
                    if (userVideoDoc === null ||
                        (userVideoDoc !== null && !userVideoDoc.available)) {
                        res.status(httpStatus.BAD_REQUEST).json({ error: 0, message: "no such video object" } as IResponseErrorMessage);
                        return;
                    }
                    if (!userVideoDoc.comments) {
                        break;
                    }

                    userVideoDoc.comments--;

                    await mongo.updateVideo(userVideoDoc);
                    success = true;
                } catch (error) {
                    if (error instanceof Error.VersionError) {
                        log.warn("revert user comment count in userVideoDoc failed... retry");
                        continue;
                    }

                    log.error("failed to revert user comment count in userVideoDoc: " + videoId);
                    throw error;
                }
            }
            throw error;
        }
        
        const message: IResponseBodyCreateVideoComment = { objectId: commentDoc._id };
        res.status(httpStatus.OK).json(message);
    } catch (error) {
        next(error);
    }
};

const updateUserVideoComment = async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
) => {
    try {
        if (!req.user) {
            throw new Error("no user passed in");
        }
    
        const { _id } = req.user as IUserDoc;
    
        const videoId = req.params.videoId;
        const commentId = req.body.objectId;
        const commentContent = escape(req.body.content);
    
        const commentDoc = await mongo.findVideoCommentById(videoId, commentId);
        if (commentDoc === null) {
            res.status(httpStatus.BAD_REQUEST).json({ error: 0, message: "no such comment object" } as IResponseErrorMessage);
            return;
        }
    
        if (commentDoc.videoId.toHexString() !== videoId) {
            res.status(httpStatus.BAD_REQUEST).json({ error: 1, message: "no such video object"} as IResponseErrorMessage);
            return;
        }
    
        if (!commentDoc.userId.equals(_id)) {
            res.status(httpStatus.BAD_REQUEST).json({ error: 2, message: "user mismatch"} as IResponseErrorMessage);
            return;
        }
    
        commentDoc.content = commentContent;
        commentDoc.edit = true;
        commentDoc.updated_timestamp = new Date();
        
        try {
            await mongo.updateVideoComment(commentDoc);
        } catch (error) {
            if (error instanceof Error.VersionError) {
                res.status(httpStatus.BAD_REQUEST).json({ error: 3, message: "please try again later" } as IResponseErrorMessage);
                return;
            }
            throw error;
        }
        
        res.status(httpStatus.OK).json({ message: "Ok" } as IResponseBodyGeneralMessage);
    } catch (error) {
        next(error);
    }
};

const removeUserVideoComment = async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
) => {
    try {
        if (!req.user) {
            throw new Error("no user passed in");
        }
    
        const { _id } = req.user as IUserDoc;
    
        const videoId = req.params.videoId;
        const commentId = req.body.objectId;

        let userVideoDoc = await mongo.findUserVideoById(videoId);
        if (userVideoDoc === null ||
            (userVideoDoc !== null && !userVideoDoc.available)) {
            res.status(httpStatus.BAD_REQUEST).json({ error: 0, message: "no such video object" } as IResponseErrorMessage);
            return;
        }

        if (userVideoDoc.comments) {
            userVideoDoc.comments--;
            try {
                await mongo.updateVideo(userVideoDoc);
            } catch (error) {
                if (error instanceof Error.VersionError) {
                    res.status(httpStatus.BAD_REQUEST).json({ error: 1, message: "please try again later" } as IResponseErrorMessage);
                    return;
                }
                throw error;
            }
        }

        try {
            await mongo.removeVideoComment(videoId, commentId, _id);
        } catch (error) {
            if (error instanceof Error.VersionError) {
                res.status(httpStatus.BAD_REQUEST).json({ error: 1, message: "please try again later" } as IResponseErrorMessage);
                return;
            }

            let success = false;
            while (!success) {
                try {
                    userVideoDoc = await mongo.findUserVideoById(videoId);
                    if (userVideoDoc === null ||
                        (userVideoDoc !== null && !userVideoDoc.available)) {
                        res.status(httpStatus.BAD_REQUEST).json({ error: 0, message: "no such video object" } as IResponseErrorMessage);
                        return;
                    }
                    if (!userVideoDoc.comments) {
                        break;
                    }

                    userVideoDoc.comments++;

                    await mongo.updateVideo(userVideoDoc);
                    success = true;
                } catch (error) {
                    if (error instanceof Error.VersionError) {
                        log.warn("revert user comment count in userVideoDoc failed... retry");
                        continue;
                    }

                    log.error("failed to revert user comment count in userVideoDoc: " + videoId);
                    throw error;
                }
            }

            throw error;
        }
        
        res.status(httpStatus.OK).json({ message: "Ok" } as IResponseBodyGeneralMessage);
    } catch (error) {
        next(error);
    }
};

const userToggleLikeVideo = async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
) => {
    try {
        if (!req.user) {
            throw new Error("no user passed in");
        }

        const { _id } = req.user as IUserDoc;
        const videoId = req.params.videoId;

        const userVideoDoc = await mongo.findUserVideoById(videoId);
        if (userVideoDoc === null ||
            (userVideoDoc !== null && !userVideoDoc.available)) {
            res.status(httpStatus.BAD_REQUEST).json({ error: 0, message: "no such video object" } as IResponseErrorMessage);
            return;
        }

        let state: "like" | "unlike" | "nothing" = "nothing";
        const maxRetry = 3;
        let retried = 0;
        while (retried++ < maxRetry) {
            let videoLike =  await mongo.createVideoLike(videoId, _id);
            if (videoLike) {
                await loadVideoLikesInRedis(videoId);
                const likes = await redis.incr(videoModel.RedisKey.VideoLikes(videoId));
                await updateVideoLikesInMongoOnDemand(likes, userVideoDoc, videoId);
                state = "like";
                break;
            }

            videoLike =  await mongo.removeVideoLike(videoId, _id);
            if (videoLike) {
                await loadVideoLikesInRedis(videoId);
                const likes = await redis.decr(videoModel.RedisKey.VideoLikes(videoId));
                await updateVideoLikesInMongoOnDemand(likes, userVideoDoc, videoId);
                state = "unlike";
                break;
            }
        }

        if (state === "nothing") {
            res.status(httpStatus.BAD_REQUEST).json({ error: 2, message: "please try again later" } as IResponseErrorMessage);
            return;
        }

        res.status(httpStatus.OK).json({ like: (state === "like") } as IResponseBodyUserLike);
    } catch (error) {
        next(error);
    }
};

export {
    createVideo,
    postUploadingVideo,
    userPublicVideosSearch,
    recentVideos,
    userVideos,
    userPreVideoPlayback,
    removeUserVideo,
    updateUserVideo,
    getUserVideoComments,
    addUserVideoComment,
    updateUserVideoComment,
    removeUserVideoComment,
    userToggleLikeVideo,
};