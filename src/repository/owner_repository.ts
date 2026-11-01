import { IOwner, IOwnerRepository, OwnerModel } from "@domain";
import mongoose from "mongoose";

var ObjectId = mongoose.Types.ObjectId;

export class OwnerRepository implements IOwnerRepository {

    findOwner(query: Partial<IOwner>): Promise<IOwner | null> {
        const searchQuery : Partial<Pick<IOwner, "name" | "username" | "deleted" | "_id">> = {};

        if (query.name) searchQuery.name = new RegExp(query.name, "i") as any;
        if (query.username) searchQuery.username = query.username;
        if (query._id) searchQuery._id = new ObjectId(query._id);
        
        searchQuery.deleted = null as any;

        return OwnerModel.findOne(searchQuery).populate("companies");
    }

    addNewOwner(value: IOwner): Promise<IOwner | null> {
        return OwnerModel.create(value);
    }
    updateOwner(ownerId: string, values: Partial<IOwner>): Promise<IOwner | null> {
        return OwnerModel.findByIdAndUpdate(ownerId, values, {
            returnDocument: "after"
        })
    }
    deleteOwner(ownerId: string): Promise<IOwner | null> {
        return this.updateOwner(ownerId, {
            deleted: true
        });
    }

}