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