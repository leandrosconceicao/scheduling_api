import { ApiResponse } from "../../application/dtos/api_response";

export class DatabaseError extends ApiResponse {

    constructor(message: string) {
        super(message, 500);
    }
}