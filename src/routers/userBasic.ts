import bodyParser from "body-parser";
import express from "express";
import { info, logIn, logout, postUploadingAvatar, signUp, updateInfo } from "../controllers/userBasic";
import csrfProtection from "../middlewares/csurf";
import inputValidator from "../middlewares/inputValidator";
import {uploadAvatar} from "../middlewares/multer";
import passport, { isAuthenticated } from "../middlewares/passport";



export default () => {
    const router = express.Router();

    router.use(bodyParser.json());

    // user login with local
    router.post("/login", passport.authenticate("local", {
        failureFlash: true,
    }), logIn);

    // user signup with local
    router.post("/signup", inputValidator.userSignupInput, inputValidator.resultHandler, signUp);

    // user info
    router.get("/info", isAuthenticated, info);

    // user info update
    router.post("/updateInfo", isAuthenticated, csrfProtection, inputValidator.userUpdateInfoInput, inputValidator.resultHandler, updateInfo);

    // user upload avater and set
    router.post("/uploadAvatar", isAuthenticated, csrfProtection, uploadAvatar.single("file"), postUploadingAvatar);

    // user logout
    router.get("/logout", logout);

    return router;
};