import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const src = (p: string) => fileURLToPath(new URL(`./src/${p}`, import.meta.url));

export default defineConfig({
    resolve: {
        alias: [
            { find: /^@config\/(.*)$/, replacement: src("config/$1") },
            { find: /^@\/(.*)$/, replacement: src("$1") },
            { find: /^@(application|controllers|domain|repository|routes)$/, replacement: src("$1/index.ts") },
        ],
    },
    test: {
        include: ["tests/**/*.test.ts"],
        globalSetup: ["tests/support/global_setup.ts"],
        setupFiles: ["tests/support/setup.ts"],
        // Um mongod compartilhado; cada arquivo usa seu próprio banco, então rodam em paralelo sem colidir
        testTimeout: 30000,
        hookTimeout: 120000,
    },
});
