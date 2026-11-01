import { injectable, registry, delay, inject } from "tsyringe";
import { Request } from "express";
import { Forbidden, IOwner, IOwnerRepository, IOwnerService, NotFoundError, OwnerRole, Password, Unauthorized } from "@domain";
import { OBJECT_ID_VALIDATION, OWNER_AUTH_VALIDATION, OWNER_CREATE_VALIDATION, OWNER_UPDATE_VALIDATION, OwnerResponseDto, signJwt } from "@application";

@injectable()
@registry([
    {
        token: "IOwnerService",
        useToken: delay(() => OwnerService)
    }
])
export class OwnerService implements IOwnerService {

    constructor(
        @inject("IOwnerRepository") private readonly repository: IOwnerRepository
    ) {}
    
    addNewOwner = async (request: Request): Promise<OwnerResponseDto> => {
        const body = OWNER_CREATE_VALIDATION
            .transform((value) => {
                return value as IOwner
            })
            .parse(request.body);
        
        const search = await this.locateOwner({
            username: body.username,
        });

        if (search) {
            return OwnerResponseDto.badRequest("Não foi possível cadastrar o usuário");
        }

        body.password = await Password.hash(body.password);

        const newOwner = await this.repository.addNewOwner(body);

        return new OwnerResponseDto(newOwner!);
    }
    ownerAuthentication = async (request: Request): Promise<OwnerResponseDto> => {
        const body = OWNER_AUTH_VALIDATION.parse(request.body);

        const owner = await this.locateOwner({
            username: body.username,
        });

        if (!owner || !(await Password.verify(body.password, owner.password))) {
            throw new Unauthorized("Usuário ou senha inválidos");
        }

        return OwnerResponseDto.authenticated(owner, signJwt(owner));
    }
    updateOwner = async (request: Request): Promise<OwnerResponseDto> => {
        const ownerId = OBJECT_ID_VALIDATION.parse(request.params.id);

        const authenticated = request.autenticatedOwner;

        if (authenticated?.role !== OwnerRole.admin && authenticated?.sub !== ownerId) {
            throw new Forbidden("Acesso não permitido");
        }

        const body = OWNER_UPDATE_VALIDATION
            .transform((value) => {
                const obj : Partial<IOwner> = {};

                if (value.name) obj.name = value.name;
                if (value.password) obj.password = value.password;

                return obj;
            })
            .parse(request.body);

        const getOwner = await this.locateOwner({
            _id: ownerId
        });

        if (!getOwner) {
            throw new NotFoundError("Usuário não foi localizado");
        }

        if (body.password) getOwner.password = await Password.hash(body.password);
        if (body.name) getOwner.name = body.name;

        const updatedOwner = await this.repository.updateOwner(ownerId, getOwner);

        return new OwnerResponseDto(updatedOwner!, "Sucesso");
    }
    deleteOwner = async (request: Request): Promise<OwnerResponseDto> => {

        const ownerId = OBJECT_ID_VALIDATION.parse(request.params.id);
        
        const getOwner = await this.locateOwner({
            _id: ownerId
        });

        if (!getOwner) {
            throw new NotFoundError("Usuário não foi localizado");
        }

        const result = await this.repository.deleteOwner(ownerId);

        return new OwnerResponseDto(result!, "Sucesso");
    }

    private async locateOwner(query: Partial<IOwner>) {
        const search = await this.repository.findOwner(query);

        return search;
    }

}