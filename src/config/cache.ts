import { createClient } from "redis";
import { env } from "./env";

const client = createClient({
    username: env.CACHE_USERNAME,
    password: env.CACHE_PASSWORD,
    socket: {
        host: env.CACHE_HOST,
        port: Number(env.CACHE_PORT)
    }
});

client.connect().then((e) => {
    console.info("Redis conectado com sucesso🚀!")
});

export default client;
