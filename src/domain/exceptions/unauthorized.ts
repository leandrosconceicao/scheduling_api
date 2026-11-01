import { ApiResponse } from "../../application/dtos/api_response";

export class Unauthorized extends ApiResponse {
    
    constructor(message: string) {
        super(message, 401)
    }
}