import {Schema, Types, model} from "mongoose";
import { IScheduleType } from "@domain";

var ObjectId = Types.ObjectId;

const scheduleTypeSchema = new Schema<IScheduleType>({
    companyId: {
        type: ObjectId,
        ref: "companies",
        required: [true, "O Parametro ({VALUE}) é obrigatório"]
    },
    name: {type: String, required: [true, "O Parametro ({VALUE}) é obrigatório"]},
    price: {type: Types.Decimal128, required: [true, "O Parametro ({VALUE}) é obrigatório"]},
    deleted: {type: Boolean, default: undefined}
}, {
    timestamps: true,
    versionKey: false,
    toJSON: {
        virtuals: true,
    },
    toObject: {
        virtuals: true
    }
})

scheduleTypeSchema.index({
    companyId: 1,
    name: 1,
    deleted: 1,
}, {
    unique: true, partialFilterExpression: {
        deleted: null
    }
})

scheduleTypeSchema.virtual("priceAsNumber").get(function() {
    return parseFloat(this.price.toString())
})

const ScheduleTypeModel = model<IScheduleType>("scheduleTypes", scheduleTypeSchema);

export {ScheduleTypeModel};