import { NextFunction, Request, Response } from "express";
import { FirebaseAuthError, getAuth } from "firebase-admin/auth";
import z, { ZodError } from "zod";
import  Jwt from "jsonwebtoken";
import { Forbidden, IOwner, OwnerRole, Unauthorized } from "@domain";
import { env } from "@config/env";

const jwtKey = env.CHAVE_JWT;

export async function validateToken(req: Request, res: Response, next: NextFunction) {
    try {

        const bearer = req.headers.authorization?.split("Bearer ") ?? ["", ""];
        
        const token = z.jwt().parse(bearer[1]);
        
        const decodedToken = await getAuth().verifyIdToken(token);
        
        req.autenticatedUser = decodedToken;
        
        next();
        
    } catch (e) {

        const isInstanceOfFirebaseAuth = e instanceof FirebaseAuthError;
        
        if (e instanceof ZodError || (isInstanceOfFirebaseAuth && e.code === "auth/id-token-expired")) {
            next(new Unauthorized("Token inválido ou expirado"));
            return;
        }
        
        if (isInstanceOfFirebaseAuth && (e.code === "auth/id-token-revoked" || e.code === "auth/argument-error")) {
            next(new Forbidden("Acesso não permitido"));
            return;
        }
        next(e);
    }
}

export function signJwt(user: IOwner) {
    return Jwt.sign({
        username: user.username,
        role: user.role ?? OwnerRole.owner,
        companies: user.companies?.map((e) => e._id) ?? []
    }, jwtKey, {
        subject: String(user._id),
        expiresIn: '30Min',
    })
}

export async function validateOwnerToken(req: Request, _: Response, next: NextFunction) {
    try {
        // Aceita o token com ou sem o prefixo "Bearer"
        const access_token = req.headers.authorization?.replace(/^Bearer\s+/i, "");

        const token = z.jwt().parse(access_token);

        req.autenticatedOwner = Jwt.verify(token, jwtKey) as Request["autenticatedOwner"];

        next();
    } catch (e) {
        if (e instanceof ZodError) {
            next(new Unauthorized("Token inválido ou expirado"));
            return;
        }
        next(e);
    }
}

export async function validateAdminToken(req: Request, res: Response, next: NextFunction) {
    await validateOwnerToken(req, res, (err?: unknown) => {
        if (err) return next(err);

        if (req.autenticatedOwner?.role !== OwnerRole.admin) {
            return next(new Forbidden("Acesso não permitido"));
        }

        next();
    });
}