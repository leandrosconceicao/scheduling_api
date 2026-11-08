import { injectable, registry, delay, inject } from "tsyringe";
import { Request } from "express";
import { ICompanyService, ICompanyRepository, IScheduleRepository, ICompany, IAddress, NotFoundError, ICloudService } from "@domain";
import { assertCompanyOwner, assertValidCompanyConfiguration, COMPANY_REQUEST_VALIDATION, COMPANY_UPDATE_REQUEST_VALIDATION, CompanyResponseDto, OBJECT_ID_VALIDATION, STRING_VALIDATION } from "@application";

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
        if (body.configuration) {
            const { configuration } = body;

            if (configuration.openingHours) company.configuration.openingHours = configuration.openingHours;
            if (configuration.closingTime) company.configuration.closingTime = configuration.closingTime;
            if (configuration.defaultPeriodInMinutes) company.configuration.defaultPeriodInMinutes = configuration.defaultPeriodInMinutes;
            if (configuration.lunchBreak) company.configuration.lunchBreak = configuration.lunchBreak;
            if (configuration.lockSchedulePeriodInMinutes) company.configuration.lockSchedulePeriodInMinutes = configuration.lockSchedulePeriodInMinutes;
            if (configuration.workingDays) company.configuration.workingDays = configuration.workingDays;

            // A coerência só pode ser verificada depois de mesclar o que foi enviado com o que já estava salvo
            assertValidCompanyConfiguration(company.configuration);
        }
        if (body.geoLocation) company.geoLocation = {
            type: "Point",
            coordinates: body.geoLocation.coordinates
        };

        if (body.logoUrl) company.logoUrl = body.logoUrl;
        
        // Atualiza cada campo enviado, preservando os demais; "" limpa o campo
        if (body.address) {
            company.address ??= {};

            for (const [field, value] of Object.entries(body.address)) {
                if (value !== undefined) company.address[field as keyof IAddress] = value;
            }
        }
        
        // Atualiza cada rede enviada, mesmo que ainda não houvesse valor salvo; "" limpa o campo
        if (body.social) {
            company.social ??= {};

            if (body.social.email !== undefined) company.social.email = body.social.email;
            if (body.social.phone !== undefined) company.social.phone = body.social.phone;
            if (body.social.facebook !== undefined) company.social.facebook = body.social.facebook;
            if (body.social.whatsapp !== undefined) company.social.whatsapp = body.social.whatsapp;
            if (body.social.instagram !== undefined) company.social.instagram = body.social.instagram;
        }

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