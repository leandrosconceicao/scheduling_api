export interface ICompanyConfiguration {
    defaultPeriodInMinutes: number,
    openingHours: string,
    closingTime: string,
    lunchBreak: {
        start: string,
        end: string
    },
    lockSchedulePeriodInMinutes: number
}