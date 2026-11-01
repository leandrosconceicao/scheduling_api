import "@domain"
import { OwnerRole } from "@domain";
import { JwtPayload } from "jsonwebtoken";

declare global {
    namespace Express {
        interface Request {
            result?: any;
            autenticatedUser?: any
            autenticatedOwner?: JwtPayload & { username: string, role: OwnerRole, companies: string[] }
        }
    }
}
