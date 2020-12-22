
import express from "express";
import {
    postUploadingVideo,
} from "../controllers/userVideo";
import csrfProtection from "../middlewares/csurf";
import {uploadTempClip} from "../middlewares/multer";
import { isAuthenticated } from "../middlewares/passport";



export default () => {
    const router = express.Router();

    // user upload video
    router.post("/", isAuthenticated, csrfProtection, uploadTempClip.single("file"), postUploadingVideo);

    return router;
};