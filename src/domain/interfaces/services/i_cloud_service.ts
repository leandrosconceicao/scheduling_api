import { NextFunction, Request, Response } from "express";
import { ISchedule } from "../i_schedule";

export interface ICloudService {
    /** Valida, redimensiona e converte a imagem para WebP, grava em `<companyId>/<folder>` e retorna a URL de download. */
    uploadImage(companyId: string, folder: string, file: Buffer | undefined, maxDimension: number) : Promise<string>;
    /** Remove do storage o arquivo da URL, somente se pertencer à empresa. Falhas são ignoradas. */
    deleteFileByUrl(companyId: string, url: string | undefined) : Promise<void>;
    sendScheduledEvent(companyId: string, schedules: (ISchedule | null)[]) : void;
    sendEventlockSchedule(request: Request, response: Response, next: NextFunction) : Response;
}