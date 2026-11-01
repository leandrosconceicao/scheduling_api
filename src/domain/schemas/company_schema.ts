import { ICompany } from "@domain";
import mongoose from "mongoose";

const scheduleTimeSchema = {
    type: String, validate: {
        validator: (value: string) => {
            return RegExp("^([0-1][0-9]|2[0-3]):[0-5][0-9]$").test(value);
        },
        message: (props: any) => `${props.value} é invalido`
    }
};

const companySchema = new mongoose.Schema<ICompany>({
    cnpj: { type: String, required: [true, "Cnpj é obrigatório"], minlength: 14, maxLength: 14 },
    name: { type: String, required: [true, "Nome é obrigatório"], maxLength: 200 },
    logoUrl: { type: String, default: "" },
    address: {
        zipCode: { type: String, default: "" },
        street: { type: String, default: "" },
        number: { type: String, default: "" },
        complement: { type: String, default: "" },
        neighborhood: { type: String, default: "" },
        city: { type: String, default: "" },
        cityCode: { type: String, default: "" },
        state: { type: String, default: "" },
        countryCode: { type: String, default: "" },
    },
    configuration: {
        defaultPeriodInMinutes: { type: Number, default: 30 },
        openingHours: scheduleTimeSchema,
        closingTime: scheduleTimeSchema,
        lunchBreak: {
            start: scheduleTimeSchema,
            end: scheduleTimeSchema
        },
        lockSchedulePeriodInMinutes: {type: Number, default: 10}
    },
    social: {
        instagram: { type: String, default: "" },
        facebook: { type: String, default: "" },
        whatsapp: { type: String, default: "" },
        email: { type: String, default: "" },
        phone: { type: String, default: "" },
    },
    geoLocation: {
        type: {
            type: String,
            default: 'Point',
            enum: {
                values: ['Point'],
                message: "O tipo {VALUE} não é um valor de TYPE permitido"
            }
        },
        coordinates: [{ type: Number, required: true }]
    },
    ownerId: {
        type: mongoose.Types.ObjectId,
        ref: "owners",
        required: [true, "Parametro ({VALUE}) é obrigatório"]
    },
    deleted: { type: Boolean, default: undefined },
    scheduleTypes: [],
    subdomain: {
        type: String,
        required: [true, "Parametro ({VALUE}) é obrigatório"]
    },
}, {
    timestamps: true,
    versionKey: false
})

companySchema.index({ cnpj: 1, deleted: 1 }, {
    unique: true, partialFilterExpression: {
        deleted: null
    }
})

companySchema.pre("save", function () {
    this.cnpj = this.cnpj?.toUpperCase()
})

const CompanyModel = mongoose.model<ICompany>("companies", companySchema);

export {CompanyModel};

