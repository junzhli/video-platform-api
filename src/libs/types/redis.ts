import { RedisClient } from "redis";

export interface IRedisConfigOptions {
    host?: string;
    port?: number;
}

export interface IRedis {
    client: RedisClient;
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string) => Promise<unknown>;
    incr:(key: string) => Promise<number>;
    setnx: (key: string, value: string) => Promise<number>;
    getset: (key: string, value: string) => Promise<string>;
    exists: (key: string) => Promise<number>;
    decr: (key: string) => Promise<number>;
    expire: (key: string, seconds: number) => Promise<number>;
    close: () => Promise<"OK">;
    lpush: (key: string, value: string) => Promise<number>;
    rpush: (key: string, value: string) => Promise<number>;
    ltrim: (key: string, from: number, to: number) => Promise<"OK">;
    lrange: (key: string, from: number, to: number) => Promise<string[]>;
    lrem: (key: string, count: number, value: string) => Promise<number>;
    llen: (key: string) => Promise<number>;
    sadd: (key: string, value: string) => Promise<number>;
    srem: (key: string, value: string) => Promise<number>;
    sismember: (key: string, value: string) => Promise<number>;
}