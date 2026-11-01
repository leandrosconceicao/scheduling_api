import { OwnerRole } from "../enums";
import { IBase } from "./i_base";
import { ICompany } from "./i_company";

export interface IOwner extends IBase {
    name: string,
    username: string,
    password: string,
    role?: OwnerRole,
    companies?: ICompany[]
}