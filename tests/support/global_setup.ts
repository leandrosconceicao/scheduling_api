import { MongoMemoryServer } from "mongodb-memory-server";

let mongod: MongoMemoryServer;

// Sobe um único MongoDB em memória para toda a suíte; os workers herdam a variável de ambiente
export async function setup() {
    mongod = await MongoMemoryServer.create();
    process.env.TEST_MONGO_URI = mongod.getUri();
}

export async function teardown() {
    await mongod?.stop();
}
