import z from "zod";
import { BusinessHours, ICompanyConfiguration } from "@domain";
import { ADDRESS_UPDATE_VALIDATION, ADDRESS_VALIDATION, OBJECT_ID_VALIDATION, OPENING_VALIDATION, PERIOD_IN_MINUTES_VALIDATION, SOCICAL_VALIDATION, STRING_VALIDATION, TIME_VALIDATION, WORKING_DAYS_VALIDATION } from "./default_validations";

/**
 * Valida a coerência da configuração efetiva (abertura antes do fechamento, almoço com início antes do fim),
 * tanto no horário padrão quanto nos horários próprios de cada dia. Lança ZodError (406) se houver problema.
 */
export function assertValidCompanyConfiguration(configuration: ICompanyConfiguration) {
    const issues = new BusinessHours(configuration).issues();

    if (issues.length) {
        throw new z.ZodError(issues.map((issue) => ({ code: "custom" as const, input: undefined, ...issue })));
    }
}

export const COMPANY_REQUEST_VALIDATION = z.object({
    cnpj: STRING_VALIDATION.nonempty().length(14),
    name: STRING_VALIDATION.nonempty().max(200),
    logoUrl: STRING_VALIDATION.default(""),
    address: ADDRESS_VALIDATION.optional(),
    configuration: z.object({
        defaultPeriodInMinutes: PERIOD_IN_MINUTES_VALIDATION,
        openingHours: TIME_VALIDATION.default("08:00"),
        closingTime: TIME_VALIDATION.default("18:00"),
        lunchBreak: OPENING_VALIDATION.default({
            start: "12:00",
            end: "13:00"
        }),
        lockSchedulePeriodInMinutes: PERIOD_IN_MINUTES_VALIDATION.optional(),
        workingDays: WORKING_DAYS_VALIDATION.default([0, 1, 2, 3, 4, 5, 6].map((day) => ({ day })))
    }).superRefine((configuration, ctx) => {
        for (const issue of new BusinessHours(configuration as ICompanyConfiguration).issues()) {
            ctx.addIssue({ code: "custom", message: issue.message, path: issue.path.slice(1) });
        }
    }),
    social: SOCICAL_VALIDATION.optional(),
    subdomain: STRING_VALIDATION,
    ownerId: OBJECT_ID_VALIDATION,
    geoLocation: z.object({
        type: STRING_VALIDATION.default("Point"),
        coordinates: z.array(z.number()),
    }).optional()
})

export const COMPANY_UPDATE_REQUEST_VALIDATION = z.object({
    cnpj: STRING_VALIDATION.length(14, {
        error: "Necessário 14 caracteres"
    }).optional(),
    name: STRING_VALIDATION.nonempty({
        error: "Campo não pode ser vazio"
    }).max(200, {
        error: "Tamanho máximo de 200 caracteres excedido"
    }).optional(),
    logoUrl: STRING_VALIDATION.optional(),
    address: ADDRESS_UPDATE_VALIDATION.optional(),
    // Atualização parcial: somente os campos enviados são alterados; workingDays, se enviado, substitui a lista inteira
    configuration: z.object({
        defaultPeriodInMinutes: PERIOD_IN_MINUTES_VALIDATION.optional(),
        openingHours: TIME_VALIDATION.optional(),
        closingTime: TIME_VALIDATION.optional(),
        lunchBreak: OPENING_VALIDATION.optional(),
        lockSchedulePeriodInMinutes: PERIOD_IN_MINUTES_VALIDATION.optional(),
        workingDays: WORKING_DAYS_VALIDATION.optional()
    }).optional(),
    social: SOCICAL_VALIDATION.optional(),
    geoLocation: z.object({
        type: STRING_VALIDATION.default("Point"),
        coordinates: z.array(z.number()),
    }).optional()
})