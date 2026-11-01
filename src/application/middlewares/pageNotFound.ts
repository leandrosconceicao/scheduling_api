import { NotFoundError } from "@domain";
import express, { NextFunction } from "express";

export function pageNotFound(_: express.Request, res: express.Response, next: NextFunction) {
    const error = new NotFoundError("Recurso não localizado");
    next(error);
}