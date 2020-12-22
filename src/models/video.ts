import mongoose, { model, STATES } from "mongoose";
import {
    DEFINITIONS,
    IClip,
    IClipDoc,
    ITempClip,
    ITempClipDoc,
    IVideo,
    IVideoComment,
    IVideoCommentDoc,
    IVideoDoc, IVideoLikes,
    IVideoLikesDoc,
    TAGS
} from "./types/video";

const Schema = mongoose.Schema;

/** Clip */
const ClipSchemaFields: Record<keyof IClip, any> = {
    _id: {
        type: Schema.Types.ObjectId,
    },
    object: {
        type: String,
        required: true,
    },
    definition: {
        type: String,
        enum: DEFINITIONS,
        required: true,
    },
    thumbnails: {
        type: Schema.Types.Array,
        required: true,
    }
};

const ClipSchema = new Schema(ClipSchemaFields, { optimisticConcurrency: true });

const Clip = model<IClipDoc>("Clip", ClipSchema);

/** VideoComment */
const VideoCommentSchema = new Schema(undefined, {optimisticConcurrency: true});

const VideoCommentFields: Record<keyof IVideoComment, any> = {
    _id: {
        type: Schema.Types.ObjectId,
    },
    parentId: {
        type: Schema.Types.ObjectId,
        ref: "VideoComment",
    },
    content: {
        type: String,
        required: true,
    },
    created_timestamp: {
        type: Date,
        required: true,
        default: Date.now,
    },
    updated_timestamp: {
        type: Date,
        required: true,
        default: Date.now,
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    videoId: {
        type: Schema.Types.ObjectId,
        ref: "Video",
        required: true
    },
    likes: {
        type: Number,
        required: true,
        default: 0
    },
    edit: {
        type: Boolean,
        required: true,
        default: false
    },
    top_replies: [VideoCommentSchema]
};

VideoCommentSchema.add(VideoCommentFields);

const VideoComment = model<IVideoCommentDoc>("VideoComment", VideoCommentSchema);


/** Video */
const VideoSchemaFields: Record<keyof IVideo, any> = {
    _id: {
        type: Schema.Types.ObjectId,
    },
    owner: {
        type: Schema.Types.ObjectId,
        ref: "User",
    },
    title: {
        type: String,
        required: true,
    },
    views: {
        type: Number,
    },
    likes: {
        type: Number,
    },
    created_timestamp: {
        type: Date,
        required: true,
        default: Date.now,
    },
    updated_timestamp: {
        type: Date,
        required: true,
        default: Date.now,
    },
    clips: [ClipSchema],
    tags: [
        {
            type: String,
            enum: TAGS,
            required: true,
        }
    ],
    available: {
        type: Boolean,
        default: false,
    },
    duration: {
        type: Number,
    },
    isPublic: {
        type: Boolean,
        default: false
    },
    comments: {
        type: Number,
    },
    top_comments: [VideoCommentSchema],
};

const VideoSchema = new Schema(VideoSchemaFields, { optimisticConcurrency: true });

const Video = model<IVideoDoc>("Video", VideoSchema);

/** Video likes */
const VideoLikesSchemaFields: Record<keyof IVideoLikes, any> = {
    videoId: {
        type: Schema.Types.ObjectId,
        ref: "Video",
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User"
    },
    created_timestamp: {
        type: Date,
        required: true,
        default: Date.now,
    }
};

const VideoLikesSchema = new Schema(VideoLikesSchemaFields, { optimisticConcurrency: true });

const VideoLikes = model<IVideoLikesDoc>("VideoLikes", VideoLikesSchema);

/** Temporary video clip */
const TempClipSchemaFields: Record<keyof ITempClip, any> = {
    object: {
        type: String,
        required: true,
    },
    uploaded_timestamp: {
        type: Date,
        required: true,
        default: Date.now,
    },
    ownerId: {
        type: Schema.Types.ObjectId,
        ref: "User",
    },
    videoId: {
        type: Schema.Types.ObjectId,
        ref: "Video",
    },
    state: {
        type: String,
        enum: STATES,
        required: true,
    }
};

const TempClipSchema = new Schema(TempClipSchemaFields, { optimisticConcurrency: true });

const TempClip = model<ITempClipDoc>("TempClip", TempClipSchema);

/** Redis Keys */
const RedisKey = {
    VideoLikes: (videoId: string) => `video:object:${videoId}:likes`,
    VideoViews: (videoId: string) => `video:object:${videoId}:views`
};

export default {
    RedisKey
};

export {
    Clip,
    Video,
    TempClip,
    VideoComment,
    VideoLikes
};