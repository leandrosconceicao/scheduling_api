import { IOwnerService } from "@domain";
import { Request, Response, NextFunction } from "express";
import { autoInjectable, inject } from "tsyringe";


@autoInjectable()
export class OwnerController {
    constructor(
        @inject("IOwnerService") private readonly service: IOwnerService
    ) {}

    create = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.service.addNewOwner(req);

            return res.status(result.statusCode).json(result);
        } catch (e) {
            next(e);
        }
    }

    authenticate = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.service.ownerAuthentication(req);

            return res.status(result.statusCode).json(result);
        } catch (e) {
            next(e);
        }
    }

    update = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.service.updateOwner(req);

            return res.status(result.statusCode).json(result);
        } catch (e) {
            next(e);
        }
    }

    delete = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.service.deleteOwner(req);

            return res.status(result.statusCode).json(result);
        } catch (e) {
            next(e);
        }
    }
}