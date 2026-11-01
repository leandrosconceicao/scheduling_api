
import { Request } from "express";
import { delay, inject, injectable, registry } from "tsyringe";
import { Types } from "mongoose";

import { IScheduleService, IScheduleRepository, ICompanyRepository, ICacheService, ISchedule, IScheduleType, ICompany, NotFoundError, ScheduleState, Horario, IClient, Forbidden, CancellationOrigin, IScheduleCancellation } from "@domain";
import { assertCompanyOwner, OBJECT_ID_VALIDATION, SCHEDULE_CONFIRM_VALIDATION, SCHEDULE_FILTER_VALIDATION, SCHEDULE_VALIDATION, SCHEDULE_LOCK_REQUEST_VALIDATION, SCHEDULE_TYPE_REQUEST_VALIDATION, SCHEDULE_TYPE_UPDATE_REQUEST_VALIDATION, ScheduleResponseDto, ScheduleTypeResponseDto, SCHEDULE_CANCEL_VALIDATION } from "@application";


@injectable()
@registry([
    {
        token: "IScheduleService",
        useToken: delay(() => ScheduleService)
    }
])
export class ScheduleService implements IScheduleService {

    constructor(
        @inject("IScheduleRepository") private readonly repository: IScheduleRepository,
        @inject("ICompanyRepository") private readonly companyRepo: ICompanyRepository,
        @inject("ICacheService") private readonly cacheService: ICacheService
    ) { }

    private scheduleCacheKey(companyId: string, startsAt: Date, endsAt: Date) {
        return `${companyId}:${startsAt.toISOString()}_${endsAt.toISOString()}`;
    }

    private scheduleByIdCacheKey(companyId: string, id: string) {
        return `${companyId}:${id}`;
    }

    private formatDateToPtBr(date: Date): string {
        return new Intl.DateTimeFormat("pt-BR", {
            dateStyle: "short",
            timeStyle: "short",
        }).format(date);
    }

    private findSchedule = async (companyId: string, startsAt: Date, endsAt: Date): Promise<ISchedule | null> => {
        const schedule = await this.cacheService.getData(this.scheduleCacheKey(companyId, startsAt, endsAt));

        if (schedule) {
            return JSON.parse(schedule) as ISchedule;
        }

        return this.repository.getSchedule(companyId, startsAt, endsAt);
    }

    confirmSchedule = async (request: Request): Promise<ISchedule | null> => {
        const companyId = OBJECT_ID_VALIDATION.parse(request.params.companyId);

        const client = request.autenticatedUser as IClient;

        const newSchedule = SCHEDULE_CONFIRM_VALIDATION
            .transform((value) => {
                client.phoneNumber = value.phoneNumber;
                return {                    
                    companyId: companyId,
                    startsAt: new Date(value.startsAt),
                    endsAt: new Date(value.endsAt),
                    typeId: value.typeId,
                    employeeId: value.employeeId,
                    client: client,
                    state: ScheduleState.scheduled
                } as ISchedule
            })
            .parse(request.body);

        this.scheduleIsPassedCurrentTime(newSchedule);

        await this.getCompany(companyId);

        const schedule = await this.findSchedule(companyId, newSchedule.startsAt, newSchedule.endsAt);

        if (this.alreadyScheduled(schedule) || this.cloesedSchedule(schedule) || !this.isLockedToClient(schedule, client.uid)) {
            throw ScheduleResponseDto.badRequest(`Horário (${this.formatDateToPtBr(newSchedule.startsAt)} às ${this.formatDateToPtBr(newSchedule.endsAt)}) não está disponível`);
        }

        const createdSchedule = await this.repository.addNewSchedule(newSchedule);

        if (!createdSchedule) {
            throw ScheduleResponseDto.badRequest(`Não foi possível agendar o horário (${this.formatDateToPtBr(newSchedule.startsAt)} às ${this.formatDateToPtBr(newSchedule.endsAt)})`);
        }

        if (schedule) {
            
            const key = this.scheduleCacheKey(companyId, schedule.startsAt, schedule.endsAt);

            this.cacheService.removeData(key);
        }

        return createdSchedule;
    }

    private alreadyScheduled(value: ISchedule | null) {
        return value?.state === ScheduleState.scheduled
    }

    private cloesedSchedule(value: ISchedule | null) {
        return value?.state === ScheduleState.closed;
    }

    private isLockedToClient(schedule: ISchedule | null, clientId: string) {
        if (!schedule) {
            return true;
        }
        const isLocked = schedule?.state === ScheduleState.lock;

        const lockedToClient = schedule?.client?.uid === clientId;

        return isLocked && lockedToClient
    }


    private async getCompany(companyId: string) {
        const company = await this.companyRepo.getCompanyById(companyId);

        if (!company) {
            throw new NotFoundError("Empresa não localizada");
        }

        return company;
    }

    lockSchedule = async (request: Request): Promise<ScheduleResponseDto> => {

        const companyId = OBJECT_ID_VALIDATION.parse(request.params.companyId);

        const clientId: string = request.autenticatedUser.uid;

        const body = SCHEDULE_LOCK_REQUEST_VALIDATION
            .transform((value) => {
                return {
                    companyId: companyId,
                    startsAt: new Date(value.startsAt),
                    endsAt: new Date(value.endsAt),
                    typeId: value.typeId,
                    client: {
                        uid: clientId,
                    }
                } as ISchedule;
            })
            .parse(request.body);

        this.scheduleIsPassedCurrentTime(body);

        const company = await this.getCompany(companyId);

        body.typeDetail = await this.getScheduleType(companyId, body.typeId);

        const scheduleCheck = await this.findSchedule(companyId, body.startsAt, body.endsAt);

        const hasSchedule = this.isLockedSchedule(scheduleCheck);

        if (hasSchedule) {
            throw ScheduleResponseDto.badRequest("Horário selecionado não está disponível no momento");
        }

        await this.setSchedule(body, company, clientId);

        return new ScheduleResponseDto(body);
    }

    private scheduleIsPassedCurrentTime(value: ISchedule) {
        const now = new Date();
        if (value.startsAt < now) {
            throw ScheduleResponseDto.badRequest("Horário selecionado não está disponível");
        }
    }

    private setSchedule = async (data: ISchedule, company: ICompany, clientUid: string) => {

        const expiration = company.configuration.lockSchedulePeriodInMinutes * 60;
        const expiresAt = new Date();
        expiresAt.setSeconds(expiresAt.getSeconds() + expiration);

        data.lockPeriodDetail = {
            uid: clientUid,
            expiresAt: expiresAt
        }

        data.state = ScheduleState.lock;

        const value = JSON.stringify(data);

        await this.cacheService.setCache(this.scheduleCacheKey(company._id, data.startsAt, data.endsAt), value, expiration);

    }

    getSchedules = async (request: Request): Promise<ScheduleResponseDto> => {
        const companyId = OBJECT_ID_VALIDATION.parse(request.params.companyId);

        const company = await this.getCompany(companyId);

        const schedules = await this.mapCompanySchedules(request, company);

        const clientUid = (request.autenticatedUser as IClient)?.uid;

        // Clientes só veem os próprios dados; dos demais horários recebem apenas a ocupação
        const visibleSchedules = schedules.map((item) => {
            const belongsToClient = !!clientUid && (item.client?.uid === clientUid || item.lockPeriodDetail?.uid === clientUid);

            if (belongsToClient) return item;

            return <ISchedule>{
                ...item,
                client: undefined,
                lockPeriodDetail: item.lockPeriodDetail
                    ? { expiresAt: item.lockPeriodDetail.expiresAt } as ISchedule["lockPeriodDetail"]
                    : undefined,
            };
        });

        return new ScheduleResponseDto(visibleSchedules);
    }
    getCompanySchedules = async (request: Request): Promise<ScheduleResponseDto> => {
        const companyId = OBJECT_ID_VALIDATION.parse(request.params.companyId);

        const company = await this.getCompany(companyId);

        assertCompanyOwner(request, company);

        const schedules = await this.mapCompanySchedules(request, company, true);

        return new ScheduleResponseDto(schedules);
    }

    // includePast: o estabelecimento pode consultar o histórico; clientes veem apenas horários futuros
    private async mapCompanySchedules(request: Request, company: ICompany, includePast = false): Promise<ISchedule[]> {
        const companyId = String(company._id);

        const filters = SCHEDULE_FILTER_VALIDATION.parse(request.query);

        const now = new Date();

        now.setHours(0, 0, 0, 0);

        const startFilter = filters.startsAt ? new Date(`${filters?.startsAt}T00:00:00`) : now;
        const endFilter = filters.endsAt ? new Date(`${filters?.endsAt}T23:59:59`) : new Date(now);

        startFilter.setHours(0, 0, 0, 0);
        endFilter.setHours(23, 59, 59, 999);

        if (!includePast && startFilter < now) {
            throw ScheduleResponseDto.badRequest("Data inválida")
        }

        let mappedSchedules: ISchedule[] = [];

        const startTimeOpening = Horario.parse(company.configuration.openingHours);

        const endStartClosing = Horario.parse(company.configuration.closingTime);

        const { start, end } = company.configuration.lunchBreak;

        const horarioStartLunchBreak = Horario.parse(start);
        const horarioEndLunchBreak = Horario.parse(end);

        let startDate = new Date(startFilter.getFullYear(), startFilter.getMonth(), startFilter.getDate(), startTimeOpening.hours, startTimeOpening.minutes);
        let endDate = new Date(startFilter.getFullYear(), startFilter.getMonth(), startFilter.getDate(), endStartClosing.hours, endStartClosing.minutes)

        const startLunchBreak = new Date(startFilter.getFullYear(), startFilter.getMonth(), startFilter.getDate(), horarioStartLunchBreak.hours, horarioStartLunchBreak.minutes);
        const endLunchBreak = new Date(startFilter.getFullYear(), startFilter.getMonth(), startFilter.getDate(), horarioEndLunchBreak.hours, horarioEndLunchBreak.minutes);

        while (startDate < endDate) {
            const isLunckBreak = startDate >= startLunchBreak && startDate < endLunchBreak;

            const isToday = now.getDate() === startDate.getDate();

            const passedHour = isToday ? new Date() > startDate : false;

            let stDate = new Date(startDate);
            stDate.setMinutes(stDate.getMinutes() + company.configuration.defaultPeriodInMinutes)
            if (includePast || !passedHour) {
                mappedSchedules.push({
                    startsAt: startDate,
                    endsAt: new Date(stDate),
                    companyId: companyId,
                    client: undefined,
                    typeId: undefined,
                    state: isLunckBreak ? ScheduleState.closed : ScheduleState.open,
                });
            }
            startDate = new Date(stDate);
        }


        for (let item of mappedSchedules) {

            const value = await this.findSchedule(companyId, item.startsAt, item.endsAt);

            if (value) {
                item.client = value.client;
                item.typeId = value.typeId;
                item._id = value._id;
                item.state = value.state;
                item.typeDetail = value.typeDetail;
                item.lockPeriodDetail = value.lockPeriodDetail
            }

        }

        return mappedSchedules.filter((e) => e.state !== ScheduleState.closed);
    }
    getScheduleById = async (request: Request): Promise<ScheduleResponseDto> => {

        const schedule = await this.getClientSchedule(request);

        return new ScheduleResponseDto(schedule);
    }
    cancelSchedule = async (request: Request): Promise<ScheduleResponseDto> => {

        const { companyId, id } = this.getIds(request);

        const schedule = await this.getClientSchedule(request);

        await this.cancel(companyId, id, schedule, {
            canceledBy: CancellationOrigin.client,
            canceledAt: new Date(),
        });

        return new ScheduleResponseDto(schedule);
    }
    cancelScheduleByCompany = async (request: Request): Promise<ScheduleResponseDto> => {

        const { companyId, id } = this.getIds(request);

        const { reason } = SCHEDULE_CANCEL_VALIDATION.parse(request.body);

        assertCompanyOwner(request, await this.getCompany(companyId));

        const schedule = await this.getSchedule(request);

        await this.cancel(companyId, id, schedule, {
            canceledBy: CancellationOrigin.company,
            canceledAt: new Date(),
            reason,
        });

        return new ScheduleResponseDto(schedule);
    }

    private async cancel(companyId: string, id: string, schedule: ISchedule, cancellation: IScheduleCancellation) {
        // startsAt pode vir do cache como string
        if (new Date(schedule.startsAt) < new Date()) {
            throw ScheduleResponseDto.badRequest("Não é possível cancelar um agendamento que já passou");
        }

        await this.repository.cancelSchedule(companyId, id, cancellation);

        await this.cacheService.removeData(this.scheduleByIdCacheKey(companyId, id));

        schedule.cancellation = cancellation;
    }

    // Agendamentos contêm dados pessoais do cliente: somente quem agendou pode consultá-los ou cancelá-los
    private async getClientSchedule(request: Request) {
        const authenticatedUser = request.autenticatedUser as IClient;

        const schedule = await this.getSchedule(request);

        if (schedule.client?.uid !== authenticatedUser.uid) {
            throw new Forbidden("Operação não permitida");
        }

        return schedule;
    }
    getScheduleTypes = async (request: Request): Promise<ScheduleTypeResponseDto> => {
        const companyId = OBJECT_ID_VALIDATION.parse(request.params.companyId);

        const types = await this.repository.getScheduleTypes(companyId);

        return new ScheduleTypeResponseDto(types);
    }
    addNewScheduleType = async (request: Request): Promise<ScheduleTypeResponseDto> => {
        const companyId = OBJECT_ID_VALIDATION.parse(request.params.companyId);

        assertCompanyOwner(request, await this.getCompany(companyId));

        const model = SCHEDULE_TYPE_REQUEST_VALIDATION
            .transform((value) => {
                return <IScheduleType>{
                    companyId: companyId,
                    name: value.name,
                    price: Types.Decimal128.fromString(value.price.toFixed(2)),
                }
            })
            .parse(request.body);

        const result = await this.repository.addNewScheduleType(model);

        return new ScheduleTypeResponseDto(result);
    }
    removeScheduleType = async (request: Request): Promise<ScheduleTypeResponseDto> => {
        const companyId = OBJECT_ID_VALIDATION.parse(request.params.companyId);

        const id = OBJECT_ID_VALIDATION.parse(request.params.id);

        assertCompanyOwner(request, await this.getCompany(companyId));

        await this.getScheduleType(companyId, id);

        await this.repository.removeScheduleType(id);

        return new ScheduleTypeResponseDto();
    }
    updateScheduleTypeById = async (request: Request): Promise<ScheduleTypeResponseDto> => {
        const { companyId, id } = this.getIds(request);

        const updateRequest = SCHEDULE_TYPE_UPDATE_REQUEST_VALIDATION.parse(request.body);

        assertCompanyOwner(request, await this.getCompany(companyId));

        const scheduleType = await this.getScheduleType(companyId, id);

        if (updateRequest.name) scheduleType.name = updateRequest.name;
        if (updateRequest.price) scheduleType.price = Types.Decimal128.fromString(updateRequest.price.toString());

        const result = await this.repository.updateScheduleTypeById(id, scheduleType);

        return new ScheduleTypeResponseDto(result);
    }


    private async getSchedule(request: Request) {
        const { companyId, id } = this.getIds(request);

        const cacheValue = await this.cacheService.getData(this.scheduleByIdCacheKey(companyId, id));

        if (cacheValue) {
            return JSON.parse(cacheValue) as ISchedule;
        }

        const schedule = await this.repository.getScheduleById(companyId, id);

        if (!schedule) throw new NotFoundError("Agendamento não localizado");

        await this.cacheService.setCache(this.scheduleByIdCacheKey(companyId, id), JSON.stringify(schedule), 200);

        return schedule;
    }

    private async getScheduleType(companyId: string, id: string) {
        const type = await this.repository.getScheduleTypeById(companyId, id)

        if (!type) throw new NotFoundError("Tipo não localizado");

        return type;
    }

    private getIds(request: Request): {
        companyId: string,
        id: string,
    } {
        const companyId = OBJECT_ID_VALIDATION.parse(request.params.companyId);

        const id = OBJECT_ID_VALIDATION.parse(request.params.id);

        return {
            companyId,
            id
        }
    }

    private isLockedSchedule(scheduleCheck: ISchedule | null): boolean {

        if (!scheduleCheck) return false;

        switch (scheduleCheck!.state) {
            case ScheduleState.open:
                return false
            default:
                return true;
        }
    }

    deleteLockSchedule = async (req: Request): Promise<ScheduleResponseDto> => {

        const companyId = OBJECT_ID_VALIDATION.parse(req.params.companyId);

        const clientId = req.autenticatedUser?.uid;

        const obj = SCHEDULE_VALIDATION
            .transform((value) => {
                return <ISchedule>{
                    companyId: companyId,
                    startsAt: new Date(value.startsAt),
                    endsAt: new Date(value.endsAt),
                    client: {
                        uid: clientId,
                    },
                }
            })
            .parse(req.body);

        const key = this.scheduleCacheKey(companyId, obj.startsAt, obj.endsAt);

        const schedule = await this.cacheService.getData(key);

        if (!schedule) {
            return new ScheduleResponseDto(obj);
        }

        await this.cacheService.removeData(key);

        return new ScheduleResponseDto(JSON.parse(schedule));

    }


}