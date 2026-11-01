import { NextFunction, Request, Response } from "express";
import { ISchedule } from "../i_schedule";

export interface ICloudService {
    uploadFile(companyId: string, base64File: string, filename: string) : Promise<string>;
    sendScheduledEvent(companyId: string, schedules: (ISchedule | null)[]) : void;
    sendEventlockSchedule(request: Request, response: Response, next: NextFunction) : Response;
}