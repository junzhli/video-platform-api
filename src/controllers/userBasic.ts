import express from "express";
import httpStatus from "http-status-codes";
import { Error } from "mongoose";
import {loadUserInfoInRedis} from "../libs/cache";
import {PublicHost} from "../libs/config";
import logger from "../libs/logger";
import mongo from "../libs/mongo";
import redis from "../libs/redis";
import { compare, genSalt, hash, readFile, removeFile } from "../libs/utils";
import { ACCECPTED_PICTURE_TYPES, checkFileAuthenticity } from "../middlewares/multer";
import { IUser, IUserDoc } from "../models/types/user";
import userModel from "../models/user";
import { IResponseBodyGeneralMessage, IResponseBodyUserInfo, IResponseErrorMessage } from "./types";

const log = logger("user-controller");

const signUp = async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
) => {
    try {
        const { email, lastname, firstname, username, password } = req.body;
        const userDocs = await mongo.findUserByUsername(email);
        let salt;
        if (userDocs.length !== 0) {
            const user = userDocs[0];
            if (user.authMethod.includes("local")) {
                const errMessage: IResponseErrorMessage = { error: 1, message: "user already registered"};
                res.status(httpStatus.BAD_REQUEST).json(errMessage);
            } else {
                salt = await genSalt();
                user.username = username;
                user.password = await hash(password, salt);
                user.firstname = firstname;
                user.lastname = lastname;
                user.authMethod.push("local");
                await mongo.updateUser(user);
                const updateMessage: IResponseBodyGeneralMessage = { message: "user updated"};
                res.status(httpStatus.CREATED).json(updateMessage);
            }
            return;
        }

        
        salt = await genSalt();
        const newUser: IUser = {
            username,
            password: await hash(password, salt),
            email,
            lastname,
            firstname,
            authMethod: [ "local" ]
        };

        try {
            await mongo.createUser(newUser);
        } catch (error) {
            if (error instanceof Error.ValidationError) {
                log.log({ level: "error", message: "", error });
                const errMessage: IResponseErrorMessage = { error: 2, message: "input validation failed" };
                res.status(httpStatus.BAD_REQUEST).json(errMessage);
                return;
            } else {
                throw error;
            }
        }
        
        res.status(httpStatus.CREATED).json({ message: "user created"} as IResponseBodyGeneralMessage);
    } catch (error) {
        next(error);
    }
};



// use credential to auth user for login, if success we send session as cookie back to client
const logIn = async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
) => {
    try {
        refreshSession(req, res, next);
    } catch (error) {
        next(error);
    }
    
};

const refreshSession = (req: express.Request,
    res: express.Response,
    next: express.NextFunction
) => {
    if (!req.session) {
        throw new Error("session is undefined");
    }

    const lastPassport = (req.session as any).passport;
    req.session.regenerate(err => {
        if (err) {
            next(err);
            return;
        }

        (req.session as any).passport = lastPassport;
        req.session.save(err2 => {
            if (err2) {
                next(err2);
                return;
            }
            
            res.status(httpStatus.OK).json({ message: "user logged in"} as IResponseBodyGeneralMessage);
        });
    });
};

const info = async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
) => {
    try {
        if (!req.user) {
            throw new Error("no user passed in");
        }
    
        const { _id, username, firstname, lastname, email, authMethod, avatar } = req.user as IUserDoc;

        const userId = _id.toHexString();
        await loadUserInfoInRedis(userId);
        const fullname = await redis.get(userModel.RedisKey.UserFullName(userId));

        const retUser: IResponseBodyUserInfo = {
            id: userId,
            username,
            firstname,
            lastname,
            fullname: fullname || "",
            email,
            avatar,
            authMethod
        };
        res.status(httpStatus.OK).json(retUser);
    } catch (error) {
        next(error);
    }
    
};

const logout = async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
) => {
    try {
        req.logOut();
        res.redirect(PublicHost);
    } catch (error) {
        next(error);
    }
};

const updateInfo = async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
) => {
    try {
        if (!req.user) {
            throw new Error("no user passed in");
        }
    
        if (!req.body.firstname && !req.body.lastname && !req.body.oldPassword && !req.body.newPassword) {
            res.status(httpStatus.BAD_REQUEST).json({ error: 0, message: "invalid request" } as IResponseErrorMessage);
            return;
        }
    
        const requestedUpdate = {
            firstname: req.body.firstname,
            lastname: req.body.lastname,
            oldPassword: req.body.oldPassword,
            newPassword: req.body.newPassword,
        };
    
        const user = req.user as IUserDoc;
        user.firstname = (requestedUpdate.firstname) ? requestedUpdate.firstname : user.firstname;
        user.lastname = (requestedUpdate.lastname) ? requestedUpdate.lastname : user.lastname;
    
        if (user.password && req.body.oldPassword && 
            requestedUpdate.newPassword && await compare(requestedUpdate.oldPassword, user.password)) {
            const salt = await genSalt();
            user.password = await hash(requestedUpdate.newPassword, salt);
        }
    
        await mongo.updateUser(user);
        res.status(httpStatus.OK).json({ message: "update successfully" } as IResponseBodyGeneralMessage);
    } catch (error) {
        next(error);
    }
    
};

// TODO upload to s3, another storage (e.g. mongodb, in form of hex string, base64)

const postUploadingAvatar = async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
) => {
    try {
        if (!req.user) {
            throw new Error("no user passed in");
        }
    
        if (!req.file) {
            res.status(httpStatus.BAD_REQUEST).json({ error: 0, message: "Bad file" } as IResponseErrorMessage);
            return;
        }
    
        try {
            if (!await checkFileAuthenticity(req.file, ACCECPTED_PICTURE_TYPES)) {
                res.status(httpStatus.BAD_REQUEST).json({ error: 0, message: "Bad file" } as IResponseErrorMessage);
                return;
            }
        
            const user = req.user as IUserDoc;
            user.avatar = await readFile(req.file.path, { encoding: "base64" });
            await mongo.updateUser(user);
            res.status(httpStatus.OK).send({ message: "Upload successfully" } as IResponseBodyGeneralMessage);
        } catch(error) {
            next(error);
        } finally {
            await removeFile(req.file.path);
        }
    } catch (error) {
        next(error);
    }
};

export {
    signUp,
    logIn,
    info,
    logout,
    updateInfo,
    postUploadingAvatar
};