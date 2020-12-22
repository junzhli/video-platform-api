import amqplib from "amqplib";
import {EventEmitter} from "events";
import {updateRecentVideoInRedis} from "./cache";
import { RabbitMQConfig } from "./config";
import logger from "./logger";
import mongo from "./mongo";
import {IQueueMessageRequestVideoConversion, IRabbitMQConfigOptions, IVideoDoneMessage} from "./types/rabbitmq";
// import UserDataListener from "./eventListener";

// const EX_ACCOUNT_RET = "account_ret";
// const QU_ACCOUNT_RET = "account_ret";
const QU_VIDEO_CONVERSION = "video_conversion";
const QU_VIDEO_DONE = "video_done";

const EVENT_TYPE = {
    DONE: "done"
};

const log = logger("rabbitMq");

class RabbitMq {
    private queueVideoDoneEvent: EventEmitter;
    private chan: amqplib.Channel | null;
    private conn: amqplib.Connection | null;
    constructor({
        serverAddr = "127.0.0.1",
        serverPort = "5672"
    }: IRabbitMQConfigOptions) {
        this.chan = null;
        this.conn = null;

        // async operations start here
        (async () => {
            const conn = await amqplib.connect(
                `amqp://${serverAddr}:${serverPort}`
            );
            this.conn = conn;
            log.info("RabbitMq created");
            conn.on("error", err => {
                log.error("Error occurred in connection with RabbitMQ");
                log.log({
                    level: "error",
                    message: "",
                    error: err
                });
            });
            conn.on("close", () => {
                log.warn("Connection with RabbitMQ closed");
            });
            this.chan = await conn.createChannel();
            // /**
            //  * Receive message
            //  */
            // await this.chan.assertExchange(EX_ACCOUNT_RET, "fanout", {
            //     durable: true,
            //     internal: false,
            //     autoDelete: false
            // });
            // await this.chan.assertQueue(QU_ACCOUNT_RET, {
            //     durable: false,
            //     autoDelete: false
            // });
            // await this.chan.bindQueue(QU_ACCOUNT_RET, EX_ACCOUNT_RET, "");
            /**
             * Push message
             */
            this.chan.assertQueue(QU_VIDEO_CONVERSION, {
                exclusive: false,
                durable: true,
                autoDelete: false
            });
            /**
             * Video done queue
             */
            this.chan.assertQueue(QU_VIDEO_DONE, {
                exclusive: false,
                durable: true,
                autoDelete: false
            });
        })().catch((err: any) => {
            log.error("Unable to initialize RabbitMQ class properly");
            log.log({
                level: "error",
                message: "",
                error: err
            });
        });

        this.queueVideoDoneEvent = new EventEmitter();
        setTimeout(() => {
            this.consumeVideoDoneMessage();
            // TODO separate event listener from web service
            this.queueVideoDoneEvent.on(EVENT_TYPE.DONE, async (message: IVideoDoneMessage) => {
                log.info("video conversion done: videoId=" + message.VideoId + " success=" + message.Success);
                // TODO: handle failures
                if (!message.Success) {
                    return;
                }

                const videoDoc = await mongo.findUserVideoById(message.VideoId);
                if (!videoDoc) {
                    log.warn("videoDoc is null: " + message.VideoId);
                    return;
                }

                try {
                    await updateRecentVideoInRedis(videoDoc);
                } catch (error) {
                    log.warn("unable to update recent video for videoId: " + videoDoc._id);
                    log.log({
                        level: "error",
                        message: "",
                        error
                    });
                }

            });
        }, 3000); // start consuming video done message after 3s
    }

    async close() {
        return await this.conn?.close();
    }

    // consumeMessage(command: Task, event: UserDataListener) {
    //     if (this.chan === null) {
    //         throw new Error("RabbitMQ not initialized properly");
    //     }
    //     return this.chan.consume(
    //         EX_ACCOUNT_RET,
    //         message => {
    //             if (message === null) {
    //                 logger.warn(
    //                     `Get null from rabbitmq with params: command => ${command}`
    //                 );
    //                 return;
    //             }

    //             let response: IResponseMessageAll | null = null;
    //             try {
    //                 response = JSON.parse(
    //                     message.content.toString()
    //                 ) as IResponseMessageAll;
    //             } catch (error) {
    //                 logger.error(
    //                     `Failed to parse response from rabbitmq with params: command => ${command}`
    //                 );
    //                 logger.log({ level: "error", message: "", error });
    //             }
    //             if (response === null) {
    //                 logger.warn(`Response value is null`);
    //                 return;
    //             }

    //             if (response.command === command) {
    //                 const key = event.genKey(response.account, command);
    //                 event.emit(key, response);
    //             }
    //         },
    //         {
    //             noAck: true
    //         }
    //     );
    // }

    pushVideoConversionRequest(payload: Buffer) {
        if (this.chan === null) {
            throw new Error("RabbitMQ not initialized properly");
        }
        return this.chan.sendToQueue(QU_VIDEO_CONVERSION, payload);
    }

    private consumeVideoDoneMessage() {
        if (this.chan === null) {
           throw new Error("RabbitMQ not initialized properly");
        }

        log.info("start consuming video done message...");
        this.chan.consume(QU_VIDEO_DONE, (message) => {
            if (!message) {
                return;
            }

            try {
                const data = JSON.parse(message.content.toString()) as IVideoDoneMessage;
                this.queueVideoDoneEvent.emit(EVENT_TYPE.DONE, data);
            } catch (error) {
                log.error("failed to receive and decode message: " + message.content.toString());
            }
        }, {
            noAck: true
        }).catch(error => {
            log.error("unable to start consuming video done message!");
            log.log({
                level: "error",
                message: "",
                error
            });
        });
    }
}

export const genPayloadVideoConversion = (objectId: string, source: string, videoId: string) => {
    const payload: IQueueMessageRequestVideoConversion = {
        object_id: objectId,
        source,
        video_id: videoId
    };
    return Buffer.from(JSON.stringify(payload));
};

export default new RabbitMq(RabbitMQConfig);
