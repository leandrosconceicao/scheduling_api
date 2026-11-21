import cache from "@config/cache";
import { ICacheService } from "@domain";
import { SetOptions } from "redis";
import { injectable, registry, delay } from "tsyringe";

@injectable()
@registry([
    {
        token: "ICacheService",
        useToken: delay(() => CacheService)
    }
])
export class CacheService implements ICacheService {

    removeData = async (key: string): Promise<void> =>{
        try {
            await cache.del(key);
        } catch (e) {

        }
    }

    getData(key: string): Promise<string | null> {
        try {
            return cache.get(key);
        } catch (e) {
            return Promise.resolve(null);
        }
    }
    increment = async (key: string, expirationInSeconds: number): Promise<number> => {
        try {
            const value = await cache.incr(key);

            if (value === 1) await cache.expire(key, expirationInSeconds);

            return value;
        } catch (e) {
            return 0;
        }
    }

    getTtl = async (key: string): Promise<number> => {
        try {
            return await cache.ttl(key);
        } catch (e) {
            return -2;
        }
    }

    setCache = async (key: string, value: any, expirationInSeconds: number): Promise<string | null> => {
        try {
            let opts: SetOptions | undefined = {
            
                expiration: {
                    "type": "EX",
                    value: expirationInSeconds
                }
            }

            const cachedValue = await cache.set(key, value, opts) as string | null;

            return cachedValue;
        } catch (e) {
            return Promise.resolve(null);
        }

    }
}