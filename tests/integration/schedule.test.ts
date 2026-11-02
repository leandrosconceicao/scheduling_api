import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CancellationOrigin, ScheduleModel, ScheduleState } from "@domain";
import { dbEvents, fakeCache, clientToken } from "../support/fakes";
import {
    api, bearer, client, createCompany, createOwnerWithToken, initDatabase, localDate, resetState, setupCompanyScenario, slot,
} from "../support/helpers";

type Scenario = Awaited<ReturnType<typeof setupCompanyScenario>>;

const PHONE = "+5581999999999";

describe("Agendamentos", () => {
    let s: Scenario;
    const ana = client("ana");
    const bruno = client("bruno");

    const lock = (c = ana, when = slot(10), typeId = s.typeId) =>
        api().post(`/lock_schedule/${s.companyId}`).set(bearer(c.token)).send({ ...when, typeId });

    const confirm = (c = ana, when = slot(10), extra: Record<string, unknown> = {}) =>
        api().post(`/schedules/${s.companyId}`).set(bearer(c.token))
            .send({ ...when, typeId: s.typeId, employeeId: s.employeeId, phoneNumber: PHONE, ...extra });

    /** Reserva + confirma e devolve o agendamento criado. */
    const book = async (c = ana, when = slot(10)) => {
        await lock(c, when);
        const res = await confirm(c, when);
        return { res, id: res.body.dados?._id as string, when };
    };

    beforeAll(initDatabase);
    beforeEach(async () => {
        await resetState();
        s = await setupCompanyScenario();
    });

    describe("POST /lock_schedule/:companyId (reserva temporária)", () => {
        it("reserva o horário no cache pelo tempo configurado na empresa e notifica em tempo real", async () => {
            const when = slot(10);

            const res = await lock(ana, when);

            expect(res.status).toBe(200);
            expect(res.body.dados).toMatchObject({
                state: ScheduleState.lock,
                typeId: s.typeId,
                client: { uid: "ana" },
                lockPeriodDetail: { uid: "ana" },
                typeDetail: { name: "Corte" },
            });

            // 10 min (default da empresa) = 600s
            const [ttl] = [...fakeCache.ttls.values()];
            expect(ttl).toBe(600);

            // Reserva é temporária: nada é gravado no banco
            expect(await ScheduleModel.countDocuments()).toBe(0);

            expect(dbEvents).toEqual([
                { path: `${s.companyId}/${new Date(when.startsAt).toISOString().split("T")[0]}`, value: { deliveryIdEvent: expect.any(String) } },
            ]);
        });

        it("impede que outro cliente reserve o mesmo horário", async () => {
            await lock(ana);

            const res = await lock(bruno);

            expect(res.status).toBe(400);
            expect(res.body.message).toMatch(/não está disponível/);
        });

        it("o mesmo cliente que já reservou também recebe 400 ao reservar de novo", async () => {
            await lock(ana);

            expect((await lock(ana)).status).toBe(400);
        });

        it("horários distintos podem ser reservados por clientes distintos", async () => {
            expect((await lock(ana, slot(10))).status).toBe(200);
            expect((await lock(bruno, slot(11))).status).toBe(200);
        });

        it("rejeita horário no passado (400)", async () => {
            const past = slot(10, 0, 30, -1);

            const res = await lock(ana, past);

            expect(res.status).toBe(400);
            expect(fakeCache.store.size).toBe(0);
        });

        it("rejeita empresa inexistente (404), tipo inexistente (404) e payload inválido (406)", async () => {
            const missingCompany = await api().post("/lock_schedule/64b7f0c2a1b2c3d4e5f60718").set(bearer(ana.token)).send({ ...slot(10), typeId: s.typeId });
            const missingType = await lock(ana, slot(10), "64b7f0c2a1b2c3d4e5f60718");
            const invalid = await api().post(`/lock_schedule/${s.companyId}`).set(bearer(ana.token)).send({ startsAt: "ontem", endsAt: "hoje", typeId: s.typeId });

            expect(missingCompany.status).toBe(404);
            expect(missingType.status).toBe(404);
            expect(invalid.status).toBe(406);
        });

        it("não permite usar um tipo de serviço de outra empresa (404)", async () => {
            const otherOwner = await createOwnerWithToken(s.adminToken, "outro");
            const otherCompany = await createCompany(s.adminToken, otherOwner.ownerId);
            const foreignType = await api().post(`/schedules/types/${otherCompany.id}`).set(bearer(otherOwner.token)).send({ name: "Corte", price: 10 });

            const res = await lock(ana, slot(10), foreignType.body.dados._id);

            expect(res.status).toBe(404);
        });
    });

    describe("DELETE /lock_schedule/:companyId (liberar reserva)", () => {
        it("o cliente libera a própria reserva e o horário volta a ficar disponível", async () => {
            const when = slot(10);
            await lock(ana, when);

            const res = await api().delete(`/lock_schedule/${s.companyId}`).set(bearer(ana.token)).send(when);

            expect(res.status).toBe(200);
            expect(fakeCache.store.size).toBe(0);
            expect((await lock(bruno, when)).status).toBe(200);
        });

        it("liberar um horário sem reserva é idempotente", async () => {
            const res = await api().delete(`/lock_schedule/${s.companyId}`).set(bearer(ana.token)).send(slot(10));

            expect(res.status).toBe(200);
        });

        // DEFEITO CONHECIDO (segurança): deleteLockSchedule remove a chave do cache sem conferir de quem é a reserva,
        // então qualquer cliente autenticado libera a reserva de outro. Remova o ".fails" após validar o dono da reserva.
        it.fails("um cliente não pode liberar a reserva de outro", async () => {
            const when = slot(10);
            await lock(ana, when);

            await api().delete(`/lock_schedule/${s.companyId}`).set(bearer(bruno.token)).send(when);

            expect((await lock(bruno, when)).status).toBe(400);
        });
    });

    describe("POST /schedules/:companyId (confirmação)", () => {
        it("confirma o agendamento reservado, persiste os dados do cliente e libera o cache", async () => {
            const when = slot(10);
            await lock(ana, when);
            dbEvents.length = 0;

            const res = await confirm(ana, when);

            expect(res.status).toBe(200);
            expect(res.body.dados).toMatchObject({
                companyId: s.companyId,
                typeId: s.typeId,
                employeeId: s.employeeId,
                state: ScheduleState.scheduled,
                client: { uid: "ana", name: "Cliente ana", email: "ana@teste.com", phoneNumber: PHONE },
            });
            expect(new Date(res.body.dados.startsAt).toISOString()).toBe(when.startsAt);

            expect(await ScheduleModel.countDocuments({ state: ScheduleState.scheduled })).toBe(1);
            expect(fakeCache.store.size).toBe(0);
            expect(dbEvents).toHaveLength(1);
        });

        it("outro cliente não confirma sobre a reserva de alguém (400)", async () => {
            const when = slot(10);
            await lock(ana, when);

            const res = await confirm(bruno, when);

            expect(res.status).toBe(400);
            expect(await ScheduleModel.countDocuments()).toBe(0);
        });

        it("não permite agendar um horário já agendado, nem com nova reserva (400)", async () => {
            const when = slot(10);
            await book(ana, when);

            expect((await lock(bruno, when)).status).toBe(400);
            expect((await confirm(bruno, when)).status).toBe(400);
            expect(await ScheduleModel.countDocuments()).toBe(1);
        });

        it("rejeita horário no passado (400)", async () => {
            const res = await confirm(ana, slot(10, 0, 30, -1));

            expect(res.status).toBe(400);
        });

        it("rejeita empresa inexistente (404)", async () => {
            const res = await api().post("/schedules/64b7f0c2a1b2c3d4e5f60718").set(bearer(ana.token))
                .send({ ...slot(10), typeId: s.typeId, employeeId: s.employeeId, phoneNumber: PHONE });

            expect(res.status).toBe(404);
        });

        it.each([
            ["telefone ausente", { phoneNumber: undefined }],
            ["funcionário ausente", { employeeId: undefined }],
            ["tipo inválido", { typeId: "abc" }],
            ["data de término inválida", { endsAt: "amanhã" }],
        ])("rejeita payload inválido: %s (406)", async (_, extra) => {
            await lock(ana);

            const res = await confirm(ana, slot(10), extra);

            expect(res.status).toBe(406);
            expect(await ScheduleModel.countDocuments()).toBe(0);
        });

        it("reservas expiradas: após o TTL o horário volta a ser reservável por outro cliente", async () => {
            const when = slot(10);
            await lock(ana, when);
            fakeCache.store.clear(); // equivale à expiração da chave no Redis

            expect((await lock(bruno, when)).status).toBe(200);
            expect((await confirm(bruno, when)).status).toBe(200);
        });

        // DEFEITO CONHECIDO: confirmSchedule não confere se employeeId pertence à empresa (nem se existe).
        // Remova o ".fails" quando o serviço passar a validar o funcionário.
        it.fails("não aceita funcionário inexistente/de outra empresa", async () => {
            const when = slot(10);
            await lock(ana, when);

            const res = await confirm(ana, when, { employeeId: "64b7f0c2a1b2c3d4e5f60718" });

            expect(res.status).toBeGreaterThanOrEqual(400);
        });
    });

    describe("GET /schedules/:companyId (grade de horários)", () => {
        const query = (c = ana, date = localDate(1)) =>
            api().get(`/schedules/${s.companyId}`).query({ startsAt: date, endsAt: date }).set(bearer(c.token));

        const starts = (body: any) => body.dados.map((e: any) => new Date(e.startsAt));

        it("monta a grade do dia respeitando abertura, fechamento e intervalo de almoço", async () => {
            const res = await query();

            expect(res.status).toBe(200);
            // 08:00–18:00 em blocos de 30 min = 20; o almoço (12:00–13:00) = 2 blocos fechados e omitidos
            expect(res.body.dados).toHaveLength(18);
            expect(res.body.dados.every((e: any) => e.state === ScheduleState.open)).toBe(true);

            const hours = starts(res.body).map((d: Date) => d.getHours() + d.getMinutes() / 60);
            expect(Math.min(...hours)).toBe(8);
            expect(Math.max(...hours)).toBe(17.5);
            expect(hours).not.toContain(12);
            expect(hours).not.toContain(12.5);
        });

        it("reflete o estado: reservado (lock) e agendado (scheduled)", async () => {
            await book(ana, slot(9));
            await lock(bruno, slot(10));

            const res = await query(client("carlos"));

            const stateAt = (h: number) => res.body.dados.find((e: any) => new Date(e.startsAt).getHours() === h && new Date(e.startsAt).getMinutes() === 0).state;
            expect(stateAt(9)).toBe(ScheduleState.scheduled);
            expect(stateAt(10)).toBe(ScheduleState.lock);
            expect(stateAt(11)).toBe(ScheduleState.open);
        });

        it("não vaza dados de outros clientes, mas mostra os do próprio cliente", async () => {
            await book(ana, slot(9));
            await lock(ana, slot(10));
            await lock(bruno, slot(11));

            const asAna = (await query(ana)).body.dados;
            const asBruno = (await query(bruno)).body.dados;
            const at = (list: any[], h: number) => list.find((e) => new Date(e.startsAt).getHours() === h && new Date(e.startsAt).getMinutes() === 0);

            expect(at(asAna, 9).client).toMatchObject({ uid: "ana", phoneNumber: PHONE });
            expect(at(asAna, 10).lockPeriodDetail.uid).toBe("ana");

            // Para Bruno, os horários da Ana aparecem ocupados, porém anônimos
            expect(at(asBruno, 9)).toMatchObject({ state: ScheduleState.scheduled });
            expect(at(asBruno, 9).client).toBeUndefined();
            expect(at(asBruno, 10).lockPeriodDetail.uid).toBeUndefined();
            expect(at(asBruno, 10).lockPeriodDetail.expiresAt).toBeDefined();
            expect(JSON.stringify(asBruno)).not.toContain(PHONE);
            expect(JSON.stringify(asBruno)).not.toContain("ana@teste.com");
        });

        it("respeita configurações da empresa (período de 60 min e horário 09–12)", async () => {
            await api().patch(`/company/${s.companyId}`).set(bearer(s.owner.token)).send({
                configuration: { defaultPeriodInMinutes: 60, openingHours: "09:00", closingTime: "12:00", lunchBreak: { start: "23:00", end: "23:30" } },
            });

            const res = await query();

            expect(starts(res.body).map((d: Date) => d.getHours())).toEqual([9, 10, 11]);
        });

        it("rejeita data passada para clientes (400) e filtro mal formatado (406)", async () => {
            expect((await query(ana, localDate(-2))).status).toBe(400);
            expect((await api().get(`/schedules/${s.companyId}`).query({ startsAt: "10/10/2030" }).set(bearer(ana.token))).status).toBe(406);
        });

        it("exige token de cliente (401), token expirado (401) e token revogado (403)", async () => {
            expect((await api().get(`/schedules/${s.companyId}`)).status).toBe(401);
            expect((await api().get(`/schedules/${s.companyId}`).set(bearer(clientToken({ uid: "x" }, "expired")))).status).toBe(401);
            expect((await api().get(`/schedules/${s.companyId}`).set(bearer(clientToken({ uid: "x" }, "revoked")))).status).toBe(403);
        });

        it("retorna 404 para empresa inexistente", async () => {
            const res = await api().get("/schedules/64b7f0c2a1b2c3d4e5f60718").set(bearer(ana.token));

            expect(res.status).toBe(404);
        });
    });

    describe("GET /company/:companyId/schedules (visão do estabelecimento)", () => {
        it("o dono vê os dados completos dos clientes", async () => {
            await book(ana, slot(9));
            const date = localDate(1);

            const res = await api().get(`/company/${s.companyId}/schedules`).query({ startsAt: date, endsAt: date }).set(bearer(s.owner.token));

            expect(res.status).toBe(200);
            const booked = res.body.dados.find((e: any) => e.state === ScheduleState.scheduled);
            expect(booked.client).toMatchObject({ uid: "ana", phoneNumber: PHONE, email: "ana@teste.com" });
        });

        it("permite consultar o histórico (datas passadas)", async () => {
            const res = await api().get(`/company/${s.companyId}/schedules`).query({ startsAt: localDate(-3), endsAt: localDate(-3) }).set(bearer(s.owner.token));

            expect(res.status).toBe(200);
            expect(res.body.dados.length).toBeGreaterThan(0);
        });

        it("outro owner não consulta (403) e cliente não acessa (401)", async () => {
            const intruder = await createOwnerWithToken(s.adminToken, "intruso");

            expect((await api().get(`/company/${s.companyId}/schedules`).set(bearer(intruder.token))).status).toBe(403);
            expect((await api().get(`/company/${s.companyId}/schedules`).set(bearer(ana.token))).status).toBe(401);
        });
    });

    describe("GET /schedules/:companyId/:id", () => {
        it("o cliente consulta o próprio agendamento, com tipo e empresa", async () => {
            const { id } = await book(ana);

            const res = await api().get(`/schedules/${s.companyId}/${id}`).set(bearer(ana.token));

            expect(res.status).toBe(200);
            expect(res.body.dados).toMatchObject({ _id: id, typeDetail: { name: "Corte" }, companyDetail: { _id: s.companyId } });
        });

        it("outro cliente não consulta (403)", async () => {
            const { id } = await book(ana);

            expect((await api().get(`/schedules/${s.companyId}/${id}`).set(bearer(bruno.token))).status).toBe(403);
        });

        it("retorna 404 para agendamento inexistente, 404 com id de outra empresa e 406 para id inválido", async () => {
            const { id } = await book(ana);
            const otherOwner = await createOwnerWithToken(s.adminToken, "outro");
            const otherCompany = await createCompany(s.adminToken, otherOwner.ownerId);

            expect((await api().get(`/schedules/${s.companyId}/64b7f0c2a1b2c3d4e5f60718`).set(bearer(ana.token))).status).toBe(404);
            expect((await api().get(`/schedules/${otherCompany.id}/${id}`).set(bearer(ana.token))).status).toBe(404);
            expect((await api().get(`/schedules/${s.companyId}/abc`).set(bearer(ana.token))).status).toBe(406);
        });
    });

    describe("DELETE /schedules/:companyId/:id (cancelamento pelo cliente)", () => {
        it("cancela, registra a origem, libera o horário e notifica em tempo real", async () => {
            const { id, when } = await book(ana);
            dbEvents.length = 0;

            const res = await api().delete(`/schedules/${s.companyId}/${id}`).set(bearer(ana.token));

            expect(res.status).toBe(200);
            expect(res.body.dados.cancellation).toMatchObject({ canceledBy: CancellationOrigin.client });

            const stored = await ScheduleModel.findById(id);
            expect(stored?.deleted).toBe(true);
            expect(stored?.cancellation?.canceledBy).toBe(CancellationOrigin.client);
            expect(dbEvents).toHaveLength(1);

            // O horário volta a ser reservável e agendável por qualquer cliente
            expect((await book(bruno, when)).res.status).toBe(200);
        });

        it("o agendamento cancelado deixa de ser localizado (404) e não pode ser cancelado de novo", async () => {
            const { id } = await book(ana);
            await api().delete(`/schedules/${s.companyId}/${id}`).set(bearer(ana.token));

            expect((await api().get(`/schedules/${s.companyId}/${id}`).set(bearer(ana.token))).status).toBe(404);
            expect((await api().delete(`/schedules/${s.companyId}/${id}`).set(bearer(ana.token))).status).toBe(404);
        });

        it("outro cliente não cancela (403) e o agendamento permanece", async () => {
            const { id } = await book(ana);

            const res = await api().delete(`/schedules/${s.companyId}/${id}`).set(bearer(bruno.token));

            expect(res.status).toBe(403);
            expect((await ScheduleModel.findById(id))?.deleted).not.toBe(true);
        });

        it("não cancela agendamento que já passou (400)", async () => {
            const past = slot(10, 0, 30, -1);
            const created = await ScheduleModel.create({
                companyId: s.companyId, startsAt: past.startsAt, endsAt: past.endsAt, typeId: s.typeId, employeeId: s.employeeId,
                state: ScheduleState.scheduled, client: { uid: "ana", name: "Ana", phoneNumber: PHONE },
            });

            const res = await api().delete(`/schedules/${s.companyId}/${created.id}`).set(bearer(ana.token));

            expect(res.status).toBe(400);
            expect((await ScheduleModel.findById(created.id))?.deleted).not.toBe(true);
        });

        it("o cache do agendamento é invalidado após cancelar", async () => {
            const { id } = await book(ana);
            await api().get(`/schedules/${s.companyId}/${id}`).set(bearer(ana.token)); // popula o cache por id
            expect(fakeCache.store.has(`${s.companyId}:${id}`)).toBe(true);

            await api().delete(`/schedules/${s.companyId}/${id}`).set(bearer(ana.token));

            expect(fakeCache.store.has(`${s.companyId}:${id}`)).toBe(false);
        });
    });

    describe("DELETE /company/:companyId/schedules/:id (cancelamento pelo estabelecimento)", () => {
        const cancelAsCompany = (id: string, token = s.owner.token, body: object = { reason: "Profissional doente" }) =>
            api().delete(`/company/${s.companyId}/schedules/${id}`).set(bearer(token)).send(body);

        it("o dono cancela informando o motivo; o horário é liberado e o evento enviado", async () => {
            const { id, when } = await book(ana);
            dbEvents.length = 0;

            const res = await cancelAsCompany(id);

            expect(res.status).toBe(200);
            expect(res.body.dados.cancellation).toMatchObject({ canceledBy: CancellationOrigin.company, reason: "Profissional doente" });
            expect((await ScheduleModel.findById(id))?.cancellation?.canceledBy).toBe(CancellationOrigin.company);
            expect(dbEvents).toHaveLength(1);
            expect((await book(bruno, when)).res.status).toBe(200);
        });

        it("admin também cancela", async () => {
            const { id } = await book(ana);

            expect((await cancelAsCompany(id, s.adminToken)).status).toBe(200);
        });

        it.each([
            ["motivo ausente", {}],
            ["motivo em branco", { reason: "   " }],
            ["motivo acima de 500 caracteres", { reason: "x".repeat(501) }],
        ])("exige um motivo válido: %s (406)", async (_, body) => {
            const { id } = await book(ana);

            const res = await cancelAsCompany(id, s.owner.token, body);

            expect(res.status).toBe(406);
            expect((await ScheduleModel.findById(id))?.deleted).not.toBe(true);
        });

        it("outro owner não cancela (403) e cliente não acessa a rota (401)", async () => {
            const { id } = await book(ana);
            const intruder = await createOwnerWithToken(s.adminToken, "intruso");

            expect((await cancelAsCompany(id, intruder.token)).status).toBe(403);
            expect((await cancelAsCompany(id, ana.token)).status).toBe(401);
            expect((await ScheduleModel.findById(id))?.deleted).not.toBe(true);
        });

        it("não cancela agendamento de outra empresa (404)", async () => {
            const { id } = await book(ana);
            const otherOwner = await createOwnerWithToken(s.adminToken, "outro");
            const otherCompany = await createCompany(s.adminToken, otherOwner.ownerId);

            const res = await api().delete(`/company/${otherCompany.id}/schedules/${id}`).set(bearer(otherOwner.token)).send({ reason: "teste" });

            expect(res.status).toBe(404);
            expect((await ScheduleModel.findById(id))?.deleted).not.toBe(true);
        });
    });
});
