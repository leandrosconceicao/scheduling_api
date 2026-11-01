import { ApiResponse } from "@application";
import { ICompanyService } from "@domain";
import { NextFunction, Request, Response } from "express";
import { autoInjectable, inject } from "tsyringe";

@autoInjectable()
export class CompanyController {


    constructor(
        @inject("ICompanyService") private readonly service: ICompanyService
    ) { }

    create = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.service.createCompany(req);

            return res.status(200).json(result);

        } catch (e) {
            next(e);
        }
    }

    getById = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.service.getCompanyById(req);

            return res.status(200).json(result);

        } catch (e) {
            next(e);
        }
    }

    updateCompanyById = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.service.updateCompany(req);

            return res.status(200).json(result);
        } catch (e) {
            next(e);
        }
    }

    deleteCompanyById = async (req: Request, res: Response, next: NextFunction) => {
        try {
            await this.service.deleteCompanyById(req);

            res.sendStatus(204);
        } catch (e) {
            next(e);
        }
    }

    uploadLogo = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.service.updateLogo(req);

            return res.status(result.statusCode).json(result);
        } catch (e) {
            next(e);
        }
    }

    searchSubdomain = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.service.getCompanyByDomain(req);

            return res.status(result.statusCode).json(ApiResponse.success({
                _id: result.dados?._id
            }));
            
        } catch (e) {
            next(e);
        }
    }
}