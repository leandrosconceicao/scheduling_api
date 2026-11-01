import { Request } from "express";
import { Forbidden, ICompany, OwnerRole } from "@domain";

// Compara com o ownerId salvo no banco (e não com a lista de empresas do token),
// para refletir transferências/exclusões sem esperar o token expirar
export function assertCompanyOwner(request: Request, company: Pick<ICompany, "ownerId">) {
    const authenticated = request.autenticatedOwner;

    const isAdmin = authenticated?.role === OwnerRole.admin;
    const isOwner = !!authenticated?.sub && String(company.ownerId) === authenticated.sub;

    if (!isAdmin && !isOwner) {
        throw new Forbidden("Acesso não permitido");
    }
}
