import express from "express";
import Controller from "../controllers/streaming";
import inputValidator from "../middlewares/inputValidator";

export default () => {
    const router = express.Router();
    
    // get video streaming
    router.get("/", inputValidator.userVideoStream, inputValidator.resultHandler, Controller);

    return router;
};
