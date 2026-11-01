import z from "zod";
import { ADDRESS_VALIDATION, NUMBER_VALIDATION, OBJECT_ID_VALIDATION, OPENING_VALIDATION, SOCICAL_VALIDATION, STRING_VALIDATION, TIME_VALIDATION } from "./default_validations";

export const COMPANY_REQUEST_VALIDATION = z.object({
    cnpj: STRING_VALIDATION.nonempty().length(14),
    name: STRING_VALIDATION.nonempty().max(200),
    logoUrl: STRING_VALIDATION.default(""),
    address: ADDRESS_VALIDATION.optional(),
    configuration: z.object({
        defaultPeriodInMinutes: z.number(),
        openingHours: TIME_VALIDATION.default("08:00"),
        closingTime: TIME_VALIDATION.default("18:00"),
        lunchBreak: OPENING_VALIDATION.default({
            start: "12:00",
            end: "13:00"
        })
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
    address: ADDRESS_VALIDATION.optional(),
    configuration: z.object({
        defaultPeriodInMinutes: NUMBER_VALIDATION,
        openingHours: TIME_VALIDATION,
        closingTime: TIME_VALIDATION,
        lunchBreak: OPENING_VALIDATION
    }).optional(),
    social: SOCICAL_VALIDATION.optional(),
    geoLocation: z.object({
        type: STRING_VALIDATION.default("Point"),
        coordinates: z.array(z.number()),
    }).optional()
})