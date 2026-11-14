import { ISchedule, IScheduleCancellation, IScheduleType } from "@domain";

export interface IClientScheduleFilter {
    // Ausente: agendamentos do cliente em todas as empresas
    companyId?: string,
    clientUid: string,
    period: "upcoming" | "past" | "all",
    includeCanceled: boolean,
    page: number,
    limit: number,
}



export interface ICompanyScheduleFilter {
    companyId: string,
    // Intervalo aplicado ao início do agendamento (startsAt)
    from?: Date,
    to?: Date,
    employeeId?: string,
    typeId?: string,
    states?: string[],
    // Nome ou telefone do cliente
    search?: string,
    order: "asc" | "desc",
    page: number,
    limit: number,
}

export interface IScheduleRepository {
    getCompanyAppointments(filter: ICompanyScheduleFilter) : Promise<ISchedule[]>;
    completeSchedule(companyId: string, id: string) : Promise<ISchedule | null>;
    getAppointmentById(companyId: string, id: string) : Promise<ISchedule | null>;
    addNewSchedule(schedule: ISchedule) : Promise<ISchedule | null>;
    getSchedules(companyId: string, startsAt?: string, endsAt?: string) : Promise<ISchedule[]>;
    getSchedule(companyId: string, startsAt: Date, endsAt: Date) : Promise<ISchedule | null>;
    mapSchedules(companyId: string) : Promise<ISchedule[]>;
    getScheduleById(companyId: string, id: string) : Promise<ISchedule | null>;
    cancelSchedule(companyId: string, id: string, cancellation: IScheduleCancellation) : Promise<void>;
    updateSchedule(id: string, schedule: Partial<ISchedule>) : Promise<ISchedule | null>;
    getScheduleTypes(companyId: string) : Promise<IScheduleType[]>;
    getScheduleTypeById(companyId: string, id: string) : Promise<IScheduleType | null>;
    addNewScheduleType(type: IScheduleType) : Promise<IScheduleType>;
    removeScheduleType(id: string) : Promise<void>;
    updateScheduleTypeById(id: string, data: Partial<IScheduleType>) : Promise<IScheduleType | null>;
    getClientSchedules(filter: IClientScheduleFilter) : Promise<ISchedule[]>;
}