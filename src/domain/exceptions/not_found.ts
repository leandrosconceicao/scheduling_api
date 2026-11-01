import { ApiResponse } from "../../application/dtos/api_response";

export class NotFoundError extends ApiResponse {
    
    constructor(message?: string) {
        message ??= "Dados não localizados";
        super(message, 404);
    }
}