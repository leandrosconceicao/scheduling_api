import { ApiResponse } from "./api_response";
import { BaseDto } from "./base_dto";
import { GeolocationType, IAddress, ICompany, ICompanyConfiguration, IScheduleType, ISocial } from "@domain";


export class CompanyDto extends BaseDto {
    cnpj: string;
    name: string;
    configuration: ICompanyConfiguration;
    address: Partial<IAddress>;
    logoUrl?: string;
    social?: Partial<ISocial>;
    geoLocation?: {
        type: GeolocationType,
        coordinates: Array<number>
    };
    scheduleTypes: IScheduleType[];
    subdomain: string;
    ownerId: any;

    constructor(entity: ICompany) {
        super(entity._id, entity.createdAt, entity.updatedAt, entity.deleted);
        this.cnpj = String(entity.cnpj);
        this.name = String(entity.name);
        this.configuration = entity.configuration;
        this.address = entity.address;
        this.logoUrl = entity.logoUrl;
        this.social = entity.social;
        this.geoLocation = entity.geoLocation;
        this.scheduleTypes = entity.scheduleTypes;
        this.subdomain = entity.subdomain;
        this.ownerId = entity.ownerId;
    }

    static toList(companies: ICompany[]) {
        return companies.map((e) => new CompanyDto(e));
    }

    static toSimpleList(companies: ICompany[]) {
        return companies.map((e) => {
            return {
                _id: e._id,
                logo: e.logoUrl,
                name: e.name,
            }
        });
    }
}

export class CompanyResponseDto extends ApiResponse {

    constructor(entity?: ICompany | ICompany[] | null, message: string = "", statusCode: number = 200) {
        super(message, statusCode, entity ? Array.isArray(entity) ? CompanyDto.toList(entity) : new CompanyDto(entity) : null);
    }
}

export class CompaniesResponseDto extends ApiResponse {
    constructor(entity: ICompany[], message: string = "", statusCode: number = 200) {

        const companies = CompanyDto.toSimpleList(entity);

        super(message, statusCode, companies);
    }
}