import { WeekDay } from "../enums/week_day";

export interface ILunchBreak {
    start: string,
    end: string
}

/**
 * Dia de funcionamento. Campos omitidos herdam o horário padrão da empresa;
 * `lunchBreak: null` indica que não há intervalo de almoço nesse dia.
 */
export interface IWorkingDay {
    day: WeekDay,
    openingHours?: string,
    closingTime?: string,
    lunchBreak?: ILunchBreak | null
}

export interface ICompanyConfiguration {
    defaultPeriodInMinutes: number,
    openingHours: string,
    closingTime: string,
    lunchBreak: ILunchBreak,
    lockSchedulePeriodInMinutes: number,
    workingDays: IWorkingDay[]
}
