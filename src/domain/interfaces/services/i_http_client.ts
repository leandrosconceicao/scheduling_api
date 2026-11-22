export interface IHttpRequest {
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    url: string;
    headers?: Record<string, string>;
    body?: unknown;
    /** Substitui o timeout padrão (ms) */
    timeoutMs?: number;
    /**
     * Permite repetir a chamada em falhas transitórias. Só ative em chamadas idempotentes
     * (GET, ou POST com Idempotency-Key), senão um retry pode duplicar o efeito.
     */
    retry?: boolean;
}

export interface IHttpResponse<T = unknown> {
    status: number;
    data: T;
}

export interface IHttpClient {
    /** Lança ExternalServiceError em timeout, falha de rede, circuito aberto ou status fora de 2xx. */
    request<T = unknown>(request: IHttpRequest): Promise<IHttpResponse<T>>;
}
