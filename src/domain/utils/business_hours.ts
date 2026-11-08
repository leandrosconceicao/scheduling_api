import { ALL_WEEK_DAYS } from "../enums/week_day";
import { ICompanyConfiguration, ILunchBreak, IWorkingDay } from "../interfaces/i_company_configuration";
import { Horario } from "./horario";

const atTime = (day: Date, time: string) => {
    const horario = Horario.parse(time);
    return new Date(day.getFullYear(), day.getMonth(), day.getDate(), horario.hours, horario.minutes);
};

export interface DayPeriods {
    opening: Date,
    closing: Date,
    lunchStart?: Date,
    lunchEnd?: Date,
}

export class BusinessHours {
    constructor(private readonly configuration: ICompanyConfiguration) { }

    // Empresas cadastradas antes da configuração de dias continuam abertas todos os dias
    get workingDays(): IWorkingDay[] {
        const days = this.configuration.workingDays;
        if (!days?.length) return ALL_WEEK_DAYS.map((day) => ({ day }));

        // Compatibilidade com o formato antigo (lista de números)
        return days.map((item) => typeof item === "number" ? { day: item } : item);
    }

    workingDayOf(date: Date): IWorkingDay | undefined {
        return this.workingDays.find((item) => item.day === date.getDay());
    }

    isOpenOn(date: Date): boolean {
        return !!this.workingDayOf(date);
    }

    /** Horário efetivo do dia: o definido no próprio dia ou, na falta dele, o padrão da empresa. */
    hoursOf(workingDay?: IWorkingDay): { openingHours: string, closingTime: string, lunchBreak: ILunchBreak | null } {
        const { openingHours, closingTime, lunchBreak } = this.configuration;

        const effectiveLunch = workingDay?.lunchBreak === undefined ? lunchBreak : workingDay.lunchBreak;

        return {
            openingHours: workingDay?.openingHours ?? openingHours,
            closingTime: workingDay?.closingTime ?? closingTime,
            // Almoço incompleto (ex.: documento antigo sem start/end) equivale a não ter almoço
            lunchBreak: effectiveLunch?.start && effectiveLunch?.end
                ? { start: effectiveLunch.start, end: effectiveLunch.end }
                : null,
        };
    }

    /** Abertura, fechamento e intervalo de almoço no dia informado (horário local). */
    periodsOn(date: Date): DayPeriods {
        const { openingHours, closingTime, lunchBreak } = this.hoursOf(this.workingDayOf(date));

        return {
            opening: atTime(date, openingHours),
            closing: atTime(date, closingTime),
            lunchStart: lunchBreak ? atTime(date, lunchBreak.start) : undefined,
            lunchEnd: lunchBreak ? atTime(date, lunchBreak.end) : undefined,
        };
    }

    /** Indica se o intervalo [startsAt, endsAt) cabe no expediente: dia útil, dentro do horário e fora do almoço. */
    accepts(startsAt: Date, endsAt: Date): boolean {
        if (endsAt <= startsAt) return false;

        if (!this.isOpenOn(startsAt)) return false;

        const { opening, closing, lunchStart, lunchEnd } = this.periodsOn(startsAt);

        if (startsAt < opening || endsAt > closing) return false;

        const overlapsLunch = !!lunchStart && !!lunchEnd && startsAt < lunchEnd && endsAt > lunchStart;

        return !overlapsLunch;
    }

    /** Inconsistências da configuração (horário padrão e de cada dia). Lista vazia = configuração válida. */
    issues(): { path: (string | number)[], message: string }[] {
        const issues: { path: (string | number)[], message: string }[] = [];

        const check = (path: (string | number)[], hours: ReturnType<BusinessHours["hoursOf"]>) => {
            if (hours.openingHours >= hours.closingTime) {
                issues.push({ path: [...path, "closingTime"], message: "Horário de fechamento deve ser após a abertura" });
            }
            if (hours.lunchBreak && hours.lunchBreak.start >= hours.lunchBreak.end) {
                issues.push({ path: [...path, "lunchBreak"], message: "Fim do almoço deve ser após o início" });
            }
        };

        check(["configuration"], this.hoursOf());

        this.workingDays.forEach((workingDay, index) => {
            check(["configuration", "workingDays", index], this.hoursOf(workingDay));
        });

        return issues;
    }
}
