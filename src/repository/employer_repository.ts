
import { IEmployerRepository, IEmployee, EmployeeModel } from "@domain";
import mongoose from "mongoose";
import { delay, injectable, registry } from "tsyringe";

var ObjectId = mongoose.Types.ObjectId;

@injectable()
@registry([
    {
        token: "IEmployerRepository",
        useToken: delay(() => EmployerRepository)
    }
])
export class EmployerRepository implements IEmployerRepository {
    getEmployer(companyId: string, id: string): Promise<IEmployee | null> {
        return EmployeeModel.findOne({
            _id: new ObjectId(id),
            companyId: new ObjectId(companyId),
            deleted: null
        });
    }
    addEmployer(newEmployer: IEmployee): Promise<IEmployee | null> {
        return EmployeeModel.create(newEmployer);
    }
    getEmployers(companyId: string): Promise<IEmployee[]> {
        return EmployeeModel.find({
            companyId: new ObjectId(companyId),
            deleted: null
        })
    }
    removeEmployer = async (companyId: string, id: string): Promise<void> => {
        await EmployeeModel.findOneAndUpdate({
            _id: new ObjectId(id)
        },
            {
                $set: {
                    deleted: true
                }
            }
        )
    }
    updateEmployer(id: string, data: Partial<IEmployee>): Promise<IEmployee | null> {
        return EmployeeModel.findByIdAndUpdate(id, data, {
            returnDocument: "after"
        })
    }
}