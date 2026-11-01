import { ScheduleResponseDto, ScheduleTypeResponseDto } from "@application";
import { Request } from "express";
import { ISchedule } from "../i_schedule";

export interface IScheduleService {
    deleteLockSchedule(req: Request): Promise<ScheduleResponseDto>;
    getSchedules(request: Request): Promise<ScheduleResponseDto>;
    getCompanySchedules(request: Request): Promise<ScheduleResponseDto>;
    getScheduleById(request: Request): Promise<ScheduleResponseDto>;
    cancelSchedule(request: Request): Promise<ScheduleResponseDto>;
    cancelScheduleByCompany(request: Request): Promise<ScheduleResponseDto>;
    lockSchedule(req: Request): Promise<ScheduleResponseDto>;
    getScheduleTypes(request: Request): Promise<ScheduleTypeResponseDto>;
    addNewScheduleType(request: Request): Promise<ScheduleTypeResponseDto>;
    removeScheduleType(request: Request): Promise<ScheduleTypeResponseDto>;
    updateScheduleTypeById(request: Request): Promise<ScheduleTypeResponseDto>;
    confirmSchedule(request: Request) : Promise<ISchedule | null>;
}