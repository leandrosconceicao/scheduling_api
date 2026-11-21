export interface ICacheService {
    setCache(key: string, value: any, expirationInSeconds: number) : Promise<string | null>;

    getData(key: string) : Promise<string | null>;

    removeData(key: string) : Promise<void>;

    /** Incrementa o contador; o TTL é definido só na criação da chave. Devolve 0 se o cache estiver indisponível. */
    increment(key: string, expirationInSeconds: number) : Promise<number>;

    /** Segundos restantes da chave (-2 se não existe, -1 se sem expiração). */
    getTtl(key: string) : Promise<number>;
}
