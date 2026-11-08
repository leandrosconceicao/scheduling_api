import { injectable, registry, delay, inject } from "tsyringe";
import { Request } from "express";
import { ICompanyService, ICompanyRepository, IScheduleRepository, ICompany, NotFoundError, ICloudService } from "@domain";
import { assertCompanyOwner, COMPANY_REQUEST_VALIDATION, COMPANY_UPDATE_REQUEST_VALIDATION, CompanyResponseDto, OBJECT_ID_VALIDATION, STRING_VALIDATION } from "@application";

@injectable()
@registry([
    {
        token: `ICompanyService`,
        useToken: delay(() => CompanyService)
    }
])
export class CompanyService implements ICompanyService {

    constructor(
        @inject("ICompanyRepository") private readonly repository: ICompanyRepository,
        @inject("IScheduleRepository") private readonly scheduleRepo: IScheduleRepository,
        @inject("ICloudService") private readonly cloudService: ICloudService
    ) { }


    getCompanies = async (_: Request): Promise<CompanyResponseDto> => {

        const result = await this.repository.loadComapanies();

        return new CompanyResponseDto(result);
    }

    createCompany = async (request: Request): Promise<CompanyResponseDto> => {
        const body = COMPANY_REQUEST_VALIDATION.parse(request.body);

        const newCompany = await this.repository.createCompany(body as ICompany);

        return new CompanyResponseDto(newCompany);
    }
    getCompanyById = async (request: Request): Promise<CompanyResponseDto> => {
        const id = OBJECT_ID_VALIDATION.parse(request.params.id);

        const company = await this.getCompany(id);

        company.scheduleTypes = await this.scheduleRepo.getScheduleTypes(id);

        return new CompanyResponseDto(company);
    }
    updateCompany = async (request: Request): Promise<CompanyResponseDto> => {

        const id = OBJECT_ID_VALIDATION.parse(request.params.id);
        const body = COMPANY_UPDATE_REQUEST_VALIDATION.parse(request.body);

        const company = await this.getCompany(id);

        assertCompanyOwner(request, company);

        if (body.cnpj) company.cnpj = body.cnpj;
        if (body.name) company.name = body.name;
        if (body.address) company.address = body.address;
        if (body.configuration?.openingHours) company.configuration.openingHours = body.configuration.openingHours;
        if (body.configuration?.closingTime) company.configuration.closingTime = body.configuration.closingTime;
        if (body.configuration?.defaultPeriodInMinutes) company.configuration.defaultPeriodInMinutes = body.configuration.defaultPeriodInMinutes;
        if (body.configuration?.lunchBreak) company.configuration.lunchBreak = body.configuration.lunchBreak;
        if (body.geoLocation) company.geoLocation = {
            type: "Point",
            coordinates: body.geoLocation.coordinates
        };

        if (body.logoUrl) company.logoUrl = body.logoUrl;
        
        if (body.address?.city) company.address.city = body.address.city;
        if (body.address?.cityCode) company.address.cityCode = body.address.cityCode;        
        if (body.address?.zipCode) company.address.zipCode = body.address.zipCode;
        if (body.address?.street) company.address.street = body.address.street;
        if (body.address?.number) company.address.number = body.address.number;
        if (body.address?.complement) company.address.complement = body.address.complement;
        if (body.address?.neighborhood) company.address.neighborhood = body.address.neighborhood;
        if (body.address?.state) company.address.state = body.address.state;
        if (body.address?.countryCode) company.address.countryCode = body.address.countryCode;
        
        if (body.social?.email && company.social?.email) company.social.email = body.social.email;
        if (body.social?.phone && company.social?.phone) company.social.phone = body.social.phone;
        if (body.social?.facebook && company.social?.facebook) company.social.facebook = body.social.facebook;
        if (body.social?.whatsapp && company.social?.whatsapp) company.social.whatsapp = body.social.whatsapp;
        if (body.social?.instagram && company.social?.instagram) company.social.instagram = body.social.instagram;

        const updatedCompany = await this.repository.updateCompany(id, company);

        return new CompanyResponseDto(updatedCompany);

    }

    updateLogo = async (request: Request): Promise<CompanyResponseDto> => {
        const id = OBJECT_ID_VALIDATION.parse(request.params.companyId);

        const company = await this.getCompany(id);

        // Valida a permissão antes do upload, para não gravar arquivos no storage de outra empresa
        assertCompanyOwner(request, company);

        const logoUrl = await this.cloudService.uploadImage(id, "logo", request.file?.buffer, 512);

        const updatedCompany = await this.repository.updateCompany(id, { logoUrl });

        await this.cloudService.deleteFileByUrl(id, company.logoUrl);

        return new CompanyResponseDto(updatedCompany);
    }
    
    deleteCompanyById = async (request: Request): Promise<CompanyResponseDto> => {

        const id = OBJECT_ID_VALIDATION.parse(request.params.id);

        await this.getCompany(id);

        await this.repository.deleteCompanyById(id);

        return new CompanyResponseDto();
    }

    private getCompany = async (id: string) => {
        const company = await this.repository.getCompanyById(id);

        if (!company)
            throw new NotFoundError("Empresa não localizada");

        return company;
    }

    getCompanyByDomain = async (request: Request): Promise<CompanyResponseDto> => {

        const domain = STRING_VALIDATION.parse(request.query.subdomain);
        
        const company = await this.repository.getCompanyByDomain(domain);

        if (!company)
            throw new NotFoundError("Empresa não localizada");
        
        return new CompanyResponseDto(company);
    }
}