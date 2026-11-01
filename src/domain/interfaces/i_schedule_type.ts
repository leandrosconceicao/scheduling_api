import { Types } from "mongoose"
import { IBase } from "./i_base"

export interface IScheduleType extends IBase {
    _id: any,
    companyId: any,
    name: string,
    price: Types.Decimal128,
    priceAsNumber?: number
}