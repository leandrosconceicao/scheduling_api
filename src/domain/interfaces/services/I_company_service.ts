import { CompanyResponseDto } from "@/application/dtos/company_dto";
import { Request } from "express";

export interface ICompanyService {
    createCompany(request: Request) : Promise<CompanyResponseDto>;
    getCompanyById(request: Request) : Promise<CompanyResponseDto>;
    getCompanyByDomain(request: Request) : Promise<CompanyResponseDto>;
    updateCompany(request: Request) : Promise<CompanyResponseDto>;
    updateLogo(request: Request) : Promise<CompanyResponseDto>;
    deleteCompanyById(request: Request) : Promise<CompanyResponseDto>;    
    getCompanies(request: Request) : Promise<CompanyResponseDto>;
}