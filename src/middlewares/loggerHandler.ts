import express from "express";
import logger from "../libs/logger";

const log = logger("logger-handler-middleware");

const loggerHandler = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    log.info("Request handling: " + req.method + " " + req.url);
    next();
};

export default loggerHandler;
