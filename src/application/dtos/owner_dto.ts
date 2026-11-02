import { ApiResponse } from "./api_response";
import { CompanyDto } from "./company_dto";
import { IOwner } from "@domain";

export class OwnerResponseDto extends ApiResponse {    

    constructor(entity?: IOwner, message: string = "", statusCode: number = 200) {
        const value = {
            name: entity?.name,
            username: entity?.username,
            companies: CompanyDto.toSimpleList(entity?.companies ?? []),
        }
        super(message, statusCode, value);
    }

    static authenticated(entity: IOwner, token: string) {
        const response = new OwnerResponseDto(entity, "Sucesso");
        response.dados.token = token;

        return response;
    }
}