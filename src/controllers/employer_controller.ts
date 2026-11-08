import { IEmployerService } from "@domain";
import { Request, Response, NextFunction } from "express";
import { autoInjectable, inject } from "tsyringe";

@autoInjectable()
export class EmployerController {

    constructor(
        @inject("IEmployerService") private readonly service: IEmployerService
    ) {}

    createEmployer = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.service.createEmployer(req);

            return res.status(result.statusCode).json(result);
            
        } catch (e) {
            next(e);
        }
    }
    getEmployerById = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.service.getEmployerById(req);

            return res.status(result.statusCode).json(result);

        } catch (e) {
            next(e);
        }
    }
    updateEmployer = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.service.updateEmployer(req);

            return res.status(result.statusCode).json(result);

        } catch (e) {
            next(e);
        }
    }
    updatePhoto = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.service.updatePhoto(req);

            return res.status(result.statusCode).json(result);

        } catch (e) {
            next(e);
        }
    }
    deleteEmployerById = async (req: Request, res: Response, next: NextFunction) => {
        try {
            
            await this.service.deleteEmployerById(req);

            return res.sendStatus(204);

        } catch (e) {
            next(e);
        }
    }
    getEmployers = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.service.getEmployers(req);

            return res.status(result.statusCode).json(result);

        } catch (e) {
            next(e);
        }
    }
    getCompanyEmployers = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.service.getCompanyEmployers(req);

            return res.status(result.statusCode).json(result);

        } catch (e) {
            next(e);
        }
    }
}