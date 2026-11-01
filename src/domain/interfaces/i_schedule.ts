import { IBase, IClient, ICompany, IEmployee, IScheduleType } from "@domain";

export interface ISchedule extends IBase {
    companyId: any,
    startsAt: Date,
    endsAt: Date,
    client?: IClient,
    typeId?: any,
    state?: string,
    stateDescription?: string,
    employeeId?: any,
    companyDetail?: ICompany,
    typeDetail?: IScheduleType | null,
    employeeDetail?: IEmployee,
    lockPeriodDetail?: {
        uid: string,
        expiresAt: Date
    },
}