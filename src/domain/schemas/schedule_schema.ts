import { ScheduleState, ISchedule, CancellationOrigin } from "@domain";
import mongoose from "mongoose";

var ObjectId = mongoose.Types.ObjectId;

const requireMsg = "Parametro ({VALUE}) é obrigatório";

const scheduleSchema = new mongoose.Schema<ISchedule>({
    companyId: {type: ObjectId, ref: "companies", required: [true, requireMsg]},
    startsAt: {type: Date, required: [true, requireMsg]},
    endsAt: {type: Date, required: [true, requireMsg]},
    client: {
        uid: {type: String, required: [true, requireMsg]},
        name: {type: String, required: [true, requireMsg],},
        phoneNumber: {type: String, required: [true, requireMsg], length: 14},
        email: {type: String, lowercase: true, default: undefined}
    },
    typeId: {
        type: ObjectId,
        ref: "scheduleTypes",
        required: [true, requireMsg]
    },
    state: {
        type: String,
        enum: {
            values: Object.values(ScheduleState),
            message: "State {VALUE} não é um valor de permitido"
        },
        default: ScheduleState.open
    },
    employeeId: {
        type: ObjectId,
        ref: "employees",
        required: [true, requireMsg]
    },
    lockPeriodDetail: {
        type: {
            uid: String,
            expiresAt: Date
        },
        default: undefined
    },
    cancellation: {
        type: {
            canceledBy: {
                type: String,
                enum: {
                    values: Object.values(CancellationOrigin),
                    message: "Origem {VALUE} não é um valor permitido"
                }
            },
            canceledAt: Date,
            reason: String
        },
        default: undefined
    },
    deleted: {
        type: Boolean,
        default: undefined
    }
}, {
    timestamps: true,
    versionKey: false
})

scheduleSchema.index({
    companyId: 1,
    deleted: 1,
    startsAt: 1,
    endsAt: 1
}, {
    unique: true, partialFilterExpression: { deleted: null }
});

// Consulta dos agendamentos do cliente
scheduleSchema.index({ companyId: 1, "client.uid": 1, startsAt: 1 });
scheduleSchema.index({ "client.uid": 1, startsAt: 1 });

scheduleSchema.virtual("companyDetail", {
    justOne: true,
    ref: "companies",
    localField: "companyId",
    foreignField: "_id"
})

scheduleSchema.virtual("typeDetail", {
    justOne: true,
    ref: "scheduleTypes",
    localField: "typeId",
    foreignField: "_id"
})

scheduleSchema.virtual("employeeDetail", {
    justOne: true,
    ref: "employees",
    localField: "employeeId",
    foreignField: "_id"
});

scheduleSchema.virtual("stateDescription").get(function() {
    switch (this.state) {
        case ScheduleState.closed:
            return "Fechado";
        case ScheduleState.lock:
            return "Bloqueado";
        case ScheduleState.scheduled:
            return "Reservado";
        default:
            return "Aberto"
    }
});

scheduleSchema.set('toObject', { virtuals: true });
scheduleSchema.set('toJSON', { virtuals: true });
const ScheduleModel = mongoose.model<ISchedule>("schedules", scheduleSchema);

export {ScheduleModel};