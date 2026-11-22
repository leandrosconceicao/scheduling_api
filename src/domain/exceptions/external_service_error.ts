/** Falha na comunicação com um serviço externo. Nunca carrega corpo de resposta nem credenciais. */
export class ExternalServiceError extends Error {
    constructor(
        message: string,
        public readonly statusCode?: number,
        /** true quando repetir a chamada pode funcionar (rede, timeout, 408/429/5xx) */
        public readonly retryable: boolean = false
    ) {
        super(message);
        this.name = "ExternalServiceError";
    }
}
