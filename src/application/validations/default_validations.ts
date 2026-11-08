import mongoose from "mongoose";
import z from "zod";
var ObjectId = mongoose.Types.ObjectId;

export const OBJECT_ID_VALIDATION = z.string({
    error: "Campo obrigatório",
}).refine(value => {
    return ObjectId.isValid(value);
}, {
    message: "ID inválido"
});

export const STRING_VALIDATION = z.string({
    error: "Valor informado não é do tipo (string)"
})

export const NUMBER_VALIDATION = z.number({
    error: "Valor informado não é do tipo (number)"
})

export const TIME_VALIDATION = STRING_VALIDATION.regex(RegExp("^([0-1][0-9]|2[0-3]):[0-5][0-9]$"));

export const OPENING_VALIDATION = z.object({
    start: TIME_VALIDATION,
    end: TIME_VALIDATION,
});

export const PERIOD_IN_MINUTES_VALIDATION = NUMBER_VALIDATION.int({
    error: "Informe um número inteiro de minutos"
}).positive({
    error: "Informe um período maior que zero"
});

const WEEK_DAY_VALIDATION = z.number().int().min(0, { error: "Dia da semana inválido (0 a 6)" }).max(6, { error: "Dia da semana inválido (0 a 6)" });

/**
 * Dias em que a empresa funciona (0 = domingo ... 6 = sábado). Cada item pode ser só o número do dia
 * (usa o horário padrão) ou um objeto que sobrescreve abertura, fechamento e/ou almoço (null = sem almoço).
 */
export const WORKING_DAYS_VALIDATION = z.array(
    z.union([
        WEEK_DAY_VALIDATION.transform((day) => ({ day })),
        z.object({
            day: WEEK_DAY_VALIDATION,
            openingHours: TIME_VALIDATION.optional(),
            closingTime: TIME_VALIDATION.optional(),
            lunchBreak: OPENING_VALIDATION.nullable().optional(),
        }),
    ])
).nonempty({
    error: "Informe ao menos um dia de funcionamento"
}).refine((days) => new Set(days.map((item) => item.day)).size === days.length, {
    message: "Dias da semana repetidos"
}).transform((days) => [...days].sort((a, b) => a.day - b.day));

export const SOCICAL_VALIDATION = z.object({
    instagram: STRING_VALIDATION.optional(),
    facebook: STRING_VALIDATION.optional(),
    whatsapp: STRING_VALIDATION.optional(),
    email: STRING_VALIDATION.optional(),
    phone: STRING_VALIDATION.optional()
});

export const ADDRESS_VALIDATION = z.object({
    zipCode: STRING_VALIDATION.default(""),
    street: STRING_VALIDATION.default(""),
    number: STRING_VALIDATION.default(""),
    complement: STRING_VALIDATION.default(""),
    neighborhood: STRING_VALIDATION.default(""),
    city: STRING_VALIDATION.default(""),
    cityCode: STRING_VALIDATION.default(""),
    state: STRING_VALIDATION.default(""),
    countryCode: STRING_VALIDATION.default(""),
})

// Atualização de endereço: sem defaults, para que campos não enviados não sobrescrevam os já salvos
export const ADDRESS_UPDATE_VALIDATION = z.object({
    zipCode: STRING_VALIDATION.optional(),
    street: STRING_VALIDATION.optional(),
    number: STRING_VALIDATION.optional(),
    complement: STRING_VALIDATION.optional(),
    neighborhood: STRING_VALIDATION.optional(),
    city: STRING_VALIDATION.optional(),
    cityCode: STRING_VALIDATION.optional(),
    state: STRING_VALIDATION.optional(),
    countryCode: STRING_VALIDATION.optional(),
})
