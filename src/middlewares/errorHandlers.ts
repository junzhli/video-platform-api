import express from "express";
import httpStatus from "http-status-codes";
import logger from "../libs/logger";

const log = logger("error-handler-middleware");

const badCSRFHandler = (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err.code !== "EBADCSRFTOKEN") {
        return next(err);
    }

    return res.status(403).json({ message: "invalid token" });
};

const errorHandler = (err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    // operational/technical errors
    log.log({ level: "error", message: "", error: err });
    const sentCode = httpStatus.INTERNAL_SERVER_ERROR;

    return res.status(sentCode).send();
};

const notFoundHandler = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    return res.status(httpStatus.NOT_FOUND).end();
};

export {
    errorHandler,
    notFoundHandler,
    badCSRFHandler
};
