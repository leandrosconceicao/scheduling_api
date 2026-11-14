import z from "zod";
import { ScheduleState } from "@domain";
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

export const CLIENT_SCHEDULE_FILTER_VALIDATION = z.object({
    // upcoming: a partir de agora (padrão); past: já iniciados; all: todos
    period: z.enum(["upcoming", "past", "all"], {
        error: "Período inválido (upcoming, past ou all)"
    }).default("upcoming"),
    includeCanceled: z.stringbool({
        error: "Informe true ou false"
    }).default(false),
    page: z.coerce.number().int().min(1, { error: "Página deve ser maior ou igual a 1" }).default(1),
    limit: z.coerce.number().int().min(1, { error: "Limite deve ser entre 1 e 100" }).max(100, { error: "Limite deve ser entre 1 e 100" }).default(20),
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

export const SCHEDULE_CANCEL_VALIDATION = z.object({
    reason: STRING_VALIDATION.trim().nonempty({
        error: "Informe o motivo do cancelamento"
    }).max(500, {
        error: "Tamanho máximo de 500 caracteres excedido"
    })
})


const CSV_STATES = z.string().transform((value) => value.split(",").map((e) => e.trim()).filter(Boolean))
    .pipe(z.array(z.enum([ScheduleState.scheduled, ScheduleState.completed, ScheduleState.canceled], {
        error: "Estado inválido (scheduled, completed ou canceled)"
    })).min(1));

// Listagem de agendamentos do estabelecimento. from/to são instantes (ISO com offset) aplicados ao início do agendamento
export const COMPANY_APPOINTMENT_FILTER_VALIDATION = z.object({
    from: z.iso.datetime({ offset: true }).optional(),
    to: z.iso.datetime({ offset: true }).optional(),
    employeeId: OBJECT_ID_VALIDATION.optional(),
    typeId: OBJECT_ID_VALIDATION.optional(),
    // Lista separada por vírgula. Ausente: agendados e concluídos
    state: CSV_STATES.optional(),
    search: z.string().trim().min(1).max(100).optional(),
    order: z.enum(["asc", "desc"], { error: "Ordem inválida (asc ou desc)" }).default("asc"),
    page: z.coerce.number().int().min(1, { error: "Página deve ser maior ou igual a 1" }).default(1),
    limit: z.coerce.number().int().min(1, { error: "Limite deve ser entre 1 e 100" }).max(100, { error: "Limite deve ser entre 1 e 100" }).default(20),
}).refine((v) => !v.from || !v.to || v.from <= v.to, { error: "from deve ser anterior a to" })

export const SCHEDULE_STATE_UPDATE_VALIDATION = z.object({
    // O cancelamento tem rota própria (exige motivo)
    state: z.enum([ScheduleState.completed], { error: "Estado inválido (completed)" })
})
