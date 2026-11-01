import { IBase } from "./i_base";

export interface IEmployee extends IBase {
    name: string,
    rating: number,
    profilePhotoUrl?: string,
    companyId: any,
}