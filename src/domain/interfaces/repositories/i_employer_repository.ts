import { IEmployee } from "@domain";

export interface IEmployerRepository {
    getEmployer(companyId: string, id: string) : Promise<IEmployee | null>;
    addEmployer(newEmployer: IEmployee) : Promise<IEmployee | null>;
    getEmployers(companyId: string) : Promise<IEmployee[]>;
    removeEmployer(companyId: string, id: string) : Promise<void>;
    updateEmployer(id: string, data: Partial<IEmployee>) : Promise<IEmployee | null>;
}