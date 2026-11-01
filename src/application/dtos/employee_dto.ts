import { IEmployee } from "@domain";
import { ApiResponse } from "./api_response";

export class EmployeeResponseDto extends ApiResponse {
    constructor(entity?: IEmployee | IEmployee[] | null, message: string = "", statusCode: number = 200) {
        super(message, statusCode, entity);
    }
}