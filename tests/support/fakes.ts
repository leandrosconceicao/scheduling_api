// ---- Redis ----
const store = new Map<string, string>();
const ttls = new Map<string, number>();

export const fakeCache = {
    store,
    ttls,
    on: () => fakeCache,
    get: async (key: string) => store.get(key) ?? null,
    set: async (key: string, value: string, opts?: { expiration?: { value: number } }) => {
        store.set(key, value);
        if (opts?.expiration) ttls.set(key, opts.expiration.value);
        return "OK";
    },
    del: async (key: string) => { ttls.delete(key); return store.delete(key) ? 1 : 0; },
};

// ---- Firebase Auth ----
// Os tokens de cliente são JWTs não assinados: o payload carrega o usuário e o fake o "verifica"
export function clientToken(user: { uid: string, name?: string, email?: string }, state: "valid" | "expired" | "revoked" = "valid") {
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
    return `${b64({ alg: "none", typ: "JWT" })}.${b64({ ...user, state })}.assinatura`;
}

// A classe de erro real vem da fábrica do mock: importar firebase-admin/auth aqui travaria (o módulo está mockado)
export function makeVerifyIdToken(FirebaseAuthError: new (info: { code: string, message: string }) => Error) {
    return async (token: string) => {
        const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());

        // Tokens que não são ID tokens do Firebase (ex.: JWT de owner) são recusados como o SDK real faz
        if (!payload.uid) throw new FirebaseAuthError({ code: "argument-error", message: "not a firebase id token" });

        if (payload.state === "expired") throw new FirebaseAuthError({ code: "id-token-expired", message: "expired" });
        if (payload.state === "revoked") throw new FirebaseAuthError({ code: "id-token-revoked", message: "revoked" });

        const { state, ...user } = payload;
        return user;
    };
}

// ---- Firebase Realtime Database ----
// Registra cada notificação (caminho => atualizações) para os testes validarem os eventos em tempo real
export const dbEvents: { path: string, value: unknown }[] = [];

function ref(path: string): any {
    return {
        child: (name: string) => ref(`${path}/${name}`),
        update: (value: unknown) => { dbEvents.push({ path, value }); return Promise.resolve(); },
    };
}

export const fakeDatabase = { ref: (path: string) => ref(path) };

// ---- Firebase Storage ----
export const uploadedFiles: { path: string, size: number }[] = [];

export const fakeStorage = {
    bucket: () => ({
        file: (path: string) => ({
            path,
            save: async (buffer: Buffer) => { uploadedFiles.push({ path, size: buffer.length }); },
        }),
    }),
};

export const fakeDownloadURL = async (file: { path: string }) => `https://storage.test/${file.path}`;

export function resetFakes() {
    store.clear();
    ttls.clear();
    dbEvents.length = 0;
    uploadedFiles.length = 0;
}
