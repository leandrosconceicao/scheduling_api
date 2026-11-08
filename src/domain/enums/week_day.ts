// Segue o padrão de Date.getDay(): 0 = domingo ... 6 = sábado
export enum WeekDay {
    sunday = 0,
    monday = 1,
    tuesday = 2,
    wednesday = 3,
    thursday = 4,
    friday = 5,
    saturday = 6,
}

export const ALL_WEEK_DAYS: WeekDay[] = [
    WeekDay.sunday,
    WeekDay.monday,
    WeekDay.tuesday,
    WeekDay.wednesday,
    WeekDay.thursday,
    WeekDay.friday,
    WeekDay.saturday,
];
