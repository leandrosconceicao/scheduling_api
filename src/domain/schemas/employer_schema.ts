import { IEmployee } from "@domain";
import mongoose from "mongoose";

var ObjectId = mongoose.Types.ObjectId;

const employerSchema = new mongoose.Schema<IEmployee>({
    name: { type: String, required: [true, "Parametro ({VALUE}) é obrigatório"] },
    profilePhotoUrl: { type: String, default: undefined },
    companyId: { type: ObjectId, ref: "companies", required: [true, "Parametro ({VALUE}) é obrigatório"] },
    deleted: { type: Boolean, default: undefined },
    rating: {type: Number, default: 5},
}, {
    timestamps: true,
    versionKey: false
});

employerSchema.index({
    name: 1, companyId: 1,
}, {
    unique: true, partialFilterExpression: {
        deleted: null
    }
});

const EmployeeModel = mongoose.model<IEmployee>("employees", employerSchema);

export {EmployeeModel};

