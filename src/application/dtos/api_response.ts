export class ApiResponse {
    statusCode: number = 200;
    dados?: any;
    message: string;
    statusProcess: boolean = false;

    constructor(message: string = "", status?: number, dados?: any) {
        this.message = message;
        this.statusCode = status ?? 200;
        this.dados = dados;
        this.statusProcess = dados !== null && dados !== undefined;
    }

    static success<T>(data: T) {
        return new ApiResponse("Sucesso", 200, data);
    }

    static serverError(message?: string) {
        return new ApiResponse(message ?? "O servidor não conseguiu processar a solicitação, tente novamente em alguns instantes.", 500, null)
    }

    static badRequest(message: string) {
        return new ApiResponse(message, 400, null);
    }

    static parameterInvalid(message: string) {
        return new ApiResponse(message, 406, null);
    }

    static unauthorized() {
        return new ApiResponse("Token inválido", 401, null)
    }
}