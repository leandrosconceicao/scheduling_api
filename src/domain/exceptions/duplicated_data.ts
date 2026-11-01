import { ApiResponse } from "../../application/dtos/api_response";

export class DuplicatedData extends ApiResponse {
    constructor(message?: string) {
        message ??= "Dados já cadastrados";
        super(message, 400);
    }
}