import * as dotenv from "dotenv";
import z from "zod";

dotenv.config();

const ENV_VALIDATION = z.object({
    CHAVE_JWT: z.string().min(1),
    DB_URL: z.string().min(1),
    // Ausente: usa a conta de serviço do ambiente (App Engine) via Application Default Credentials
    FIREBASE_CREDENTIALS_PATH: z.string().optional(),
    // ID do projeto Firebase que emite os tokens (obrigatório se for diferente do projeto GCP onde a API roda)
    FIREBASE_PROJECT_ID: z.string().optional(),
    FIREBASESTORAGE: z.string().optional(),
    FIREBASEDB: z.string().optional(),
    CACHE_USERNAME: z.string().optional(),
    CACHE_PASSWORD: z.string().optional(),
    CACHE_HOST: z.string().optional(),
    CACHE_PORT: z.string().optional(),
    ENVIROMENT: z.string().optional(),
    PORT: z.string().default("80"),
    CACHE_URL: z.string().optional(),
    // API de mensagens (SenderApi). Sem a URL, o envio de mensagens fica desativado
    MESSAGE_API_URL: z.string().url().optional(),
    MESSAGE_API_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
    MESSAGE_API_MAX_RETRIES: z.coerce.number().int().min(0).default(3),
    // Proteção contra brute force no login do owner (falhas dentro da janela até o bloqueio)
    LOGIN_MAX_ATTEMPTS_USER_IP: z.coerce.number().int().positive().default(5),
    LOGIN_MAX_ATTEMPTS_IP: z.coerce.number().int().positive().default(20),
    LOGIN_MAX_ATTEMPTS_USER: z.coerce.number().int().positive().default(50),
    LOGIN_WINDOW_SECONDS: z.coerce.number().int().positive().default(900)
});

const parsed = ENV_VALIDATION.safeParse(process.env);

// Falha na inicialização em vez de subir a API com configuração inválida (ex.: JWT assinado com chave vazia)
if (!parsed.success) {
    const invalid = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Variáveis de ambiente ausentes ou inválidas: ${invalid}`);
}

export const env = parsed.data;
