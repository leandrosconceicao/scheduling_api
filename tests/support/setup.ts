import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { vi } from "vitest";

// Deve rodar antes de qualquer import da aplicação: @config/env valida o process.env na carga
process.env.CHAVE_JWT = "chave-de-teste-chave-de-teste-chave-de-teste";
process.env.ENVIROMENT = "test";
process.env.DB_URL = `${process.env.TEST_MONGO_URI}test_${randomUUID().replaceAll("-", "")}`;

// Redis: substituído por um cache em memória (mesma superfície usada por CacheService)
vi.mock("@config/cache", async () => {
    const { fakeCache } = await import("./fakes");
    return { default: fakeCache };
});

// Firebase: autenticação, realtime database e storage simulados
vi.mock("firebase-admin/auth", async (importOriginal) => {
    const original = await importOriginal<typeof import("firebase-admin/auth")>();
    const { makeVerifyIdToken } = await import("./fakes");
    const verifyIdToken = makeVerifyIdToken(original.FirebaseAuthError as any);
    return { ...original, getAuth: () => ({ verifyIdToken }) };
});

vi.mock("firebase-admin/database", async () => {
    const { fakeDatabase } = await import("./fakes");
    return { getDatabase: () => fakeDatabase };
});

vi.mock("firebase-admin/storage", async () => {
    const { fakeStorage, fakeDownloadURL } = await import("./fakes");
    return { getStorage: () => fakeStorage, getDownloadURL: fakeDownloadURL };
});
