
import {MongoError} from "mongodb";
import { promisify } from "util";
import logger from "../libs/logger";
import { IUser, IUserDoc } from "../models/types/user";
import {
    ITempClip,
    ITempClipDoc,
    IVideo,
    IVideoComment,
    IVideoCommentDoc,
    IVideoDoc,
    IVideoLikes,
    IVideoLikesDoc
} from "../models/types/video";
import {User} from "../models/user";
import {TempClip, Video, VideoComment, VideoLikes} from "../models/video";
import {MongoConfig} from "./config";
import {IMongo, IMongoConfigOptions} from "./types/mongo";


const log = logger("mongo");

export const NUMBERS_IN_PAGE = 20;

class Mongo implements IMongo {
    dropDatabase?: () => Promise<unknown>;
    private client?: mongoose.Connection;
    private dbName: string;
    private uriString: string;

    constructor({
                    ipAddr = "127.0.0.1",
                    port = "27017",
                    username = "",
                    password = "",
                }: IMongoConfigOptions) {
        this.dbName = "videoPlatform";
        this.uriString = (!username || !password) ? `mongodb://${ipAddr}:${port}/${this.dbName}`
            : `mongodb://${username}:${password}@${ipAddr}:${port}/${this.dbName}`;

        log.debug("MongoHelper created");

        mongoose.connect(this.uriString, {
            useUnifiedTopology: true,
            useNewUrlParser: true,
            useCreateIndex: true,
            useFindAndModify: false,
            poolSize: 10
        }).then(
            client => {
                this.client = client.connection;
                this.dropDatabase = promisify(this.client.dropDatabase).bind(this.client);

                this.client.on("connected", () => {
                    log.info("MongoHelper connected successfully");
                });
                this.client.on("error", error => {
                    log.error("MongoHelper error has occurred");
                    log.log({
                        level: "error",
                        message: "",
                        error
                    });
                });
                this.client.on("disconnected", () => {
                    log.warn("MongoHelper disconnected");
                });
                this.client.on("reconnect", () => {
                    log.warn("MongoHelper reconnect...");
                });

                log.verbose("MongoHelper init connection succeed");
            },
            error => {
                log.error("MongoHelper init connection failed");
                log.log({
                    level: "error",
                    message: "",
                    error
                });
                return new Error("MongoHelper Init connection failed");
            }
        );
    }

    close() {
        if (!this.client) {
            throw new Error("Not connected");
        }

        return this.client.close();
    }

    findUserByUsername(usernameOrEmail: string) {
        if (!this.client) {
            throw new Error("Not connected");
        }

        return User.find({ $or: [{ username: usernameOrEmail }, { email: usernameOrEmail }] }).exec();
    }

    findUserById(userId: string): Promise<IUserDoc | null> {
        if (!this.client) {
            throw new Error("Not connected");
        }

        return User.findOne({_id: userId}).exec();
    }

    createUser(user: IUser) {
        if (!this.client) {
            throw new Error("Not connected");
        }

        const newUser = new User(user);
        return newUser.save();
    }

    updateUser(user: IUserDoc) {
        if (!this.client) {
            throw new Error("Not connected");
        }

        return user.save();
    }

    createTempClip(tempClip: ITempClip) {
        if (!this.client) {
            throw new Error("Not connected");
        }

        const newClip = new TempClip(tempClip);

        return newClip.save();
    }

    findTempClip(_id: mongoose.Types.ObjectId) {
        if (!this.client) {
            throw new Error("Not connected");
        }

        return TempClip.findOne({ _id }).exec();
    }

    updateTempClip(clip: ITempClipDoc) {
        if (!this.client) {
            throw new Error("Not connected");
        }

        return clip.save();
    }

    createVideo(video: IVideo) {
        if (!this.client) {
            throw new Error("Not connected");
        }

        const newVideo = new Video(video);

        return newVideo.save();
    }

    updateVideo(video: IVideoDoc) {
        if (!this.client) {
            throw new Error("Not connected");
        }

        return video.save();
    }

    findVideosByUserId(userId: string, page: number = 1) {
        if (!this.client) {
            throw new Error("Not connected");
        }

        const skip = (page - 1) * NUMBERS_IN_PAGE;
        const limit = NUMBERS_IN_PAGE;
        return Video.find({ owner: userId }).sort({ "created_timestamp": -1 }).skip(skip).limit(limit).exec();
    }

    findVideosByIds(ids: string[]): Promise<IVideoDoc[]> {
        if (!this.client) {
            throw new Error("Not connected");
        }

        return Video.find({
            _id: {
                "$in": ids.map(id => mongoose.Types.ObjectId(id))
            }
        }).sort({updated_timestamp: -1}).exec();
    }

    findUserVideoById(videoId: string) {
        if (!this.client) {
            throw new Error("Not connected");
        }

        return Video.findOne({_id: videoId}).exec();
    }

    async removeVideo(videoId: string, userId: string) {
        if (!this.client) {
            throw new Error("Not connected");
        }

        await Video.findOneAndDelete({ _id: videoId, owner: userId }).exec();
    }

    async findClipById(clipId: string) {
        if (!this.client) {
            throw new Error("Not connected");
        }

        const videoDoc = await Video.findOne({"clips._id": clipId}, "clips").exec();
        if (!videoDoc) {
            return null;
        }

        if (!videoDoc.clips) {
            throw new Error("clips not existing unexpectedly");
        }
        const res = videoDoc.clips.find((clip) => clip._id.equals(clipId));
        if (!res) {
            throw new Error("clips not found unexpectedly");
        }

        return res;
    }

    // addVideoComment(comment: IVideoComment): Promise<IVideoCommentDoc>;
    async addVideoComment(videoDoc: IVideoDoc, comment: IVideoComment) {
        if (!this.client) {
            throw new Error("Not connected");
        }

        const _comment = new VideoComment(comment);

        if (!videoDoc.top_comments) {
            videoDoc.top_comments = [ _comment ];
            await videoDoc.save();
        } else {
            videoDoc.top_comments.unshift(_comment);
            videoDoc.updated_timestamp = new Date();
            let beMovedComment: IVideoCommentDoc | null = null;
            if (videoDoc.top_comments.length > NUMBERS_IN_PAGE) {
                beMovedComment = new VideoComment(videoDoc.top_comments.pop());
            }
            await videoDoc.save();
            if (beMovedComment) {
                beMovedComment.isNew = true;
                await beMovedComment.save();
            }
        }



        return _comment;
    }

    async updateVideoComment(comment: IVideoComment) {
        if (!this.client) {
            throw new Error("Not connected");
        }

        let result: any;
        result = await Video.findOneAndUpdate({
            _id: comment.videoId,
            "top_comments._id": comment._id,
        }, {
            $set: {
                "top_comments.$": comment
            }
        }).exec();
        if (result) {
            return comment;
        }

        result = await VideoComment.findOneAndUpdate({
            _id: comment._id,
        }, comment);
        if (!result) {
            throw new Error("Nothing changed");
        }

        return comment;
    }

    async removeVideoComment(videoId: string, commentId: string, userId: string) {
        let comment = await VideoComment.findOneAndDelete({
            _id: commentId,
            userId,
            videoId
        }).exec();
        if (comment) {
            return;
        }

        let video = await Video.findOneAndUpdate({
            _id: videoId,
            "top_comments._id": commentId,
            "top_comments.userId": userId,
        }, {
            $pull: {
                top_comments: {
                    _id: commentId
                }
            }
        }).exec();
        if (video) {
            comment = await VideoComment.findOne().sort({ "created_timestamp": -1 }).exec();
            if (!comment) {
                return;
            }

            video = await Video.findOneAndUpdate({
                _id: videoId,
            }, {
                $push: {
                    "top_comments": {
                        $each: [ comment ],
                        $sort: { "created_timestamp": -1 },
                    }
                }
            }).exec();
            if (video) {
                await VideoComment.findOneAndDelete({ _id: comment._id }).exec();
            }
        }
    }

    async findVideoCommentById(videoId: string, commentId: string) {
        if (!this.client) {
            throw new Error("Not connected");
        }

        let result: IVideoComment | null = await VideoComment.findOne({ _id: commentId }).exec();
        if (result) {
            return result;
        }

        const video = await Video.findOne({ _id: videoId, "top_comments._id": commentId }).exec();
        if (!video) {
            return null;
        }
        if (!video.top_comments) {
            throw new Error("no top comments in video");
        }

        const findResult = video.top_comments.find(comment => comment._id.equals(commentId));
        if (!findResult) {
            return null;
        } else {
            result = findResult;
        }

        return result;
    }

    async findVideoCommentsByIdV2(videoId: string, lastCommentId?: string): Promise<IVideoComment[] | null> {
        if (!this.client) {
            throw new Error("Not connected");
        }

        let left = NUMBERS_IN_PAGE;
        const res: IVideoComment[] = [];

        const video = await Video.findOne({ _id: videoId, "top_comments._id": lastCommentId}).exec();
        if (video && video.top_comments) {
            const startFrom = video.top_comments.findIndex(comment => comment._id.equals(lastCommentId)) + 1;
            if (startFrom >= 0 && startFrom < video.top_comments.length) {
                for (let i = startFrom; i < video.top_comments.length && left >= 0; i++) {
                    res.push(video.top_comments[i]);
                    left--;
                }
            }
        }

        if (left >= 0) {
            const comments = await VideoComment.find({ videoId, _id: { $lt: mongoose.Types.ObjectId(lastCommentId) } })
                .sort({ "created_timestamp": -1 }).limit(left + 1).exec();
            for (let i = 0; i < comments.length && left >= 0; i++) {
                res.push(comments[i]);
                left--;
            }
        }

        return res;
    }

    /**
     * @deprecated replaced with "findVideoCommentsByIdV2" which supports querying result after lastCommentId
     */
    async findVideoCommentsById(videoId: string, page: number = 1) {
        if (!this.client) {
            throw new Error("Not connected");
        }

        const _page = page - 1;
        if (_page === 0) {
            const video = await Video.findOne({ _id: videoId }).exec();
            if (!video?.top_comments) {
                return [];
            }

            return video.top_comments;
        }

        const skip = (_page - 1) * NUMBERS_IN_PAGE;
        const limit = NUMBERS_IN_PAGE;
        return VideoComment.find({ videoId }).sort({ "created_timestamp": -1 }).skip(skip).limit(limit).exec();
    }

    async createVideoLike(videoId: string, userId: string): Promise<IVideoLikesDoc | null> {
        if (!this.client) {
            throw new Error("Not connected");
        }

        const videoLikes: IVideoLikes = {
            userId: mongoose.Types.ObjectId(userId),
            videoId: mongoose.Types.ObjectId(videoId),
            created_timestamp: new Date()
        };
        const videoLikesDoc = new VideoLikes(videoLikes);

        try {
            return await videoLikesDoc.save();
        } catch (error) {
            if (error instanceof MongoError && error.code === 11000) {
                return null;
            }
            throw error;
        }
    }

    async findVideoLikeById(videoId: string, userId: string): Promise<IVideoLikesDoc | null> {
        return VideoLikes.findOne({
            userId,
            videoId
        }).exec();
    }

    async removeVideoLike(videoId: string, userId: string): Promise<IVideoLikesDoc | null> {
        return VideoLikes.findOneAndRemove({
            userId,
            videoId
        }).exec();
    }

    async getVideoLikes(videoId: string): Promise<number> {
        return VideoLikes.countDocuments({ videoId }).exec();
    }
}

export default new Mongo(MongoConfig);
