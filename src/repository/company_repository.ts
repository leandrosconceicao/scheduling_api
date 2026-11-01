
import { delay, injectable, registry } from "tsyringe";
import mongoose from "mongoose";
import { CompanyModel, ICompany, ICompanyRepository } from "@domain";

var ObjectId = mongoose.Types.ObjectId;

@injectable()
@registry([
    {
        token: `ICompanyRepository`,
        useToken: delay(() => CompanyRepository)
    }
])
export class CompanyRepository implements ICompanyRepository {
    
    loadComapanies(): Promise<ICompany[]> {
        return CompanyModel.find({
            deleted: null
        });
    }

    
    createCompany(company: ICompany): Promise<ICompany> {
        return CompanyModel.create(company);
    }
    
    getCompanyById(id: string): Promise<ICompany | null> {
        return CompanyModel.findOne({
            _id: new ObjectId(id),
            deleted: null
        });
    }

    getCompanyByDomain(domain: string): Promise<ICompany | null> {
        return CompanyModel.findOne({
            subdomain: domain,
            deleted: null
        });
    }

    updateCompany(id: string, company: Partial<ICompany>): Promise<ICompany | null> {
        return CompanyModel.findByIdAndUpdate(id, company, {
            returnDocument: "after"
        })
    }
    async deleteCompanyById(id: string): Promise<void> {
        await CompanyModel.findOneAndUpdate({
            _id: new ObjectId(id)
        },
            {
                $set: {
                    deleted: true
                }
            }
        )
    }
}