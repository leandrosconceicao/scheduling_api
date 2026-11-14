import { injectable, registry, delay } from "tsyringe";
import mongoose from "mongoose";
import { ICompanyScheduleFilter, ScheduleState, IScheduleRepository, IClientScheduleFilter, ISchedule, ScheduleModel, IScheduleType, ScheduleTypeModel, IScheduleCancellation } from "@domain";

var ObjectId = mongoose.Types.ObjectId;

@injectable()
@registry([
    {
        token: `IScheduleRepository`,
        useToken: delay(() => ScheduleRepository)
    }
])
export class ScheduleRepository implements IScheduleRepository {
    
    private static readonly appointmentPopulate = [
        { path: "typeDetail" },
        { path: "employeeDetail", select: "name profilePhotoUrl" },
    ];

    async getCompanyAppointments(filter: ICompanyScheduleFilter): Promise<ISchedule[]> {
        const query: Record<string, any> = { companyId: new ObjectId(filter.companyId) };

        if (filter.from || filter.to) {
            query.startsAt = {
                ...(filter.from && { $gte: filter.from }),
                ...(filter.to && { $lte: filter.to }),
            };
        }

        if (filter.employeeId) query.employeeId = new ObjectId(filter.employeeId);
        if (filter.typeId) query.typeId = new ObjectId(filter.typeId);

        if (filter.search) {
            const pattern = new RegExp(filter.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
            query.$or = [{ "client.name": pattern }, { "client.phoneNumber": pattern }];
        }

        // Cancelados são os registros com deleted=true (inclui os anteriores ao estado "canceled")
        const states = filter.states ?? [ScheduleState.scheduled, ScheduleState.completed];
        const live = states.filter((e) => e !== ScheduleState.canceled);
        const stateConditions: Record<string, any>[] = [];

        if (live.length) stateConditions.push({ deleted: null, state: { $in: live } });
        if (states.includes(ScheduleState.canceled)) stateConditions.push({ deleted: true });

        query.$and = [{ $or: stateConditions }];

        const sort = filter.order === "asc" ? 1 : -1;

        const items = await ScheduleModel.find(query)
            .sort({ startsAt: sort, _id: sort })
            .skip((filter.page - 1) * filter.limit)
            .limit(filter.limit)
            .populate(ScheduleRepository.appointmentPopulate);

        return items.map(ScheduleRepository.normalizeCanceled);
    }

    async getAppointmentById(companyId: string, id: string): Promise<ISchedule | null> {
        const item = await ScheduleModel.findOne({
            companyId: new ObjectId(companyId),
            _id: new ObjectId(id),
        }).populate(ScheduleRepository.appointmentPopulate);

        return item ? ScheduleRepository.normalizeCanceled(item) : null;
    }

    // Só conclui o que ainda está agendado (atômico: evita concluir um agendamento cancelado em paralelo)
    async completeSchedule(companyId: string, id: string): Promise<ISchedule | null> {
        const item = await ScheduleModel.findOneAndUpdate({
            companyId: new ObjectId(companyId),
            _id: new ObjectId(id),
            deleted: null,
            state: ScheduleState.scheduled,
        }, { $set: { state: ScheduleState.completed } }, { returnDocument: "after" })
            .populate(ScheduleRepository.appointmentPopulate);

        return item ? ScheduleRepository.normalizeCanceled(item) : null;
    }

    // Registros cancelados antes do estado "canceled" existir ainda estão como "scheduled"
    private static normalizeCanceled(item: any): ISchedule {
        const obj = item.toObject({ virtuals: true });

        if (obj.deleted) {
            obj.state = ScheduleState.canceled;
            obj.stateDescription = "Cancelado";
        }

        return obj;
    }

    getClientSchedules(filter: IClientScheduleFilter): Promise<ISchedule[]> {
        const now = new Date();

        const query: Record<string, unknown> = {
            "client.uid": filter.clientUid,
        };

        if (filter.companyId) query.companyId = new ObjectId(filter.companyId);

        if (!filter.includeCanceled) query.deleted = null;

        if (filter.period === "upcoming") query.startsAt = { $gte: now };
        if (filter.period === "past") query.startsAt = { $lt: now };

        // Próximos: do mais próximo ao mais distante; histórico: do mais recente ao mais antigo
        const order = filter.period === "upcoming" ? 1 : -1;

        return ScheduleModel.find(query)
            .sort({ startsAt: order })
            .skip((filter.page - 1) * filter.limit)
            .limit(filter.limit)
            .populate("typeDetail")
            .populate({ path: "employeeDetail", select: "name profilePhotoUrl" })
            // Identifica a empresa de cada agendamento (necessário na consulta sem companyId)
            .populate({ path: "companyDetail", select: "name logoUrl subdomain" });
    }

    getSchedule(companyId: string, startsAt: Date, endsAt: Date): Promise<ISchedule | null> {
        return ScheduleModel.findOne({
            companyId: new ObjectId(companyId),
            startsAt: startsAt,
            endsAt: endsAt,
            deleted: null
        })
    }

    getScheduleTypeById(companyId: string, id: string): Promise<IScheduleType | null> {
        return ScheduleTypeModel.findOne({
            companyId: new ObjectId(companyId),
            _id: new ObjectId(id)
        })
    }

    mapSchedules(companyId: string): Promise<ISchedule[]> {
        return ScheduleModel.find({
            companyId: new ObjectId(companyId),
            deleted: null
        })
    }

    addNewSchedule = async (schedule: ISchedule): Promise<ISchedule | null> => {
        const update = await ScheduleModel.findOneAndUpdate({
            companyId: new ObjectId(schedule.companyId),
            startsAt: schedule.startsAt,
            endsAt: schedule.endsAt,
            deleted: null
        }, schedule, {
            upsert: true,
            returnDocument: "after"
        });

        return ScheduleModel.findById(update?.id);
    }
    getSchedules(companyId: string, startsAt?: string, endsAt?: string): Promise<ISchedule[]> {
        const query: {
            companyId: any,
            deleted: any
            startsAt?: any,
            endsAt?: any
        } = {
            companyId: new ObjectId(companyId),
            deleted: null
        };

        if (startsAt) {
            query.startsAt = {
                $gte: new Date(startsAt)
            }
        }
        if (endsAt) {
            query.endsAt = {
                $lte: new Date(endsAt)
            }
        }
        return ScheduleModel.find(query).populate("typeDetail")
    }
    getScheduleById(companyId: string, id: string): Promise<ISchedule | null> {
        return ScheduleModel.findOne({
            companyId: new ObjectId(companyId),
            _id: new ObjectId(id),
            deleted: null
        })
            .populate("companyDetail")
            .populate("typeDetail")
    }
    async cancelSchedule(companyId: string, id: string, cancellation: IScheduleCancellation): Promise<void> {
        await ScheduleModel.findOneAndUpdate({
            companyId: new ObjectId(companyId),
            _id: new ObjectId(id)
        },
            {
                $set: {
                    deleted: true,
                    state: ScheduleState.canceled,
                    cancellation: cancellation
                }
            }
        )
    }
    updateSchedule(id: string, schedule: Partial<ISchedule>): Promise<ISchedule | null> {
        return ScheduleModel.findByIdAndUpdate(id, schedule, {
            returnDocument: "after"
        })
    }

    getScheduleTypes(companyId: string): Promise<IScheduleType[]> {
        return ScheduleTypeModel.find({
            companyId: new ObjectId(companyId),
            deleted: null
        })
    }
    addNewScheduleType(type: IScheduleType): Promise<IScheduleType> {
        return ScheduleTypeModel.create(type);
    }
    async removeScheduleType(id: string): Promise<void> {
        await ScheduleTypeModel.findOneAndUpdate({
            _id: new ObjectId(id),
        }, {
            $set: {
                deleted: true
            }
        })
    }
    updateScheduleTypeById(id: string, data: Partial<IScheduleType>): Promise<IScheduleType | null> {
        return ScheduleTypeModel.findByIdAndUpdate(id, data, {
            returnDocument: "after"
        })
    }

}