import { ICompany } from "@domain";

export interface ICompanyRepository {
    createCompany(company: ICompany) : Promise<ICompany>
    getCompanyById(id: string) : Promise<ICompany | null>
    getCompanyByDomain(domain: string) : Promise<ICompany | null>
    updateCompany(id: string, company: Partial<ICompany>) : Promise<ICompany | null>
    deleteCompanyById(id: string) : Promise<void>;
    loadComapanies() : Promise<ICompany[]>;
}