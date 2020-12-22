import { IMongoConfigOptions } from "./types/mongo";
import { IRabbitMQConfigOptions } from "./types/rabbitmq";
import { IRedisConfigOptions } from "./types/redis";

export const MongoConfig: IMongoConfigOptions = {
    username: process.env.DB_USERNAME || undefined,
    password: process.env.DB_PASSWORD || undefined,
    ipAddr: process.env.DB_IP || undefined,
    port: process.env.DB_PORT || undefined,
};

export const RedisConfig: IRedisConfigOptions = {
    port: Number(process.env.REDIS_POST) || undefined,
    host: process.env.REDIS_HOST || undefined
};

export const RabbitMQConfig: IRabbitMQConfigOptions = {
    serverAddr: process.env.RABBITMQ_IP || undefined,
    serverPort: process.env.RABBITMQ_PORT || undefined,
};

export const SessionSecret: string | undefined = process.env.SESSION_SECRET_KEY || undefined;

export const PublicHost: string = process.env.PUBLIC_HOST || "https://vupload.com";

export const UseHttps: boolean = (process.env.USE_HTTPS === "true" ||
    (process.env.NODE_ENV === "production" && process.env.USE_HTTPS !== "true")) || false;

export const ElasticSearchHost: string = process.env.ELASTIC_HOST || "http://localhost:9200";
