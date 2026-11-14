import * as dotenv from "dotenv";
import z from "zod";

dotenv.config();

const ENV_VALIDATION = z.object({
    CHAVE_JWT: z.string().min(1),
    DB_URL: z.string().min(1),
    // Ausente: usa a conta de serviço do ambiente (App Engine) via Application Default Credentials
    FIREBASE_CREDENTIALS_PATH: z.string().optional(),
    FIREBASESTORAGE: z.string().optional(),
    FIREBASEDB: z.string().optional(),
    CACHE_USERNAME: z.string().optional(),
    CACHE_PASSWORD: z.string().optional(),
    CACHE_HOST: z.string().optional(),
    CACHE_PORT: z.string().optional(),
    ENVIROMENT: z.string().optional(),
    PORT: z.string().default("80"),
    CACHE_URL: z.string().optional()
});

const parsed = ENV_VALIDATION.safeParse(process.env);

// Falha na inicialização em vez de subir a API com configuração inválida (ex.: JWT assinado com chave vazia)
if (!parsed.success) {
    const invalid = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Variáveis de ambiente ausentes ou inválidas: ${invalid}`);
}

export const env = parsed.data;
