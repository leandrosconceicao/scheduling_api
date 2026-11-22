import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExternalServiceError } from "@domain";
import { HttpClient } from "@application";

const json = (status: number, body: unknown = {}, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), { status, headers });

describe("HttpClient", () => {
    let http: HttpClient;
    let fetchMock: ReturnType<typeof vi.fn>;
    const sleeps: number[] = [];

    beforeEach(() => {
        http = new HttpClient();
        http.sleep = async (ms) => { sleeps.push(ms); };
        sleeps.length = 0;
        fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
    });

    afterEach(() => vi.unstubAllGlobals());

    const post = (retry = true) => http.request({ method: "POST", url: "http://api.test/x", body: { a: 1 }, headers: { "X-Api-Key": "k" }, retry });

    it("devolve status e corpo em 2xx e envia JSON com os headers", async () => {
        fetchMock.mockResolvedValueOnce(json(202, { id: "1" }));

        const res = await post();

        expect(res).toEqual({ status: 202, data: { id: "1" } });
        const [, init] = fetchMock.mock.calls[0];
        expect(init.headers).toMatchObject({ "X-Api-Key": "k", "Content-Type": "application/json" });
        expect(init.body).toBe('{"a":1}');
        expect(init.signal).toBeInstanceOf(AbortSignal);
    });

    it("repete em 5xx e 429 até dar certo", async () => {
        fetchMock.mockResolvedValueOnce(json(503)).mockResolvedValueOnce(json(429)).mockResolvedValueOnce(json(200, { ok: true }));

        const res = await post();

        expect(res.status).toBe(200);
        expect(fetchMock).toHaveBeenCalledTimes(3);
        expect(sleeps).toHaveLength(2);
    });

    it("não repete em 4xx", async () => {
        fetchMock.mockResolvedValue(json(400));

        await expect(post()).rejects.toMatchObject({ statusCode: 400, retryable: false });
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("não repete quando retry não foi liberado", async () => {
        fetchMock.mockResolvedValue(json(503));

        await expect(post(false)).rejects.toBeInstanceOf(ExternalServiceError);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("repete em falha de rede e esgota as tentativas", async () => {
        fetchMock.mockRejectedValue(new TypeError("fetch failed"));

        await expect(post()).rejects.toMatchObject({ retryable: true, statusCode: undefined });
        expect(fetchMock).toHaveBeenCalledTimes(4);
    });

    it("respeita o Retry-After do servidor", async () => {
        fetchMock.mockResolvedValueOnce(json(429, {}, { "Retry-After": "2" })).mockResolvedValueOnce(json(200));

        await post();

        expect(sleeps).toEqual([2000]);
    });

    it("não vaza corpo da resposta nem a apiKey na mensagem de erro", async () => {
        fetchMock.mockResolvedValue(json(500, { segredo: "dado-do-cliente" }));

        const error = await post(false).catch((e) => e);

        expect(error.message).not.toContain("dado-do-cliente");
        expect(error.message).not.toContain("k");
    });

    it("abre o circuito após falhas consecutivas e recusa sem chamar a rede", async () => {
        fetchMock.mockResolvedValue(json(503));

        await post(false).catch(() => { });
        await post(false).catch(() => { });
        await post(false).catch(() => { });
        await post(false).catch(() => { });
        await post(false).catch(() => { });
        fetchMock.mockClear();

        await expect(post(false)).rejects.toThrow(/circuito aberto/);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("sucesso zera a contagem de falhas do circuito", async () => {
        fetchMock.mockResolvedValue(json(503));
        for (let i = 0; i < 4; i++) await post(false).catch(() => { });

        fetchMock.mockResolvedValueOnce(json(200));
        await post(false);

        fetchMock.mockResolvedValue(json(503));
        for (let i = 0; i < 4; i++) await post(false).catch(() => { });
        fetchMock.mockClear();
        fetchMock.mockResolvedValue(json(200));

        await expect(post(false)).resolves.toMatchObject({ status: 200 });
    });
});
