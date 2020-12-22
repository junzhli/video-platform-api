import redis, { RedisClient} from "redis";
import { promisify } from "util"; 
import { RedisConfig } from "./config";
import logger from "./logger";
import { IRedis, IRedisConfigOptions } from "./types/redis";

const log = logger("redis");

export const REDIS_NIL = "null";

class Redis implements IRedis {
    client: RedisClient;
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string, mode?: string, duration?: number, flag?: string) => Promise<unknown>;
    close: () => Promise<"OK">;
    incr:(key: string) => Promise<number>;
    setnx: (key: string, value: string) => Promise<number>;
    exists: (key: string) => Promise<number>;
    decr: (key: string) => Promise<number>;
    expire: (key: string, seconds: number) => Promise<number>;
    getset: (key: string, value: string) => Promise<string>;
    lpush: (key: string, value: string) => Promise<number>;
    rpush: (key: string, value: string) => Promise<number>;
    ltrim: (key: string, from: number, to: number) => Promise<"OK">;
    lrange: (key: string, from: number, to: number) => Promise<string[]>;
    lrem: (key: string, count: number, value: string) => Promise<number>;
    llen: (key: string) => Promise<number>;
    sadd: (key: string, value: string) => Promise<number>;
    srem: (key: string, value: string) => Promise<number>;
    sismember: (key: string, value: string) => Promise<number>;

    constructor({ 
        host = "127.0.0.1",
        port = 6379
     }: IRedisConfigOptions) {
        this.client = redis.createClient({ host, port });
        
        this.client.on("connect", () => {
            log.info("Redis connected");
        });
        this.client.on("error", err => {
            log.error("Error occurred in connection with Redis");
            log.log({
                level: "error",
                message: "",
                error: err
            });
        });
        this.client.on("reconnecting", () => {
            log.info("Redis reconnecting");
        });
        this.client.on("end", () => {
            log.info("Redis disconnected");
        });

        this.get = promisify(this.client.get).bind(this.client);
        this.set = promisify(this.client.set).bind(this.client);
        this.close = promisify(this.client.quit).bind(this.client);
        this.incr = promisify(this.client.incr).bind(this.client);
        this.setnx = promisify(this.client.setnx).bind(this.client);
        this.exists = promisify(this.client.exists).bind(this.client);
        this.decr = promisify(this.client.decr).bind(this.client);
        this.expire = promisify(this.client.expire).bind(this.client);
        this.getset = promisify(this.client.getset).bind(this.client);
        this.lpush = promisify(this.client.lpush).bind(this.client);
        this.rpush = promisify(this.client.rpush).bind(this.client);
        this.ltrim = promisify(this.client.ltrim).bind(this.client);
        this.lrange = promisify(this.client.lrange).bind(this.client);
        this.lrem = promisify(this.client.lrem).bind(this.client);
        this.llen = promisify(this.client.llen).bind(this.client);
        this.sadd = promisify(this.client.sadd).bind(this.client);
        this.srem = promisify(this.client.srem).bind(this.client);
        this.sismember = promisify(this.client.sismember).bind(this.client);
    }
}

export default new Redis(RedisConfig);
