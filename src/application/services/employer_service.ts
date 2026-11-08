import { delay, inject, injectable, registry } from "tsyringe";
import { Request } from "express";
import { ICloudService, ICompanyRepository, IEmployee, IEmployerRepository, IEmployerService, NotFoundError } from "@domain";
import { assertCompanyOwner, EMPLOYER_REQUEST_VALIDATION, EMPLOYER_UPDATE_REQUEST_VALIDATION, EmployeeResponseDto, OBJECT_ID_VALIDATION } from "@application";

@injectable()
@registry([
    {
        token: "IEmployerService",
        useToken: delay(() => EmployerService)
    }
])
export class EmployerService implements IEmployerService {

    constructor(
        @inject("IEmployerRepository") private readonly repository: IEmployerRepository,
        @inject("ICompanyRepository") private readonly companyRepo: ICompanyRepository,
        @inject("ICloudService") private readonly cloudService: ICloudService
    ) { }
    getEmployers = async (request: Request): Promise<EmployeeResponseDto> => {
        const companyId = OBJECT_ID_VALIDATION.parse(request.params.companyId);

        const result = await this.repository.getEmployers(companyId);

        return new EmployeeResponseDto(result);
    }
    getCompanyEmployers = async (request: Request): Promise<EmployeeResponseDto> => {
        const companyId = OBJECT_ID_VALIDATION.parse(request.params.companyId);

        await this.assertCompanyOwnership(request, companyId);

        const result = await this.repository.getEmployers(companyId);

        return new EmployeeResponseDto(result);
    }

    createEmployer =async (request: Request): Promise<EmployeeResponseDto> => {

        const companyId = OBJECT_ID_VALIDATION.parse(request.params.companyId);

        await this.assertCompanyOwnership(request, companyId);

        const employer = EMPLOYER_REQUEST_VALIDATION
            .transform((value) => {
                return <IEmployee>{
                    name: value.name,
                    companyId: companyId
                }
            })
            .parse(request.body);

        const result = await this.repository.addEmployer(employer);

        return new EmployeeResponseDto(result);
    }
    getEmployerById = async (request: Request): Promise<EmployeeResponseDto> => {
        const employer = await this.getEmployer(request);

        return new EmployeeResponseDto(employer);
    }


    updateEmployer = async (request: Request): Promise<EmployeeResponseDto> => {

        const employer = await this.getEmployer(request);

        await this.assertCompanyOwnership(request, String(employer.companyId));

        const updateEmployer = EMPLOYER_UPDATE_REQUEST_VALIDATION
            .transform((value) => {
                return <Partial<IEmployee>>{
                    name: value.name
                }
            })
            .parse(request.body);

        if (updateEmployer.name) employer.name = updateEmployer.name;

        const newEmployer = await this.repository.updateEmployer(employer._id, employer);

        return new EmployeeResponseDto(newEmployer)
    }


    updatePhoto = async (request: Request): Promise<EmployeeResponseDto> => {

        const employer = await this.getEmployer(request);

        const companyId = String(employer.companyId);

        // Valida a permissão antes do upload, para não gravar arquivos no storage de outra empresa
        await this.assertCompanyOwnership(request, companyId);

        const previousPhotoUrl = employer.profilePhotoUrl;

        employer.profilePhotoUrl = await this.cloudService.uploadImage(companyId, `employees/${employer._id}`, request.file?.buffer, 256);

        const newEmployer = await this.repository.updateEmployer(employer._id, employer);

        await this.cloudService.deleteFileByUrl(companyId, previousPhotoUrl);

        return new EmployeeResponseDto(newEmployer);
    }

    deleteEmployerById = async (request: Request): Promise<EmployeeResponseDto> => {
        const employer = await this.getEmployer(request);

        await this.assertCompanyOwnership(request, String(employer.companyId));

        await this.repository.removeEmployer(employer.companyId, employer._id);

        return new EmployeeResponseDto();
    }

    private async assertCompanyOwnership(request: Request, companyId: string) {
        const company = await this.companyRepo.getCompanyById(companyId);

        if (!company) {
            throw new NotFoundError("Empresa não localizada");
        }

        assertCompanyOwner(request, company);
    }

    private getRequestParams(request: Request): { companyId: string, id: string } {
        const companyId = OBJECT_ID_VALIDATION.parse(request.params.companyId);
        const id = OBJECT_ID_VALIDATION.parse(request.params.id);

        return {
            companyId,
            id
        }
    }

    private async getEmployer(request: Request) {
        const { companyId, id } = this.getRequestParams(request);

        const employer = await this.repository.getEmployer(companyId, id);

        if (!employer) {
            throw new NotFoundError("Dados não localizados");
        }

        return employer;
    }
}