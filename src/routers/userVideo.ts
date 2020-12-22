import bodyParser from "body-parser";
import express from "express";
import {
    addUserVideoComment,
    createVideo,
    getUserVideoComments,
    recentVideos,
    removeUserVideo,
    removeUserVideoComment,
    updateUserVideo,
    updateUserVideoComment,
    userPreVideoPlayback,
    userPublicVideosSearch, userToggleLikeVideo, userVideos
} from "../controllers/userVideo";
import csrfProtection from "../middlewares/csurf";
import inputValidator from "../middlewares/inputValidator";
import { isAuthenticated } from "../middlewares/passport";



export default () => {
    const router = express.Router();

    router.use(bodyParser.json());

    // // user upload video
    // router.post("/upload", isAuthenticated, csrfProtection, uploadTempClip.single("file"), postUploadingVideo);

    // user create new video
    router.post("/create", isAuthenticated, csrfProtection, inputValidator.userCreateVideo, inputValidator.resultHandler, createVideo);

    // user get video list
    router.get("/list", isAuthenticated, userVideos);

    // TODO: test
    // (public access) recent video list (without private flag)
    router.get("/recent", recentVideos);

    // TODO: test
    // (public access) user video list (without private flag)
    router.get("/search", inputValidator.userSearchPublicVideo, inputValidator.resultHandler, userPublicVideosSearch);

    // (public access) user get videoinfo by id
    router.get("/object/:videoId", inputValidator.userPreVideoPlayback, inputValidator.resultHandler, userPreVideoPlayback);

    // TODO user remove video by id (needs deeper cleanup)
    router.delete("/object/:videoId", isAuthenticated, csrfProtection, inputValidator.userRemoveVideo, inputValidator.resultHandler, removeUserVideo);
    
    // user change video info by id
    router.patch("/object/:videoId", isAuthenticated, csrfProtection, inputValidator.userUpdateVideo, inputValidator.resultHandler, updateUserVideo);

    // (public access) get comment associated with video
    router.get("/object/:videoId/comment", inputValidator.userGetVideoComments, inputValidator.resultHandler, getUserVideoComments);

    // add comment associated with video
    router.post("/object/:videoId/comment", isAuthenticated, csrfProtection, inputValidator.userCreateVideoComment, inputValidator.resultHandler, addUserVideoComment);

    // update comment associated with video
    router.patch("/object/:videoId/comment", isAuthenticated, csrfProtection, inputValidator.userUpdateVideoComment, inputValidator.resultHandler, updateUserVideoComment);

    // remove comment associated with video
    router.delete("/object/:videoId/comment", isAuthenticated, csrfProtection, inputValidator.userRemoveVideoComment, inputValidator.resultHandler, removeUserVideoComment);
    
    // user like/unlike video
    router.post("/object/:videoId/like", isAuthenticated, csrfProtection, inputValidator.userLikeVideo, inputValidator.resultHandler, userToggleLikeVideo);

    return router;
};