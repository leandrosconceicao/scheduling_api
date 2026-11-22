export interface IWhatsappTextMessage {
    /** Telefone do destinatário */
    to: string;
    text: string;
    /** Referência própria (ex.: id do agendamento), devolvida pela API de mensagens para rastreio */
    externalReference?: string;
    /** Identifica a mensagem de forma estável: repetir a chamada com a mesma chave não duplica o envio */
    idempotencyKey: string;
}

export interface IMessageGateway {
    /**
     * Enfileira o envio na API de mensagens da empresa. Retorna false (sem lançar) quando a integração
     * não está ativa ou a empresa não tem apiKey. Lança ExternalServiceError se a API não aceitar a mensagem.
     */
    enqueueWhatsappText(companyId: string, message: IWhatsappTextMessage): Promise<boolean>;
}
