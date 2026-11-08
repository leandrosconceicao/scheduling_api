import { NextFunction, Request, Response } from "express";
import { getDownloadURL, getStorage } from "firebase-admin/storage";
import { injectable, registry, delay } from "tsyringe";
import { OBJECT_ID_VALIDATION } from "../validations/default_validations";
import { randomUUID } from "node:crypto";
import { processImage } from "./image_processor";
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
            console.warn(e);
        }
    }


    private companyPath = (companyId: string) => isDevelopment ? `development/${companyId}` : companyId;

    uploadImage = async (companyId: string, folder: string, file: Buffer | undefined, maxDimension: number): Promise<string> => {

        OBJECT_ID_VALIDATION.parse(companyId);

        // O nome do arquivo é gerado no servidor: nunca usa o nome enviado pelo cliente
        const image = await processImage(file, maxDimension);

        const bucket = getStorage().bucket();

        const uploadFile = bucket.file(`${this.companyPath(companyId)}/${folder}-${randomUUID()}.webp`);

        await uploadFile.save(image, { contentType: "image/webp", resumable: false });

        return getDownloadURL(uploadFile);
    }

    deleteFileByUrl = async (companyId: string, url: string | undefined): Promise<void> => {
        try {
            if (!url) return;

            const { pathname } = new URL(url);
            const objectPath = decodeURIComponent(pathname.includes("/o/") ? pathname.split("/o/")[1] : pathname.slice(1));

            // Só apaga arquivos da própria empresa (URLs externas ou de outra empresa são ignoradas)
            if (!objectPath.startsWith(`${this.companyPath(companyId)}/`)) return;

            await getStorage().bucket().file(objectPath).delete({ ignoreNotFound: true });
        } catch (e) {
            console.warn("Falha ao remover arquivo antigo do storage", e);
        }
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