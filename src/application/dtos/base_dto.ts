export class BaseDto {
    _id?: any;
    createdAt?: Date;
    updatedAt?: Date;
    deleted?: boolean;

    constructor(id: any, createdAt?: Date, updatedAt?: Date, deleted?: boolean) {
        this._id = id;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
        this.deleted = deleted;
    }
}