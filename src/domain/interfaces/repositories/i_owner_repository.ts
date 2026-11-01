import { IOwner } from "@domain";

export interface IOwnerRepository {
    addNewOwner(value: IOwner) : Promise<IOwner | null>;
    updateOwner(ownerId: string, values: Partial<IOwner>) : Promise<IOwner | null>;
    deleteOwner(ownerId: string) : Promise<IOwner | null>;
    findOwner(query: Partial<IOwner>) : Promise<IOwner | null>;
}