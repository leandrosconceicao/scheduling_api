import { ApiResponse } from "./api_response";
import { IScheduleType } from "@domain";

export class ScheduleResponseDto extends ApiResponse {
    constructor(entity?: any, message: string = "", statusCode: number = 200) {
        super(message, statusCode, entity);
    }
}

export class ScheduleTypeResponseDto extends ApiResponse {
    constructor(entity?: IScheduleType | IScheduleType[] | null, message: string = "", statusCode: number = 200) {
        super(message, statusCode, entity);
    }
}