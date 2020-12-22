import express from "express";
import userBasic from "./userBasic";
import userVideo from "./userVideo";
import userVideoUpload from "./userVideoUpload";
import videoStreaming from "./videoStreaming";

export default () => {
    const router = express.Router();

    // user
    router.use("/user", userBasic());

    // user video
    router.use("/video", userVideo());

    // user video upload
    router.use("/video/upload", userVideoUpload());

    // video streaming
    router.use("/videoplayback", videoStreaming());

    return router;
};
