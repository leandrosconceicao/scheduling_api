import z from "zod";
import { STRING_VALIDATION } from "./default_validations";

export const EMPLOYER_REQUEST_VALIDATION = z.object({
    name: STRING_VALIDATION,
})

export const EMPLOYER_UPDATE_REQUEST_VALIDATION = z.object({
    name: STRING_VALIDATION.optional(),
})