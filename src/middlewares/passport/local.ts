import passport from "passport";
import { Strategy } from "passport-local";
import logger from "../../libs/logger";
import mongo from "../../libs/mongo";
import { compare } from "../../libs/utils";

const log = logger("passport-local-middleware");

const init = () => {
    passport.use("local", new Strategy({
        usernameField: "username",
        passwordField: "password",
    }, (username, password, done) => {
        mongo.findUserByUsername(username)
            .then((async userDocs => {
                if (userDocs.length === 0) {
                    return done(null, false, { message: "user not found" } );
                }

                if (userDocs.length > 1) {
                    log.error("Duplicates exist!");
                    return done(new Error("Duplicates exist!"));
                }

                const userDoc = userDocs[0];
                if (!userDoc.password) {
                    return done(null, false, {message: "user password not set"});
                }
                
                if (!await compare(password, userDoc.password)) {
                    return done(null, false, { message: "password not correct" });
                }

                return done(null, userDoc);
            }))
            .catch(err => {
                log.error("Something went wrong when checking if requested user does exist");
                return done(err);
            });
    }));
};

export default init;