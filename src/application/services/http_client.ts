import { delay, injectable, registry } from "tsyringe";
import { ExternalServiceError, IHttpClient, IHttpRequest, IHttpResponse } from "@domain";
import { env } from "@config/env";

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const MAX_BACKOFF_MS = 5000;
const BREAKER_FAILURES = 5;
const BREAKER_COOLDOWN_MS = 30000;

interface Breaker {
    failures: number;
    openUntil: number;
}

@injectable()
@registry([
    {
        token: "IHttpClient",
        useToken: delay(() => HttpClient)
    }
])
export class HttpClient implements IHttpClient {

    // Ajustáveis nos testes
    sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
    backoffBaseMs = 200;

    // Circuit breaker por origem (em memória, por instância): evita acumular requisições penduradas num serviço fora do ar
    private readonly breakers = new Map<string, Breaker>();

    request = async <T = unknown>(request: IHttpRequest): Promise<IHttpResponse<T>> => {
        const origin = new URL(request.url).origin;

        this.assertCircuitClosed(origin);

        const attempts = (request.retry ? env.MESSAGE_API_MAX_RETRIES : 0) + 1;

        let lastError!: ExternalServiceError;

        for (let attempt = 1; attempt <= attempts; attempt++) {
            let retryAfterMs: number | undefined;

            try {
                const response = await this.send(request);

                if (response.ok) {
                    this.recordSuccess(origin);

                    return { status: response.status, data: await this.readBody(response) as T };
                }

                retryAfterMs = this.parseRetryAfter(response.headers.get("retry-after"));

                // O corpo da resposta não entra na mensagem: pode conter dados do cliente
                lastError = new ExternalServiceError(`Serviço externo respondeu ${response.status}`, response.status, RETRYABLE_STATUS.has(response.status));
            } catch (e) {
                lastError = new ExternalServiceError(
                    (e as Error)?.name === "TimeoutError" ? "Tempo limite excedido ao chamar o serviço externo" : "Falha de rede ao chamar o serviço externo",
                    undefined,
                    true
                );
            }

            // Erros 4xx (exceto 408/429) são do chamador: não indicam serviço instável
            if (lastError.retryable) this.recordFailure(origin);

            if (!lastError.retryable || attempt === attempts) break;

            await this.sleep(this.backoff(attempt, retryAfterMs));
        }

        throw lastError;
    }

    private send = (request: IHttpRequest) => {
        const hasBody = request.body !== undefined;

        return fetch(request.url, {
            method: request.method,
            headers: { ...(hasBody ? { "Content-Type": "application/json" } : {}), Accept: "application/json", ...request.headers },
            body: hasBody ? JSON.stringify(request.body) : undefined,
            signal: AbortSignal.timeout(request.timeoutMs ?? env.MESSAGE_API_TIMEOUT_MS),
        });
    }

    private async readBody(response: Response) {
        const text = await response.text();

        if (!text) return null;

        try {
            return JSON.parse(text);
        } catch {
            return text;
        }
    }

    // Backoff exponencial com jitter; Retry-After do servidor prevalece (limitado)
    private backoff(attempt: number, retryAfterMs?: number) {
        if (retryAfterMs !== undefined) return Math.min(retryAfterMs, MAX_BACKOFF_MS);

        const exponential = this.backoffBaseMs * 2 ** (attempt - 1);

        return Math.min(exponential, MAX_BACKOFF_MS) * (0.5 + Math.random() / 2);
    }

    private parseRetryAfter(value: string | null) {
        if (!value) return undefined;

        const seconds = Number(value);

        if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);

        const date = Date.parse(value);

        return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
    }

    // Aberto: recusa na hora. Passado o cooldown, a próxima chamada passa (meia-abertura) e decide se fecha ou reabre
    private assertCircuitClosed(origin: string) {
        const breaker = this.breakers.get(origin);

        if (breaker && breaker.openUntil > Date.now()) {
            throw new ExternalServiceError("Serviço externo indisponível (circuito aberto)", undefined, false);
        }
    }

    private recordSuccess(origin: string) {
        this.breakers.delete(origin);
    }

    private recordFailure(origin: string) {
        const breaker = this.breakers.get(origin) ?? { failures: 0, openUntil: 0 };

        breaker.failures++;

        if (breaker.failures >= BREAKER_FAILURES) breaker.openUntil = Date.now() + BREAKER_COOLDOWN_MS;

        this.breakers.set(origin, breaker);
    }
}
