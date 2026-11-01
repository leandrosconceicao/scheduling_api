
import { OwnerResponseDto } from "@application";
import { Request } from "express";

export interface IOwnerService {
    addNewOwner(request: Request) : Promise<OwnerResponseDto>;
    ownerAuthentication(request: Request) : Promise<OwnerResponseDto>;
    updateOwner(request: Request) : Promise<OwnerResponseDto>;
    deleteOwner(request: Request) : Promise<OwnerResponseDto>;
}