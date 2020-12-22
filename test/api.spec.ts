import { ObjectID } from "mongodb";
import path from "path";
import cookieParser from "set-cookie-parser";
import supertest from "supertest";
import app from "../src/app";
import {PublicHost} from "../src/libs/config";
import mongo, { NUMBERS_IN_PAGE } from "../src/libs/mongo";
import rabbitmq from "../src/libs/rabbitmq";
import redis from "../src/libs/redis";


const HEADER_CONTENT_TYPE = "application/json; charset=utf-8";
const COOKIE_CONNECT_SID = "connect.sid";

const getSetCookies = (response: any) => {
    return cookieParser(response.header["set-cookie"]);
};

const requestCSRFToken = (_session: any) => {
    return new Promise((res, rej) => {
        _session
        .get("/internal-api/requestCSRFToken")
        .then((response: any) => {
            expect(response.status).toBe(200);
            expect(response.headers["content-type"]).toBe(HEADER_CONTENT_TYPE);
            expect(typeof response.body._csrf).toBe("string");
            res(response.body._csrf);
        })
        .catch((error: any) => {
            rej(error);
        });
    });
};

const setSession = (_session: any) => {
    return new Promise((res, rej) => {
        _session
        .get("/internal-api/setSession")
        .then((response: any) => {
            expect(response.status).toBe(200);
            res(response);
        })
        .catch((error: any) => {
            rej(error);
        });
    });
};

const userSignIn = (_session: any, username: string, password: string) => {
    return new Promise<void>((res, rej) => {
        _session
        .post("/api/user/login")
        .send({
            username,
            password
        })
        .set("Content-Type", "application/json")
        .then((response: any) => {
            expect(response.status).toBe(200);
            expect(response.headers["content-type"]).toBe(HEADER_CONTENT_TYPE);
            expect(typeof response.body.message).toBe("string");
            res();
        })
        .catch((error: any) => {
            rej(error);
        });
    });
};



describe("integration testings", () => {
    const testUserEmail = "xxx@xxx.com";
    const testUserName = "user";
    let testUserPassword = "444444444";
    const testUserAvatarFullPath = path.join(process.cwd(), "test/avatar.png");
    const testUserFirstName = "he";
    const testUserLastName = "she";

    beforeAll((done) => {
        setTimeout(async () => {
            if (!mongo.dropDatabase) {
                throw new Error("not connected");
            }
    
            await mongo.dropDatabase();
            done();
        }, 2000); // await the connection created
    });
    
    afterAll(() => {
        return new Promise<void>(async (res, rej) => {
            try {
                await mongo.close();
                await redis.close();
                await rabbitmq.close();
                res();
            } catch (error) {
                rej(error);
            }
        });
    });
    
    describe("Test user basic apis", () => {
        const testUserPassword2 = "444444444";
        
        let currentSessionId: any = null;
        let previousSessionId: any = null;
        let testSession: supertest.SuperTest<supertest.Test>;
    
        beforeAll(() => {
            testSession = supertest.agent(app);
        });
    
        // - user sign up -
        test("it should be ok with new user signup", async () => {
            const response = await supertest(app)
                .post("/api/user/signUp")
                .send({
                    username: testUserName,
                    password: testUserPassword,
                    lastname: testUserLastName,
                    firstname: testUserFirstName,
                    email: testUserEmail,
                })
                .set("Content-Type", "application/json");
            expect(response.status).toBe(201);
            expect(response.headers["content-type"]).toBe(HEADER_CONTENT_TYPE);
            expect(typeof response.body.message).toBe("string");
        });
    
        test("it should be bad request returned as user collision occurred", async () => {
            const response = await supertest(app)
                .post("/api/user/signUp")
                .send({
                    username: testUserName,
                    password: testUserPassword,
                    lastname: testUserLastName,
                    firstname: testUserFirstName,
                    email: testUserEmail,
                })
                .set("Content-Type", "application/json");
            expect(response.status).toBe(400);
            expect(response.headers["content-type"]).toBe(HEADER_CONTENT_TYPE);
            expect(typeof response.body.message).toBe("string");
            expect(typeof response.body.error).toBe("number");
        });
    
        test("it should be bad request returned as user info is not well prepared", async () => {
            const response = await supertest(app)
                .post("/api/user/signUp")
                .send({
                    username: "abcde",
                    password: "1234567890",
                    email: "xxx@xxx.com",
                })
                .set("Content-Type", "application/json");
            expect(response.status).toBe(400);
            expect(response.headers["content-type"]).toBe(HEADER_CONTENT_TYPE);
            expect(typeof response.body.message).toBe("string");
            expect(typeof response.body.error).toBe("number");
        });
    
        test("it should be bad request returned as user info do not fit into the constriant in fields", async () => {
            const response = await supertest(app)
                .post("/api/user/signUp")
                .send({
                    username: "abcde",
                    password: "1234567890",
                    email: 1,
                    lastname: testUserLastName,
                    firstname: testUserFirstName,
                })
                .set("Content-Type", "application/json");
            expect(response.status).toBe(400);
            expect(response.headers["content-type"]).toBe(HEADER_CONTENT_TYPE);
            expect(typeof response.body.message).toBe("string");
            expect(typeof response.body.error).toBe("number");
        });
    
        // -- user log in --
        test("it should be ok as normal user with local credential (email) to log in", async () => {
            const response = await testSession
                .post("/api/user/login")
                .send({
                    username: testUserEmail,
                    password: testUserPassword
                })
                .set("Content-Type", "application/json");
            expect(response.status).toBe(200);
            expect(response.headers["content-type"]).toBe(HEADER_CONTENT_TYPE);
            expect(typeof response.body.message).toBe("string");
            const setCookies = getSetCookies(response);
            previousSessionId = setCookies.find((cookie: any) => cookie.name === COOKIE_CONNECT_SID);
        });
    
        test("it should be ok as normal user with local credential (username) to log in", async () => {
            const response = await testSession
                .post("/api/user/login")
                .send({
                    username: testUserName,
                    password: testUserPassword
                })
                .set("Content-Type", "application/json");
            expect(response.status).toBe(200);
            expect(response.headers["content-type"]).toBe(HEADER_CONTENT_TYPE);
            expect(typeof response.body.message).toBe("string");
            const setCookies = getSetCookies(response);
            currentSessionId = setCookies.find((cookie: any) => cookie.name === COOKIE_CONNECT_SID);
        });
    
        test("it should be true that every login would change its session id", () => {
            expect(currentSessionId).not.toEqual(previousSessionId);
        });
    
        test("it should be invalid as abnormal user who do not pass csrf token would change his/her own basic info", async () => {
            const response = await testSession
                .post("/api/user/updateinfo")
                .send({
                    oldPassword: testUserPassword,
                    newPassword: testUserPassword2
                })
                .set("Content-Type", "application/json");
            expect(response.status).toBe(403);
            expect(response.headers["content-type"]).toBe(HEADER_CONTENT_TYPE);
            expect(typeof response.body.message).toBe("string");
            testUserPassword = testUserPassword2;
        });
    
        test("it should be ok as normal user would change his/her own basic info", async () => {
            const csrfToken = await requestCSRFToken(testSession);
    
            const response = await testSession
                .post("/api/user/updateinfo")
                .send({
                    oldPassword: testUserPassword,
                    newPassword: testUserPassword2,
                    _csrf: csrfToken
                })
                .set("Content-Type", "application/json");
            expect(response.status).toBe(200);
            expect(response.headers["content-type"]).toBe(HEADER_CONTENT_TYPE);
            expect(typeof response.body.message).toBe("string");
        });
    
        test("it should be invalid as abnormal user who do not pass csrf token would upload avatar", async () => {
            const response = await testSession
                .post("/api/user/uploadAvatar")
                .attach("file", testUserAvatarFullPath);
            expect(response.status).toBe(403);
            expect(response.headers["content-type"]).toBe(HEADER_CONTENT_TYPE);
            expect(typeof response.body.message).toBe("string");
        });
    
        test("it should be ok as normal user would upload avatar", async () => {
            const csrfToken = await requestCSRFToken(testSession);
    
            const response = await testSession
                .post("/api/user/uploadAvatar")
                .query({ _csrf: csrfToken })
                .attach("file", testUserAvatarFullPath);
                
            expect(response.status).toBe(200);
            expect(response.headers["content-type"]).toBe(HEADER_CONTENT_TYPE);
            expect(typeof response.body.message).toBe("string");
        });
    
        test("it should be ok as normal user would fetch basic info", async () => {
            const response = await testSession
                .get("/api/user/info");
            
            expect(response.status).toBe(200);
            expect(response.headers["content-type"]).toBe(HEADER_CONTENT_TYPE);
            expect(typeof response.body.id).toBe("string");
            expect(response.body.firstname).toEqual(testUserFirstName);
            expect(response.body.lastname).toEqual(testUserLastName);
            expect(response.body.fullname).toEqual(`${testUserFirstName} ${testUserLastName}`);
            expect(response.body.email).toEqual(testUserEmail);
            expect(typeof response.body.avatar).toBe("string");
            expect(response.body.authMethod).toEqual(["local"]);
        });
    
        test("it should be ok as normal user would log out", async () => {
            const response = await testSession
                .get("/api/user/logout");
            
            expect(response.status).toBe(302);
            expect(response.redirect).toBe(true);
            expect(response.redirects.includes(PublicHost));
        });
    
        test("it should be unauthorized as logged-out user would fetch basic info", async () => {
            const response = await testSession
                .get("/api/user/info");
            
            expect(response.status).toBe(401);
            expect(response.body).toEqual({});
        });
    });
    
    describe("Test user video apis", () => {
        const uploads = 30;
        const testUserVideoFullPath = path.join(process.cwd(), "test/video.mp4");
        let testUserVideoTitle = "Test video";
        let testUserVideoIsPublic = false;
        const testUserVideoTags = ["EDUCATION"];
        let loggedSession: supertest.SuperTest<supertest.Test>;
        let nonloggedSession: supertest.SuperTest<supertest.Test>;
        const uploadedClipObjectIds: any[] = [];
        const uploadedVideoObjectIds: any[] = [];
        const definitions = ["FullHD", "HD", "SD"];
        let testStreamingId: any;
        let commentContent = "This is too goood!!!!";
        let testCommentIdLast: any;
        let testCommentIdRecent: any;
        const submittedVideoComments: any[] = [];
        const additionalComments = 2;
        const numberOfComments = NUMBERS_IN_PAGE + additionalComments;

        beforeAll(async () => {
            loggedSession = supertest.agent(app);
            await userSignIn(loggedSession, testUserName, testUserPassword);
            nonloggedSession = supertest.agent(app);
        });
    
        // - video upload -
        test("it should be bad request with user uploading an invalid file", async () => {
            const csrfToken = await requestCSRFToken(loggedSession);
    
            const response = await loggedSession
                .post("/api/video/upload")
                .query({ _csrf: csrfToken })
                .attach("file", testUserAvatarFullPath);
            expect(response.status).toBe(400);
            expect(response.headers["content-type"]).toBe(HEADER_CONTENT_TYPE);
            expect(typeof response.body.error).toBe("number");
            expect(typeof response.body.message).toBe("string");
        });

        for (let i = 0; i < uploads; i++) {
            test("it should be ok with user uploading a single clip", async () => {
                const csrfToken = await requestCSRFToken(loggedSession);
        
                const response = await loggedSession
                    .post("/api/video/upload")
                    .query({ _csrf: csrfToken })
                    .attach("file", testUserVideoFullPath);
                expect(response.status).toBe(200);
                expect(response.headers["content-type"]).toBe(HEADER_CONTENT_TYPE);
                expect(typeof response.body.objectId).toBe("string");
                uploadedClipObjectIds.push(response.body.objectId);
            });
        }
        
        test("it should be bad request with user creating an invalid video section with uploaded clip", async () => {
            const csrfToken = await requestCSRFToken(loggedSession);
    
            const validClipObjectId = uploadedClipObjectIds[0];
            const response = await loggedSession
                .post("/api/video/create")
                .send({
                    objectId: validClipObjectId,
                    tags: ["BAD_TAG"],
                    _csrf: csrfToken
                });
                expect(response.status).toBe(400);
                expect(response.headers["content-type"]).toBe(HEADER_CONTENT_TYPE);
                expect(typeof response.body.error).toBe("number");
                expect(typeof response.body.message).toBe("string");
        });

        test("it should be bad request with user creating a video section with invalid uploaded clip", async () => {
            const csrfToken = await requestCSRFToken(loggedSession);
    
            const response = await loggedSession
                .post("/api/video/create")
                .send({
                    objectId: "0".repeat(24),
                    title: testUserVideoTitle,
                    tags: testUserVideoTags,
                    _csrf: csrfToken
                });
            expect(response.status).toBe(400);
            expect(response.headers["content-type"]).toBe(HEADER_CONTENT_TYPE);
            expect(typeof response.body.error).toBe("number");
            expect(typeof response.body.message).toBe("string");
        });

        for (let i = 0; i < uploads; i++) {
            test("it should be ok with user creating a video section with uploaded clip", async () => {
                const csrfToken = await requestCSRFToken(loggedSession);
        
                const response = await loggedSession
                    .post("/api/video/create")
                    .send({
                        objectId: uploadedClipObjectIds[i],
                        title: testUserVideoTitle,
                        tags: testUserVideoTags,
                        _csrf: csrfToken
                    })
                    .set("Content-Type", "application/json");
                expect(response.status).toBe(200);
                expect(response.headers["content-type"]).toBe(HEADER_CONTENT_TYPE);
                expect(typeof response.body.objectId).toBe("string");
                uploadedVideoObjectIds.push(response.body.objectId);
            });
        }

        test("it should be ok to set intented session requested by internal service", async () => {
            const response = await setSession(nonloggedSession);
            const setCookies = getSetCookies(response);
            const found = setCookies.find((cookie) => cookie.name === COOKIE_CONNECT_SID);
            expect(typeof found).toBe("object");
        });

        test("it should be ok to get csrf token with unlogged session", async () => {
            const csrfToken = await requestCSRFToken(nonloggedSession);
            expect(typeof csrfToken).toBe("string");
        });

        test("it should be ok with requesting a list of user videoes", async () => {
            for (let i = 0; i < uploads; i++) {
                const tmpClip = await mongo.findTempClip(uploadedClipObjectIds[i]);
                if (!tmpClip) {
                    throw new Error("should have temp clip record in database");
                }
                tmpClip.state = "Finished";
                await mongo.updateTempClip(tmpClip);

                const video = await mongo.findUserVideoById(uploadedVideoObjectIds[i]);
                if (!video) {
                    throw new Error("should have video record in database");
                }
                video.available = true;
                video.updated_timestamp = new Date();
                video.duration = 30;
                video.clips = [
                    {
                        _id: new ObjectID(),
                        definition: "FullHD",
                        object: testUserVideoFullPath,
                    },
                    {
                        _id: new ObjectID(),
                        definition: "HD",
                        object: testUserVideoFullPath
                    },
                    {
                        _id: new ObjectID(),
                        definition: "SD",
                        object: testUserVideoFullPath
                    }
                ];
                await mongo.updateVideo(video);
            }

            const response = await loggedSession
                .get("/api/video/list");
            
            expect(response.status).toBe(200);
            expect(response.headers["content-type"]).toBe(HEADER_CONTENT_TYPE);
            expect(Array.isArray(response.body)).toBe(true);

            response.body.forEach((entity: any) => {
                expect(typeof entity.user).toBe("object");
                expect(typeof entity.user.fullname).toBe("string");
                expect(typeof entity.user.avatar).toBe("string");
                expect(typeof entity.videoId).toBe("string");
                expect(typeof entity.title).toBe("string");
                expect(typeof entity.available).toBe("boolean");
                expect(typeof entity.time).toBe("number");
                expect(Array.isArray(entity.tags)).toBe(true);
                expect(typeof entity.duration).toBe("number");
                expect(entity.isPublic).toBe(testUserVideoIsPublic);
            });
        });

        test("it should be bad request for getting videoplayback info in beginning phase with invalid video id", async () => {
            const invalidVideoId = "111";
            const response = await loggedSession
                .get("/api/video/object/" + invalidVideoId);
            
            expect(response.status).toBe(400);
            expect(response.headers["content-type"]).toBe(HEADER_CONTENT_TYPE);
            expect(typeof response.body.error).toBe("number");
            expect(typeof response.body.message).toBe("string");
        });

        test("it should be ok with updating video info", async () => {
            const csrfToken = await requestCSRFToken(loggedSession);
            const videoObjectId = uploadedVideoObjectIds[0];
            const testUserVideoTitle2 = "Hello world";
            const testUserVideoIsPublic2 = true;
            
            let response = await loggedSession
                .patch("/api/video/object/" + videoObjectId)
                .send({
                    title: testUserVideoTitle2,
                    isPublic: testUserVideoIsPublic2,
                    _csrf: csrfToken
                });
            
            expect(response.status).toBe(200);
            expect(response.headers["content-type"]).toBe(HEADER_CONTENT_TYPE);
            expect(typeof response.body.message).toBe("string");
            testUserVideoTitle = testUserVideoTitle2;
            testUserVideoIsPublic = testUserVideoIsPublic2;
            
            response = await loggedSession
                .get("/api/video/object/" + videoObjectId);
            
            expect(response.status).toBe(200);
            expect(response.headers["content-type"]).toBe(HEADER_CONTENT_TYPE);
            expect(response.body.title).toEqual(testUserVideoTitle2);
            expect(response.body.isPublic).toEqual(testUserVideoIsPublic2);
        });

        test("it should be ok with getting videoplayback info in beginning phase", async () => {
            const videoObjectId = uploadedVideoObjectIds[0];
            const response = await loggedSession
                .get("/api/video/object/" + videoObjectId);
            
            expect(response.status).toBe(200);
            expect(response.headers["content-type"]).toBe(HEADER_CONTENT_TYPE);
            expect(typeof response.body.title).toBe("string");
            expect(response.body.views).toBe(2);
            expect(typeof response.body.duration).toBe("number");
            expect(typeof response.body.time).toBe("number");
            expect(Array.isArray(response.body.tags)).toBe(true);
            expect(typeof response.body).toBe("object");
            Object.entries<any>(response.body.playbacks).forEach(([key, value]) => {
                expect(definitions.includes(key)).toBe(true);
                expect(typeof value).toBe("object");
                expect(typeof value.objectId).toBe("string");
            });
            testStreamingId = response.body.playbacks.HD.object;
        });

        test("it should be ok with buffering the requested video clip id", (done) => {
            loggedSession
                .get("/api/videoplayback/")
                .query({ vid: testStreamingId })
                .buffer()
                .parse((res, callback) => {
                    res.setEncoding("binary");
                    let data = "";
                    res.on("data", (chunk) => {
                        data += chunk;
                    });
                    res.on("end", () => {
                        callback(null, Buffer.from(data, "binary"));
                    });
                })
                .end((err, res) => {
                    if (err) {
                        done(err);
                        return;
                    }
                    done();
                });
        });

        // TODO 
        // test scope: failure on creation duo to unauthorized problem - e.g. user not logged in, user not matching the comment's owner
        //             also video top comments existing in video info must also be checked
        for (let i = 0; i < numberOfComments; i++) {
            test("it should be ok with adding comments on processedVideo, and be cached on video docs's top 10 comments", async () => {
                const videoObjectId = uploadedVideoObjectIds[0];
                const csrfToken = await requestCSRFToken(loggedSession);
                
                let response = await loggedSession
                    .post(`/api/video/object/${videoObjectId}/comment`)
                    .send({
                        content: commentContent,
                        _csrf: csrfToken,
                    })
                    .set("Content-Type", "application/json");
                
                expect(response.status).toBe(200);
                expect(response.headers["content-type"]).toBe(HEADER_CONTENT_TYPE);
                expect(typeof response.body.objectId).toBe("string");
                const submittedCommentId = response.body.objectId;
                submittedVideoComments.push(submittedCommentId);
                if (i === numberOfComments - 1) {
                    testCommentIdRecent = response.body.objectId;
                }
                if (i === 0) {
                    testCommentIdLast = response.body.objectId;
                }
                

                response = await loggedSession
                .get(`/api/video/object/${videoObjectId}`);
                expect(response.status).toBe(200);
                expect(response.headers["content-type"]).toBe(HEADER_CONTENT_TYPE);
                expect(response.body.comments).toBe(i + 1);

                if (i < NUMBERS_IN_PAGE) {
                    expect(Array.isArray(response.body.topComments)).toBe(true);
                    const foundComment = response.body.topComments.find((comment: any) => comment.id === submittedCommentId);
                    expect(typeof foundComment).toBe("object");
                    expect(typeof foundComment.userId).toBe("string");
                    expect(typeof foundComment.content).toBe("string"); 
                    expect(foundComment.edit).toBe(false);
                }
            });
        }

        test("it should be ok with making pagination queries for video comments", async () => {
            const videoObjectId = uploadedVideoObjectIds[0];
            const expectedPages = Math.ceil(numberOfComments / NUMBERS_IN_PAGE);

            let lastCommentId;
            for (let i = 1; i <= expectedPages; i++) {
                const response = await loggedSession
                .get(`/api/video/object/${videoObjectId}/comment`)
                .query({ skipped: lastCommentId });

                expect(response.status).toBe(200);
                expect(response.headers["content-type"]).toBe(HEADER_CONTENT_TYPE);
                expect(Array.isArray(response.body)).toBe(true);
                response.body.forEach((comment: any, index: number) => {
                    expect(typeof comment.id).toBe("string");
                    lastCommentId = comment.id;
                    const cursor = (submittedVideoComments.length - 1) - ((i - 1) * NUMBERS_IN_PAGE + index);
                    expect(comment.id).toEqual(submittedVideoComments[cursor]);
                    expect(typeof comment.userId).toBe("string");
                    expect(typeof comment.content).toBe("string");
                    expect(comment.edit).toBe(false);
                });
            }
            
        });
        
        test("it should be ok with editing comments on his/her own comment, and be available on comment fetch api", async () => {
            const csrfToken = await requestCSRFToken(loggedSession);
            const videoObjectId = uploadedVideoObjectIds[0];
            commentContent = "It's all the way best";
            


            // recent comment
            let response = await loggedSession
                .patch(`/api/video/object/${videoObjectId}/comment`)
                .send({
                    objectId: testCommentIdRecent,
                    content: commentContent,
                    _csrf: csrfToken,
                })
                .set("Content-Type", "application/json");
            expect(response.status).toBe(200);
            expect(response.headers["content-type"]).toBe(HEADER_CONTENT_TYPE);
            expect(typeof response.body.message).toBe("string");

            response = await loggedSession
                .get(`/api/video/object/${videoObjectId}/comment`);
            expect(response.status).toBe(200);
            expect(response.headers["content-type"]).toBe(HEADER_CONTENT_TYPE);
            expect(Array.isArray(response.body)).toBe(true);
            let foundComment = response.body.find((comment: any) => comment.id === testCommentIdRecent);
            expect(typeof foundComment).toBe("object");
            expect(typeof foundComment.userId).toBe("string");
            expect(typeof foundComment.content).toBe("string");
            expect(foundComment.edit).toBe(true);
            expect(foundComment.content).toEqual(escape(commentContent));
            const lastCommentId = response.body[NUMBERS_IN_PAGE - 1].id;

            // last comment
            response = await loggedSession
                .patch(`/api/video/object/${videoObjectId}/comment`)
                .send({
                    objectId: testCommentIdLast,
                    content: commentContent,
                    _csrf: csrfToken,
                })
                .set("Content-Type", "application/json");
            expect(response.status).toBe(200);
            expect(response.headers["content-type"]).toBe(HEADER_CONTENT_TYPE);
            expect(typeof response.body.message).toBe("string");

            response = await loggedSession
                .get(`/api/video/object/${videoObjectId}/comment`)
                .query({ skipped: lastCommentId });
            expect(response.status).toBe(200);
            expect(response.headers["content-type"]).toBe(HEADER_CONTENT_TYPE);
            expect(Array.isArray(response.body)).toBe(true);
            foundComment = response.body.find((comment: any) => comment.id === testCommentIdLast);
            expect(typeof foundComment).toBe("object");
            expect(typeof foundComment.userId).toBe("string");
            expect(typeof foundComment.content).toBe("string");
            expect(foundComment.edit).toBe(true);
            expect(foundComment.content).toEqual(escape(commentContent));
        });

        test("it should be ok with deleting comments on his/her own comment, and be unavailable on comment fetch api", async () => {
            const csrfToken = await requestCSRFToken(loggedSession);
            const videoObjectId = uploadedVideoObjectIds[0];
            commentContent = "It's all the way best";

            // recent comment
            let response = await loggedSession
                .delete(`/api/video/object/${videoObjectId}/comment`)
                .send({
                    objectId: testCommentIdRecent,
                    content: commentContent,
                    _csrf: csrfToken,
                })
                .set("Content-Type", "application/json");
            expect(response.status).toBe(200);
            expect(response.headers["content-type"]).toBe(HEADER_CONTENT_TYPE);
            expect(typeof response.body.message).toBe("string");

            response = await loggedSession
                .get(`/api/video/object/${videoObjectId}/comment`);
            expect(response.status).toBe(200);
            expect(response.headers["content-type"]).toBe(HEADER_CONTENT_TYPE);
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBe(NUMBERS_IN_PAGE);
            let foundComment = response.body.find((comment: any) => comment.id === testCommentIdRecent);
            expect(foundComment).toBe(undefined);
            let lastCommentId = response.body[NUMBERS_IN_PAGE - 1].id;

            response = await loggedSession
                .get(`/api/video/object/${videoObjectId}/comment`)
                .query({ skipped: lastCommentId });
            expect(response.status).toBe(200);
            expect(response.headers["content-type"]).toBe(HEADER_CONTENT_TYPE);
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBe(additionalComments - 1);
            foundComment = response.body.find((comment: any) => comment.id === testCommentIdRecent);
            expect(foundComment).toBe(undefined);

            // last comment
            response = await loggedSession
                .delete(`/api/video/object/${videoObjectId}/comment`)
                .send({
                    objectId: testCommentIdLast,
                    content: commentContent,
                    _csrf: csrfToken,
                })
                .set("Content-Type", "application/json");
            expect(response.status).toBe(200);
            expect(response.headers["content-type"]).toBe(HEADER_CONTENT_TYPE);
            expect(typeof response.body.message).toBe("string");

            response = await loggedSession
                .get(`/api/video/object/${videoObjectId}/comment`);
            expect(response.status).toBe(200);
            expect(response.headers["content-type"]).toBe(HEADER_CONTENT_TYPE);
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBe(NUMBERS_IN_PAGE);
            foundComment = response.body.find((comment: any) => comment.id === testCommentIdLast);
            expect(foundComment).toBe(undefined);
            lastCommentId = response.body[NUMBERS_IN_PAGE - 1].id;

            response = await loggedSession
                .get(`/api/video/object/${videoObjectId}/comment`)
                .query({ skipped: lastCommentId });
            expect(response.status).toBe(404);
            expect(response.headers["content-type"]).toBe(HEADER_CONTENT_TYPE);
            expect(typeof response.body).toBe("object");
            expect(typeof response.body.error).toBe("number");
            expect(typeof response.body.message).toBe("string");
        });

        // TODO: like, count views
        // test("it should be ok with editing comments on his/her own comment, and be available on comment fetch api", async () => {
        //     const csrfToken = await requestCSRFToken(loggedSession);
        //     const videoObjectId = uploadedVideoObjectIds[0];
        //     const lastPageIndex = Math.ceil(numberOfComments / NUMBERS_IN_PAGE);
        //     commentContent = "It's all the way best";
        //
        //     // last comment
        //     let response = await loggedSession
        //         .patch(`/api/video/object/${videoObjectId}/comment`)
        //         .send({
        //             objectId: testCommentIdLast,
        //             content: commentContent,
        //             _csrf: csrfToken,
        //         })
        //         .set("Content-Type", "application/json");
        //     expect(response.status).toBe(200);
        //     expect(response.headers["content-type"]).toBe(HEADER_CONTENT_TYPE);
        //     expect(typeof response.body.message).toBe("string");
        //
        //     response = await loggedSession
        //         .get(`/api/video/object/${videoObjectId}/comment`)
        //         .query({ p: lastPageIndex });
        //     expect(response.status).toBe(200);
        //     expect(response.headers["content-type"]).toBe(HEADER_CONTENT_TYPE);
        //     expect(Array.isArray(response.body)).toBe(true);
        //     let foundComment = response.body.find((comment: any) => comment.id === testCommentIdLast);
        //     expect(typeof foundComment).toBe("object");
        //     expect(typeof foundComment.userId).toBe("string");
        //     expect(typeof foundComment.content).toBe("string");
        //     expect(foundComment.edit).toBe(true);
        //     expect(foundComment.content).toEqual(escape(commentContent));
        //
        //     // recent comment
        //     response = await loggedSession
        //         .patch(`/api/video/object/${videoObjectId}/comment`)
        //         .send({
        //             objectId: testCommentIdRecent,
        //             content: commentContent,
        //             _csrf: csrfToken,
        //         })
        //         .set("Content-Type", "application/json");
        //     expect(response.status).toBe(200);
        //     expect(response.headers["content-type"]).toBe(HEADER_CONTENT_TYPE);
        //     expect(typeof response.body.message).toBe("string");
        //
        //     response = await loggedSession
        //         .get(`/api/video/object/${videoObjectId}/comment`)
        //         .query({ p: 1 });
        //     expect(response.status).toBe(200);
        //     expect(response.headers["content-type"]).toBe(HEADER_CONTENT_TYPE);
        //     expect(Array.isArray(response.body)).toBe(true);
        //     foundComment = response.body.find((comment: any) => comment.id === testCommentIdRecent);
        //     expect(typeof foundComment).toBe("object");
        //     expect(typeof foundComment.userId).toBe("string");
        //     expect(typeof foundComment.content).toBe("string");
        //     expect(foundComment.edit).toBe(true);
        //     expect(foundComment.content).toEqual(escape(commentContent));
        // });
    });
});