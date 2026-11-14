import { createClient } from "redis";
import { env } from "./env";

const enviroment = env.ENVIROMENT;
const isDevelopment = enviroment === "development";

if (!isDevelopment && !env.CACHE_URL) {
    throw new Error("CACHE_URL é obrigatória fora do ambiente de desenvolvimento");
}

const cacheConfig = isDevelopment ? {
    username: env.CACHE_USERNAME,
    password: env.CACHE_PASSWORD,
    socket: {
        host: env.CACHE_HOST,
        port: Number(env.CACHE_PORT)
    }
} : {
    url: env.CACHE_URL
}

const client = createClient(cacheConfig);

client.on("error", (err) => {
    console.error("Erro no Redis:", err);
});

client.connect().then(() => {
    console.info("Redis conectado com sucesso🚀!")
}).catch((err) => {
    console.error("Falha ao conectar no Redis:", err);
});

export default client;
