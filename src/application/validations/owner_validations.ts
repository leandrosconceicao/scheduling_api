import z from "zod";
import { STRING_VALIDATION } from "./default_validations";


export const OWNER_AUTH_VALIDATION = z.object({
    username: STRING_VALIDATION,
    password: STRING_VALIDATION
}, {
    error: "JSON inválido"
})


export const OWNER_CREATE_VALIDATION = z.intersection(
    OWNER_AUTH_VALIDATION,
    z.object({
        name: STRING_VALIDATION,
    })
)

export const OWNER_UPDATE_VALIDATION = z.object({
    password: STRING_VALIDATION.optional(),
    name: STRING_VALIDATION.optional(),
})