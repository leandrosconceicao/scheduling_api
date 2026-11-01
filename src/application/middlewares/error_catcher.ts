import express, { NextFunction } from "express";
import {z} from "zod";
import Jwt from "jsonwebtoken";
import { ApiResponse } from "@application";
import { DuplicatedData } from "@domain";

export function errorCatcher(err: Error, req: express.Request, res: express.Response, _: NextFunction) {
    

    if (err instanceof z.ZodError) {
        
        const msg = err.issues.map((err) => !err.path.length ? `${err.message}` : `Parametro (${err.path}) é inválido, ${err.message}`).join(", ");

        return res.status(406).json(ApiResponse.parameterInvalid(msg));
    }
    if ((err as any).code === 11000) {
        return res.status(409).json(new DuplicatedData())
    }

    if (err instanceof Jwt.JsonWebTokenError) {
        return res.status(401).send(ApiResponse.unauthorized())
    }

    if (err instanceof ApiResponse) {
        return res.status(err.statusCode).json(err)
    }    

    if (err instanceof SyntaxError && 'body' in err) {
        console.warn('JSON INVÁLIDO', {ip: req.ip, ua: req.get('User-Agent')});
        return res.status(400).json(ApiResponse.badRequest("JSON Inválido"))
    }

    console.warn(err);
    
    return res.status(500).json(ApiResponse.serverError())
}