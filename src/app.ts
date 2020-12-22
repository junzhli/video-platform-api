import bodyParser from "body-parser";
import flash from "connect-flash";
import connectRedis from "connect-redis";
import express from "express";
import session from "express-session";
import {SessionSecret, UseHttps} from "./libs/config";
import redis from "./libs/redis";
import { badCSRFHandler, errorHandler, notFoundHandler } from "./middlewares/errorHandlers";
import loggerHandler from "./middlewares/loggerHandler";
import passport from "./middlewares/passport";
import publicAPIRouter from "./routers";
import privateAPIRouter from "./routers/internal";

const app = express();

const redisStore = connectRedis(session);
app.set("etag", "strong"); // use strong etag
app.use(loggerHandler);
app.use(session({ 
    secret: SessionSecret || "testKey",
    resave: true,
    saveUninitialized: true,
    store: new redisStore({ client: redis.client, ttl: 86400 }),
    proxy: (UseHttps),
    cookie: {
        secure: (UseHttps),
        httpOnly: true,
        sameSite: "strict",
    }
}));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
app.use(bodyParser.json());

/**
 * RabbitMQ
 */
// const rq = new rabbitMQ();

/**
 * MongoDB
 */
// const mg = new Mongo();

/**
 * Redis
 */
// const rs = new Redis({
//     port: 6379,
//     host: "127.0.0.1"
// });

/**
 * Bitcoin Common APIs setup
 */
// const baseUri = "/btc";
// app.use(baseUri, router(mg, rs, rq));


app.use("/internal-api", privateAPIRouter());

app.use("/api", publicAPIRouter());

// TODO be removed on production
// app.use("/", express.static("statics"));

app.use(badCSRFHandler);
app.use(errorHandler);
app.use(notFoundHandler);

export default app;
