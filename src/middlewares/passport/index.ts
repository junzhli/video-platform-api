import express from "express";
import httpStatus from "http-status-codes";
import passport from "passport";
import logger from "../../libs/logger";
import mongo from "../../libs/mongo";
import { IUserDoc } from "../../models/types/user";
import local from "./local";

const log = logger("passport-middleware");

passport.serializeUser((user: IUserDoc, done) => {
    done(null, user.email);
});

passport.deserializeUser(async (email: string, done) => {
    try {
        const user = await mongo.findUserByUsername(email);
        done(null, user[0]);
    } catch (error) {
        log.error("unable to deserialize user info by email");
        done(error);
    }
});

local();

const isAuthenticated = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.isUnauthenticated()) {
        res.status(httpStatus.UNAUTHORIZED).end();
        return;
    }
    next();
};

export {
    isAuthenticated
};

export default passport;