import { ApiResponse } from "../../application/dtos/api_response";

export class TooManyRequests extends ApiResponse {

    constructor(message: string, public readonly retryAfterSeconds: number) {
        super(message, 429, null)
    }
}
