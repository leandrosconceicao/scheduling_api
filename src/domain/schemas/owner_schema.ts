import { IOwner, OwnerRole } from "@domain";
import mongoose from "mongoose";

const owner_schema = new mongoose.Schema<IOwner>({
    name: String,
    username: String,
    password: String,
    role: {
        type: String,
        enum: {
            values: Object.values(OwnerRole),
            message: "Role {VALUE} não é um valor permitido"
        },
        default: OwnerRole.owner
    },
    deleted: {
        type: Boolean,
        default: undefined
    }
}, {
    timestamps: true,
    versionKey: false
});

owner_schema.virtual("companies", {
    foreignField: "ownerId",
    localField: "_id",
    ref: "companies",
    match: { deleted: null }
})

owner_schema.set('toObject', { virtuals: true });
owner_schema.set('toJSON', { virtuals: true });

owner_schema.index({ username: 1, deleted: 1 }, {
    unique: true, partialFilterExpression: {
        deleted: null
    }
});

const OwnerModel = mongoose.model<IOwner>("owners", owner_schema);

export {OwnerModel};