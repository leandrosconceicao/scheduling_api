import { ISchedule, IScheduleType } from "@domain";



export interface IScheduleRepository {
    addNewSchedule(schedule: ISchedule) : Promise<ISchedule | null>;
    getSchedules(companyId: string, startsAt?: string, endsAt?: string) : Promise<ISchedule[]>;
    getSchedule(companyId: string, startsAt: Date, endsAt: Date) : Promise<ISchedule | null>;
    mapSchedules(companyId: string) : Promise<ISchedule[]>;
    getScheduleById(companyId: string, id: string) : Promise<ISchedule | null>;
    cancelSchedule(companyId: string, id: string) : Promise<void>;
    updateSchedule(id: string, schedule: Partial<ISchedule>) : Promise<ISchedule | null>;
    getScheduleTypes(companyId: string) : Promise<IScheduleType[]>;
    getScheduleTypeById(companyId: string, id: string) : Promise<IScheduleType | null>;
    addNewScheduleType(type: IScheduleType) : Promise<IScheduleType>;
    removeScheduleType(id: string) : Promise<void>;
    updateScheduleTypeById(id: string, data: Partial<IScheduleType>) : Promise<IScheduleType | null>;
    getClientSchedules(companyId: string, clientUid: string) : Promise<ISchedule[]>;
}