import { CancellationOrigin, IBase, IClient, ICompany, IEmployee, IScheduleType } from "@domain";

export interface IScheduleCancellation {
    canceledBy: CancellationOrigin,
    canceledAt: Date,
    reason?: string,
}

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
    cancellation?: IScheduleCancellation,
}