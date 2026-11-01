import { ApiResponse } from "../../application/dtos/api_response";

export class Forbidden extends ApiResponse {
    constructor(message: string) {
        super(message, 403);
    }
}