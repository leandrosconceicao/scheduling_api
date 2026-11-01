import { companyRouter, ownerRouter, scheduleRouter } from "@routes";
import { Application, Request, Response, NextFunction } from "express";


export const router = (app: Application) => {
    app.get("/health", (_: Request, res: Response, __: NextFunction) => {
        return res.status(200).json({
            message: "API Online"
        })
    })


    app.use(ownerRouter);
    
    app.use(companyRouter);

    app.use(scheduleRouter);
}