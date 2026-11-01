import { NextFunction, Request, Response } from "express";
import { getDownloadURL, getStorage } from "firebase-admin/storage";
import { injectable, registry, delay } from "tsyringe";
import { OBJECT_ID_VALIDATION } from "../validations/default_validations";
import z from "zod";
import { getDatabase } from "firebase-admin/database";
import { ISchedule } from "@/domain/interfaces/i_schedule";
import { ScheduleResponseDto } from "../dtos/schedule_dto";
import { ICloudService } from "@domain";
import { env } from "@config/env";

const enviroment = env.ENVIROMENT;
const isDevelopment = enviroment === "development";

@injectable()
@registry([
    {
        token: "ICloudService",
        useToken: delay(() => CloudService)
    }
])
export class CloudService implements ICloudService {

    sendScheduledEvent(companyId: string, schedules: (ISchedule | null)[]) {
        try {
            const db = getDatabase();

            const ref = isDevelopment ? db.ref(enviroment).child(companyId) : db.ref(companyId);

            for (const dados of schedules) {
                if (!dados) continue;

                ref.child(new Date(dados.startsAt).toISOString().split("T")[0]).update({
                    deliveryIdEvent: new Date().toISOString()
                });
            }

        } catch (e) {

        }
    }


    uploadFile = async (companyId: string, base64File: string, filename: string): Promise<string> => {

        OBJECT_ID_VALIDATION.parse(companyId);

        z.base64({
            error: "Arquivo enviado é invalido"
        }).parse(base64File);

        const bucket = getStorage().bucket();

        const imageBuffer = Buffer.from(base64File ?? "", "base64");

        const path = isDevelopment ? `development/${companyId}` : companyId ?? "";

        const uploadFIle = bucket.file(`${path}/${filename}`);

        await uploadFIle.save(imageBuffer);

        return getDownloadURL(uploadFIle);
    }

    sendEventlockSchedule(request: Request, response: Response, next: NextFunction): Response {
        
        try {
            const result = request.result as ScheduleResponseDto;
            
            const dados = result.dados as ISchedule;
            
            const db = getDatabase();

            const ref = isDevelopment ? db.ref(enviroment).child(dados.companyId.toString()) : db.ref(dados.companyId.toString());
            
            ref.child(new Date(dados.startsAt).toISOString().split("T")[0]).update({
                deliveryIdEvent: new Date().toISOString()
            });
            
            
            return response.status(200).json(new ScheduleResponseDto(dados));
        } catch (e) {
            throw e;
        }
    }
}