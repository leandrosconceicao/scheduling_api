export interface ICacheService {
    setCache(key: string, value: any, expirationInSeconds: number) : Promise<string | null>;

    getData(key: string) : Promise<string | null>;

    removeData(key: string) : Promise<void>;
}