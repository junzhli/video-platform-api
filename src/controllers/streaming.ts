import express from "express";
import fs from "fs";
import httpStatus from "http-status-codes";
import logger from "../libs/logger";
import mongo from "../libs/mongo";
import { getStat } from "../libs/utils";
import { IResponseErrorMessage } from "./types";

const log = logger("streaming-controller");

const getVideoStreaming = async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
) => {
    try {
        // TODO query input validation
        const { vid } = req.query;

        if (typeof vid !== "string") {
            throw new Error("required parameters not valid");
        }

        const clip = await mongo.findClipById(vid);
        if (!clip) {
            res.status(httpStatus.BAD_REQUEST).json({ error: 0, message: "no such video object available" } as IResponseErrorMessage);
            return;
        }
        
        const path = clip.object;
        const stat = await getStat(path);
        const fileSize = stat.size;
        const range = req.headers.range;
        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] 
            ? parseInt(parts[1], 10)
            : fileSize-1;
            const chunksize = (end-start)+1;
            log.debug("buffering... ", start, end);
            const file = fs.createReadStream(path, {start, end});
            const head = {
            "Content-Range": `bytes ${start}-${end}/${fileSize}`,
            "Accept-Ranges": "bytes",
            "Content-Length": chunksize,
            "Content-Type": "video/mp4",
            };
            res.writeHead(206, head);
            file.pipe(res);
        } else {
            const head = {
            "Content-Length": fileSize,
            "Content-Type": "video/mp4",
            };
            res.writeHead(200, head);
            fs.createReadStream(path).pipe(res);
        }
    } catch (error) {
        next(error);
    }
    
};

export default getVideoStreaming;