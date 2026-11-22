import { beforeEach, describe, expect, it, vi } from "vitest";

const envMock = vi.hoisted(() => ({ MESSAGE_API_URL: "http://sender.test" as string | undefined }));

vi.mock("@config/env", () => ({ env: envMock }));

import { MessageGatewayService } from "@application";

describe("MessageGatewayService", () => {
    const request = vi.fn();
    const getCompanyApiKey = vi.fn();
    const gateway = new MessageGatewayService({ request } as any, { getCompanyApiKey } as any);

    const message = { to: "+5581999999999", text: "oi", externalReference: "s1", idempotencyKey: "s1:confirmed" };

    beforeEach(() => {
        envMock.MESSAGE_API_URL = "http://sender.test";
        request.mockReset().mockResolvedValue({ status: 202, data: {} });
        getCompanyApiKey.mockReset();
    });

    it("não chama a API quando a empresa não tem apiKey", async () => {
        getCompanyApiKey.mockResolvedValue(null);

        await expect(gateway.enqueueWhatsappText("c1", message)).resolves.toBe(false);
        expect(request).not.toHaveBeenCalled();
    });

    it("não chama a API quando a integração está desativada", async () => {
        envMock.MESSAGE_API_URL = undefined;

        await expect(gateway.enqueueWhatsappText("c1", message)).resolves.toBe(false);
        expect(getCompanyApiKey).not.toHaveBeenCalled();
    });

    it("envia X-Api-Key, Idempotency-Key estável e libera retry", async () => {
        getCompanyApiKey.mockResolvedValue("chave-123");

        await expect(gateway.enqueueWhatsappText("c1", message)).resolves.toBe(true);

        expect(request).toHaveBeenCalledWith({
            method: "POST",
            url: "http://sender.test/api/v1/messages/whatsapp/text",
            headers: { "X-Api-Key": "chave-123", "Idempotency-Key": "s1:confirmed" },
            body: { to: "5581999999999", text: "oi", externalReference: "s1" },
            retry: true,
        });
    });

    it("propaga o erro da API para o chamador decidir", async () => {
        getCompanyApiKey.mockResolvedValue("k");
        request.mockRejectedValue(new Error("falhou"));

        await expect(gateway.enqueueWhatsappText("c1", message)).rejects.toThrow("falhou");
    });
});
