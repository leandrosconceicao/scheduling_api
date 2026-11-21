import { createHash } from "node:crypto";
import { inject, injectable } from "tsyringe";
import { env } from "@config/env";
import { ICacheService, TooManyRequests } from "@domain";

// Duração do bloqueio por nível de reincidência (o último degrau se repete)
const LOCK_LADDER_SECONDS = [60, 300, 900];
// Tempo em que a reincidência é lembrada
const LEVEL_TTL_SECONDS = 24 * 60 * 60;

interface Layer {
    id: string;
    limit: number;
}

/**
 * Proteção contra brute force no login em 3 camadas (usuário+IP, IP, usuário), todas com
 * contagem de falhas em janela fixa e bloqueio progressivo. Falha aberta se o Redis estiver fora.
 */
@injectable()
export class LoginAttemptService {

    constructor(
        @inject("ICacheService") private readonly cache: ICacheService
    ) {}

    assertNotLocked = async (username: string, ip: string): Promise<void> => {
        const ttls = await Promise.all(
            this.layers(username, ip).map((layer) => this.cache.getTtl(this.key("lock", layer.id)))
        );

        const remaining = Math.max(...ttls);

        if (remaining > 0) {
            throw new TooManyRequests("Muitas tentativas de login. Tente novamente mais tarde.", remaining);
        }
    }

    registerFailure = async (username: string, ip: string): Promise<void> => {
        for (const layer of this.layers(username, ip)) {
            const failKey = this.key("fail", layer.id);
            const count = await this.cache.increment(failKey, env.LOGIN_WINDOW_SECONDS);

            if (count < layer.limit) continue;

            const level = await this.cache.increment(this.key("level", layer.id), LEVEL_TTL_SECONDS);
            const duration = LOCK_LADDER_SECONDS[Math.min(Math.max(level, 1), LOCK_LADDER_SECONDS.length) - 1];

            await this.cache.setCache(this.key("lock", layer.id), "1", duration);
            await this.cache.removeData(failKey);
        }
    }

    /** Login com sucesso: limpa só a camada usuário+IP (as demais seguem contando). */
    reset = async (username: string, ip: string): Promise<void> => {
        const id = this.layers(username, ip)[0].id;

        await this.cache.removeData(this.key("fail", id));
        await this.cache.removeData(this.key("level", id));
    }

    private layers(username: string, ip: string): Layer[] {
        const user = createHash("sha256").update(username.trim().toLowerCase()).digest("hex");

        return [
            { id: `ui:${user}:${ip}`, limit: env.LOGIN_MAX_ATTEMPTS_USER_IP },
            { id: `ip:${ip}`, limit: env.LOGIN_MAX_ATTEMPTS_IP },
            { id: `user:${user}`, limit: env.LOGIN_MAX_ATTEMPTS_USER }
        ];
    }

    private key(kind: "fail" | "lock" | "level", id: string) {
        return `login:${kind}:${id}`;
    }
}
