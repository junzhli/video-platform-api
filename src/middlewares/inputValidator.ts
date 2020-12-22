import express from "express";
import { body, param, query } from "express-validator";
import { validationResult } from "express-validator";
import httpStatus from "http-status-codes";
import logger from "../libs/logger";
import { TAGS } from "../models/types/video";

const log = logger("input-validator-handler");

const _validatorsBody = {
    email: body("email").isEmail().normalizeEmail(),
    username: body("username").isString().matches(/[0-9A-Za-z.]/).isLength({ min: 3, max: 20 }),
    password: body("password").isString().isLength({ min: 6, max: 20 }),
    oldPassword: body("oldPassword").isString().isLength({ min: 6, max: 20 }),
    newPassword: body("newPassword").isString().isLength({ min: 6, max: 20 }),
    firstname: body("firstname").isString().isLength( { max: 20 }),
    lastname: body("lastname").isString().isLength( { max: 20 }),
    objectId: body("objectId").isString().isLength({ min: 24, max: 24 }),
    title: body("title").isString().isLength({ min: 1 }),
    tags: body("tags").isArray({ min: 1 }).custom((arr) => arr.every((ele: any) => (TAGS.includes(ele)))),
    commentContent: body("content").isString().notEmpty().isLength({ max: 500 }),
    isPublic: body("isPublic").isBoolean()
};

const _validatorsParam = {
    videoId: param("videoId").isString().isLength({ min: 24, max: 24 }),
};

const _validatorsQuery = {
    clipId: query("vid").isString().isLength({ min: 24, max: 24 }),
    page: query("p").isNumeric(),
    skipped: query("skipped").isString().isLength({ min: 24, max: 24 }),
    query: query("query").isString().notEmpty()
};

/** User */

const userSignupInput = [
    _validatorsBody.email, 
    _validatorsBody.username, 
    _validatorsBody.password, 
    _validatorsBody.firstname, 
    _validatorsBody.lastname
];

const userLoginInput = [
    _validatorsBody.username, 
    _validatorsBody.password
];

const userUpdateInfoInput = [
    _validatorsBody.firstname.optional(), 
    _validatorsBody.lastname.optional(), 
    _validatorsBody.oldPassword.optional(), 
    _validatorsBody.newPassword.optional()
];

/** User Video */

const userCreateVideo = [
    _validatorsBody.objectId, 
    _validatorsBody.title, 
    _validatorsBody.tags.optional(),
    _validatorsBody.isPublic
];

const userUpdateVideo = [
    _validatorsParam.videoId,
    _validatorsBody.title.optional(),
    _validatorsBody.tags.optional(),
    _validatorsBody.isPublic.optional()
];

const userPreVideoPlayback = [_validatorsParam.videoId];

const userGetVideoComments = [
    _validatorsParam.videoId,
    _validatorsQuery.skipped.optional()
];

const userCreateVideoComment = [
    _validatorsParam.videoId,
    _validatorsBody.commentContent
];

const userUpdateVideoComment = [
    _validatorsParam.videoId,
    _validatorsBody.objectId,
    _validatorsBody.commentContent
];

const userRemoveVideoComment = [
    _validatorsParam.videoId,
    _validatorsBody.objectId
];

const userRemoveVideo = [
    _validatorsParam.videoId
];

const userLikeVideo = [
    _validatorsParam.videoId,
];

const userSearchPublicVideo = [
    _validatorsQuery.query,
    _validatorsQuery.page.optional()
];

/** Video streaming */
const userVideoStream = [_validatorsQuery.clipId];

const resultHandler = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(httpStatus.BAD_REQUEST).json({ error: -1, message: "provided user info do not fit into what we need"});
        log.warn("provided request with errors: " + JSON.stringify(errors.array()));
        return;
    }
    next();
};

export default {
    userSignupInput,
    userLoginInput,
    userUpdateInfoInput,
    userCreateVideo,
    userSearchPublicVideo,
    userPreVideoPlayback,
    userVideoStream,
    userGetVideoComments,
    userCreateVideoComment,
    userUpdateVideoComment,
    userRemoveVideoComment,
    userLikeVideo,
    userRemoveVideo,
    userUpdateVideo,
    resultHandler
};