import { delay, inject, injectable, registry } from "tsyringe";
import { ICompanyRepository, IHttpClient, IMessageGateway, IWhatsappTextMessage } from "@domain";
import { env } from "@config/env";

@injectable()
@registry([
    {
        token: "IMessageGateway",
        useToken: delay(() => MessageGatewayService)
    }
])
export class MessageGatewayService implements IMessageGateway {

    constructor(
        @inject("IHttpClient") private readonly http: IHttpClient,
        @inject("ICompanyRepository") private readonly companyRepo: ICompanyRepository
    ) { }

    enqueueWhatsappText = async (companyId: string, message: IWhatsappTextMessage): Promise<boolean> => {
        // Integração opcional: sem URL configurada ou sem apiKey na empresa, simplesmente não envia
        if (!env.MESSAGE_API_URL) return false;

        const apiKey = await this.companyRepo.getCompanyApiKey(companyId);

        if (!apiKey) return false;

        // 202 = enfileirada; 200 = repetição idempotente da mesma mensagem. A entrega e os retries são da API de mensagens
        await this.http.request({
            method: "POST",
            url: new URL("/api/v1/messages/whatsapp/text", env.MESSAGE_API_URL).toString(),
            headers: {
                "X-Api-Key": apiKey,
                "Idempotency-Key": message.idempotencyKey,
            },
            body: {
                // A SenderApi espera só dígitos, sem o "+" (ou outros separadores)
                to: message.to.replace(/\D/g, ""),
                text: message.text,
                externalReference: message.externalReference,
            },
            // Seguro repetir: a Idempotency-Key impede mensagem duplicada
            retry: true,
        });

        return true;
    }
}
