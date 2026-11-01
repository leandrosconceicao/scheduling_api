import { autoInjectable, inject } from "tsyringe";
import { Request, Response, NextFunction } from "express"
import { ScheduleResponseDto } from "@application";
import { IScheduleService, ICloudService, ISchedule } from "@domain";

@autoInjectable()
export class ScheduleController {

    constructor(
        @inject("IScheduleService") private readonly service: IScheduleService,
        @inject("ICloudService") private readonly cloudService: ICloudService
    ) { }

    getSchedules = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.service.getSchedules(req);

            return res.status(result.statusCode).json(result);
        } catch (e) {
            next(e);
        }
    }

    getCompanySchedules = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.service.getCompanySchedules(req);

            return res.status(result.statusCode).json(result);
        } catch (e) {
            next(e);
        }
    }

    createSchedule = async (req: Request, _: Response, next: NextFunction) => {
        try {
            const result = await this.service.confirmSchedule(req);

            req.result = result;

            next();
        } catch (e) {
            next(e);
        }
    }

    getScheduleById = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.service.getScheduleById(req);

            return res.status(result.statusCode).json(result);

        } catch (e) {
            next(e);
        }
    }

    cancelSchedule = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.service.cancelSchedule(req);

            this.cloudService.sendScheduledEvent(req.params.companyId.toString(), [result.dados]);

            return res.status(result.statusCode).json(result);

        } catch (e) {
            next(e);
        }
    }

    cancelScheduleByCompany = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.service.cancelScheduleByCompany(req);

            this.cloudService.sendScheduledEvent(req.params.companyId.toString(), [result.dados]);

            return res.status(result.statusCode).json(result);

        } catch (e) {
            next(e);
        }
    }

    addNewScheduleType = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.service.addNewScheduleType(req);

            return res.status(result.statusCode).json(result);

        } catch (e) {
            next(e);
        }
    }

    getScheduleTypes = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.service.getScheduleTypes(req);

            return res.status(result.statusCode).json(result);
        } catch (e) {
            next(e);
        }
    }

    deleteScheduleType = async (req: Request, res: Response, next: NextFunction) => {
        try {
            await this.service.removeScheduleType(req);

            res.sendStatus(204);
        } catch (e) {
            next(e);
        }
    }

    updateScheduleType = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.service.updateScheduleTypeById(req);

            return res.status(result.statusCode).json(result);
        } catch (e) {
            next(e);
        }
    }

    lockSchedule = async (req: Request, _: Response, next: NextFunction) => {
        try {
            const result = await this.service.lockSchedule(req);

            req.result = result;
            next();
        } catch (e) {
            next(e);
        }
    }

    deleteLockSchedule = async (req: Request, _: Response, next: NextFunction) => {
        try {

            const result = await this.service.deleteLockSchedule(req);

            req.result = result;
            next();
        } catch (e) {
            next(e);
        }
    }

    sendEventSchedule = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = req.result as ISchedule | null;

            this.cloudService.sendScheduledEvent(req.params.companyId.toString(), [result])
            
            res.status(200).json(ScheduleResponseDto.success(result));
        } catch (e) {
            next(e);
        }
    }
}