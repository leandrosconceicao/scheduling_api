import 'reflect-metadata';
import { env } from "@config/env";
import "./dependency_injection";
import database from "@config/database"
import { applicationDefault, cert, initializeApp } from 'firebase-admin/app';
import cache from "@config/cache";
import { createApp } from "./create_app";

const app = createApp();

database.on("error", console.log.bind(console, "Erro de conexão"));
database.once("open", () => {
    console.info("Conexão com o banco de dados feita com sucesso!🚀")
});

cache.on("error", (_) => console.warn("Houve um problema para conectar ao redis"));

initializeApp({
    credential: env.FIREBASE_CREDENTIALS_PATH ? cert(env.FIREBASE_CREDENTIALS_PATH) : applicationDefault(),
    storageBucket: env.FIREBASESTORAGE,
    databaseURL: env.FIREBASEDB
});

const port = env.PORT;

app.listen(port)


