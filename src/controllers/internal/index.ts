import express from "express";
import httpStatus from "http-status-codes";

const requestCSRFToken = async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
) => {
    try {
        const token = req.csrfToken();
        res.status(httpStatus.OK).json({
            _csrf: token
        });
    } catch (error) {
        next(error);
    }
};

interface ISessionStatusResponseBody {
    Session: boolean;
    User: boolean;
}

const setSession = async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
) => {
    try {
        // if (!req.session) {
        //     res.status(httpStatus.OK).send({ Session: false, User: false } as ISessionStatusResponseBody);
        //     return
        // }

        if (!req.user) {
            res.status(httpStatus.OK).send({ Session: true, User: false } as ISessionStatusResponseBody);
            return;
        }

        res.status(httpStatus.OK).send({ Session: true, User: true } as ISessionStatusResponseBody);
    } catch (error) {
        next(error);
    }
};

export {
    requestCSRFToken,
    setSession
};