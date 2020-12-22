import {IVideoDoc} from "../models/types/video";
import userModel from "../models/user";
import videoModel from "../models/video";
import logger from "./logger";
import mongo from "./mongo";
import redis, {REDIS_NIL} from "./redis";

const log = logger("cache-manager");

const LIKES_UPDATE_FREQUENCY = 1000;
const VIEWS_UPDATE_FREQUENCY = 1000;

const CACHE_EXPIRE = 86400;

export async function loadVideoLikesInRedis(videoId: string) {
    if (!await redis.exists(videoModel.RedisKey.VideoLikes(videoId))) {
        const likes = await mongo.getVideoLikes(videoId);
        const set = (await redis.setnx(videoModel.RedisKey.VideoLikes(videoId), likes.toString()) === 0);
        if (!set) {
            log.warn("set video likes failed as it have been set there. collision?");
        }
    }
}

export async function loadUserInfoInRedis(userId: string, force: boolean = false) {
    if (!await redis.exists(userModel.RedisKey.UserId(userId)) || force) {
        const userDoc = await mongo.findUserById(userId);
        if (!userDoc) {
            throw new Error("userDoc not found");
        }
        const { firstname, lastname, avatar } = userDoc;
        const fullname = (firstname && lastname) ? firstname + " " + lastname : (firstname) ? firstname
            : (lastname) ? lastname : "";
        const _avatar = avatar || "";
        // avatar
        let set = (await redis.getset(userModel.RedisKey.UserAvatar(userId), _avatar) !== REDIS_NIL);
        if (set) {
            set = (await redis.expire(userModel.RedisKey.UserAvatar(userId), CACHE_EXPIRE) === 1);
            if (!set) {
                log.warn("set user avatar's expiration failed");
            }
        } else {
            log.warn("set user avatar failed as it have been set there. collision?");
        }

        // fullname
        set = (await redis.set(userModel.RedisKey.UserFullName(userId), fullname) !== REDIS_NIL);
        if (set) {
            set = (await redis.expire(userModel.RedisKey.UserFullName(userId), CACHE_EXPIRE) === 1);
            if (!set) {
                log.warn("set user full name's expiration failed");
            }
        } else {
            log.warn("set user full name failed as it have been set there. collision?");
        }

        // final stage
        set = (await redis.set(userModel.RedisKey.UserId(userId), Date.now().toString()) !== REDIS_NIL);
        if (set) {
            set = (await redis.expire(userModel.RedisKey.UserId(userId), CACHE_EXPIRE) === 1);
            if (!set) {
                log.warn("set user cache label's expiration failed");
            }
        } else {
            log.warn("mark user as cached failed as it have been set there. collision?");
        }
    }
}

export async function loadVideoViewsInRedis(videoId: string) {
    if (!await redis.exists(videoModel.RedisKey.VideoViews(videoId))) {
        const videoDoc = await mongo.findUserVideoById(videoId);
        const views = videoDoc?.views || 0;
        const set = (await redis.setnx(videoModel.RedisKey.VideoViews(videoId), views.toString()) === 0);
        if (!set) {
            log.warn("set video views failed as it have been set there. collision?");
        }
    }
}

export async function updateVideoViewsInMongoOnDemand(views: number, userVideoDoc: IVideoDoc, videoId: string) {
    if (views % VIEWS_UPDATE_FREQUENCY === 0) {
        // update user views to database if needed
        userVideoDoc.views = views;
        userVideoDoc.updated_timestamp = new Date();
        try {
            await mongo.updateVideo(userVideoDoc);
        } catch (error) {
            log.warn("failed to update video " + videoId + " views into database:");
            log.log({
                level: "error",
                message: "",
                error
            });
            return false;
        }
        return true;
    }
    return false;
}

export async function updateVideoLikesInMongoOnDemand(likes: number, userVideoDoc: IVideoDoc, videoId: string) {
    if (likes % LIKES_UPDATE_FREQUENCY === 0) {
        // update user likes to database if needed
        userVideoDoc.likes = likes;
        userVideoDoc.updated_timestamp = new Date();
        try {
            await mongo.updateVideo(userVideoDoc);
        } catch (error) {
            log.warn("failed to update video " + videoId + " likes into database:");
            log.log({
                level: "error",
                message: "",
                error
            });
            return false;
        }
        return true;
    }
    return false;
}

export const REDIS_KEY_RECENT_VIDEOS_LIST = "list:videos:recent";
export const REDIS_KEY_RECENT_VIDEOS_SET = "set:videos:recent";


export const RECENT_VIDEOS = 10;
export async function updateRecentVideoInRedis(userVideoDoc: IVideoDoc) {
    const id = userVideoDoc._id.toHexString();
    const _userVideoDoc = await mongo.findUserVideoById(id);
    if (!_userVideoDoc || !userVideoDoc.available || !userVideoDoc.isPublic) {
        await redis.lrem(REDIS_KEY_RECENT_VIDEOS_LIST, RECENT_VIDEOS, id);
        await redis.srem(REDIS_KEY_RECENT_VIDEOS_SET, id);
        return;
    }

    if (await redis.sismember(REDIS_KEY_RECENT_VIDEOS_SET, id) === 1) {
        return;
    }
    await redis.sadd(REDIS_KEY_RECENT_VIDEOS_SET, id);
    await redis.lpush(REDIS_KEY_RECENT_VIDEOS_LIST, id);
    await redis.ltrim(REDIS_KEY_RECENT_VIDEOS_LIST, 0, RECENT_VIDEOS);
}