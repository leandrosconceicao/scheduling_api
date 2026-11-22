import { GeolocationType, IAddress, IBase, ICompanyConfiguration, IScheduleType, ISocial } from "@domain";

export interface ICompany extends IBase {
    cnpj: string,
    name: string,
    configuration: ICompanyConfiguration,
    address: Partial<IAddress>,
    logoUrl?: string,
    social?: Partial<ISocial>,
    geoLocation?: {
        type: GeolocationType,
        coordinates: Array<number>
    },
    scheduleTypes: IScheduleType[],
    subdomain: string,
    ownerId: any,
    // Chave de acesso à API de envio de mensagens (nunca é retornada nas respostas da API)
    apiKey?: string,
}