import z from "zod";
import { NUMBER_VALIDATION, OBJECT_ID_VALIDATION, STRING_VALIDATION } from "./default_validations";

export const SCHEDULE_VALIDATION = z.object({
    startsAt: z.iso.datetime({
        offset: true,
    }),
    endsAt: z.iso.datetime({
        offset: true
    }),
})

export const SCHEDULE_LOCK_REQUEST_VALIDATION = z.intersection(
    SCHEDULE_VALIDATION,
    z.object({
        typeId: OBJECT_ID_VALIDATION
    })
);

export const SCHEDULE_CONFIRM_VALIDATION = z.intersection(
    SCHEDULE_VALIDATION,
    z.object({
        typeId: OBJECT_ID_VALIDATION,
        employeeId: OBJECT_ID_VALIDATION,
        phoneNumber: STRING_VALIDATION,
    }))

export const SCHEDULE_REQUEST_VALIDATION = z.object({
    uid: STRING_VALIDATION,
    id: OBJECT_ID_VALIDATION
});

export const SCHEDULE_FILTER_VALIDATION = z.object({
    startsAt: z.iso.date().optional(),
    endsAt: z.iso.date().optional(),
})

export const SCHEDULE_TYPE_REQUEST_VALIDATION = z.object({
    name: STRING_VALIDATION,
    price: z.number()
})

export const SCHEDULE_TYPE_UPDATE_REQUEST_VALIDATION = z.object({
    name: STRING_VALIDATION.nonempty({
        error: "Campo não pode ser vazio"
    }).optional(),
    price: NUMBER_VALIDATION.optional()
})