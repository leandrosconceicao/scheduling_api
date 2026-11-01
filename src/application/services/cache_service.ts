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