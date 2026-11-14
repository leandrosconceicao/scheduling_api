import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ScheduleModel, ScheduleState } from "@domain";
import { api, bearer, client, createCompany, createEmployee, createOwnerWithToken, initDatabase, resetState, setupCompanyScenario } from "../support/helpers";

type Scenario = Awaited<ReturnType<typeof setupCompanyScenario>>;

describe("Agendamentos do estabelecimento", () => {
    let s: Scenario;
    const ana = client("ana");

    beforeAll(initDatabase);
    beforeEach(async () => {
        await resetState();
        s = await setupCompanyScenario();
    });

    /** Grava direto no banco (permite datas passadas). */
    const seed = (name: string, hoursFromNow: number, extra: Record<string, unknown> = {}) => {
        const startsAt = new Date(Date.now() + hoursFromNow * 3_600_000);
        return ScheduleModel.create({
            companyId: s.companyId, typeId: s.typeId, employeeId: s.employeeId, state: ScheduleState.scheduled,
            startsAt, endsAt: new Date(startsAt.getTime() + 30 * 60_000),
            client: { uid: name, name, phoneNumber: "+5581999999999" },
            ...extra,
        });
    };

    const list = (query: Record<string, unknown> = {}, token = s.owner.token, companyId = s.companyId) =>
        api().get(`/company/${companyId}/appointments`).query(query).set(bearer(token));

    const ids = (res: any) => res.body.dados.map((e: any) => String(e._id));

    describe("GET /company/:companyId/appointments", () => {
        it("lista por ordem de início, com serviço e funcionário, sem cancelados por padrão", async () => {
            const later = await seed("Bia", 48);
            const sooner = await seed("Caio", 24);
            await seed("Dani", 30, { deleted: true });

            const res = await list();

            expect(res.status).toBe(200);
            expect(ids(res)).toEqual([sooner.id, later.id]);
            expect(res.body.dados[0]).toMatchObject({
                state: ScheduleState.scheduled,
                typeDetail: { name: "Corte", priceAsNumber: 50 },
                employeeDetail: { _id: s.employeeId, name: "João" },
            });
        });

        it("filtra por intervalo, funcionário, serviço e ordena de forma decrescente", async () => {
            const other = await createEmployee(s.owner.token, s.companyId, "Pedro");
            const a = await seed("Ana", 24);
            const b = await seed("Bia", 48, { employeeId: other.id });
            const c = await seed("Caio", 72);

            const from = new Date(Date.now() + 36 * 3_600_000).toISOString();

            expect(ids(await list({ from }))).toEqual([b.id, c.id]);
            expect(ids(await list({ from, to: new Date(Date.now() + 60 * 3_600_000).toISOString() }))).toEqual([b.id]);
            expect(ids(await list({ employeeId: other.id }))).toEqual([b.id]);
            expect(ids(await list({ typeId: s.typeId, order: "desc" }))).toEqual([c.id, b.id, a.id]);
        });

        it("filtra por estado; cancelados vêm como canceled, inclusive os anteriores ao estado existir", async () => {
            const open = await seed("Ana", 24);
            const done = await seed("Bia", -5, { state: ScheduleState.completed });
            const legacy = await seed("Caio", 30, { deleted: true, cancellation: { canceledBy: "client", canceledAt: new Date() } });

            expect(ids(await list({ state: "completed" }))).toEqual([done.id]);
            expect(ids(await list())).toEqual([done.id, open.id]);

            const res = await list({ state: "canceled" });

            expect(ids(res)).toEqual([legacy.id]);
            expect(res.body.dados[0]).toMatchObject({ state: ScheduleState.canceled, stateDescription: "Cancelado" });
            expect(ids(await list({ state: "scheduled,canceled" }))).toEqual([open.id, legacy.id]);
        });

        it("busca por nome ou telefone do cliente, tratando caracteres especiais", async () => {
            const maria = await seed("Maria Souza", 24, { client: { uid: "m", name: "Maria Souza", phoneNumber: "+5511988887777" } });
            await seed("João", 25);

            expect(ids(await list({ search: "maria" }))).toEqual([maria.id]);
            expect(ids(await list({ search: "88887777" }))).toEqual([maria.id]);
            expect((await list({ search: ".*" })).body.dados).toEqual([]);
        });

        it("pagina os resultados", async () => {
            const created = [];
            for (let h = 1; h <= 5; h++) created.push((await seed(`C${h}`, h * 24)).id);

            expect(ids(await list({ limit: 2 }))).toEqual(created.slice(0, 2));
            expect(ids(await list({ limit: 2, page: 3 }))).toEqual(created.slice(4));
        });

        it("rejeita filtros inválidos", async () => {
            expect((await list({ state: "open" })).status).toBe(406);
            expect((await list({ from: "ontem" })).status).toBe(406);
            expect((await list({ employeeId: "abc" })).status).toBe(406);
            expect((await list({ limit: 500 })).status).toBe(406);
            expect((await list({ from: "2030-01-02T00:00:00Z", to: "2030-01-01T00:00:00Z" })).status).toBe(406);
        });

        it("não mostra agendamentos de outra empresa, nega outro owner (403) e cliente (401)", async () => {
            await seed("Ana", 24);
            const intruder = await createOwnerWithToken(s.adminToken, "intruso");
            const otherCompany = await createCompany(s.adminToken, intruder.ownerId);

            expect((await list({}, intruder.token, otherCompany.id)).body.dados).toEqual([]);
            expect((await list({}, intruder.token)).status).toBe(403);
            expect((await list({}, ana.token)).status).toBe(401);
            expect((await list({}, s.adminToken)).status).toBe(200);
        });
    });

    describe("GET /company/:companyId/appointments/:id", () => {
        const detail = (id: string, token = s.owner.token) =>
            api().get(`/company/${s.companyId}/appointments/${id}`).set(bearer(token));

        it("traz o detalhe, inclusive de cancelado", async () => {
            const item = await seed("Ana", 24);
            const canceled = await seed("Bia", 30, { deleted: true });

            const res = await detail(item.id);

            expect(res.status).toBe(200);
            expect(res.body.dados).toMatchObject({ _id: item.id, client: { name: "Ana" }, typeDetail: { name: "Corte" } });
            expect((await detail(canceled.id)).body.dados.state).toBe(ScheduleState.canceled);
        });

        it("404 para inexistente, 406 para id inválido e 403 para outro owner", async () => {
            const item = await seed("Ana", 24);
            const intruder = await createOwnerWithToken(s.adminToken, "intruso");

            expect((await detail("64b7f0c2a1b2c3d4e5f60718")).status).toBe(404);
            expect((await detail("abc")).status).toBe(406);
            expect((await detail(item.id, intruder.token)).status).toBe(403);
        });
    });

    describe("PATCH /company/:companyId/appointments/:id (concluir)", () => {
        const complete = (id: string, token = s.owner.token, body: object = { state: "completed" }) =>
            api().patch(`/company/${s.companyId}/appointments/${id}`).set(bearer(token)).send(body);

        it("conclui um agendamento que já começou", async () => {
            const item = await seed("Ana", -1);

            const res = await complete(item.id);

            expect(res.status).toBe(200);
            expect(res.body.dados).toMatchObject({ state: ScheduleState.completed, stateDescription: "Concluído" });
            expect((await ScheduleModel.findById(item.id))?.state).toBe(ScheduleState.completed);
        });

        it("não conclui antes do início, nem duas vezes, nem cancelado (400)", async () => {
            const future = await seed("Ana", 24);
            const done = await seed("Bia", -2, { state: ScheduleState.completed });
            const canceled = await seed("Caio", -3, { deleted: true });

            expect((await complete(future.id)).status).toBe(400);
            expect((await complete(done.id)).status).toBe(400);
            expect((await complete(canceled.id)).status).toBe(400);
        });

        it("só aceita completed, e nega outro owner (403) e cliente (401)", async () => {
            const item = await seed("Ana", -1);
            const intruder = await createOwnerWithToken(s.adminToken, "intruso");

            expect((await complete(item.id, s.owner.token, { state: "canceled" })).status).toBe(406);
            expect((await complete(item.id, s.owner.token, {})).status).toBe(406);
            expect((await complete(item.id, intruder.token)).status).toBe(403);
            expect((await complete(item.id, ana.token)).status).toBe(401);
        });
    });

    it("cancelar pela API grava o estado canceled e o agendamento aparece na listagem de cancelados", async () => {
        const item = await seed("Ana", 24);

        await api().delete(`/company/${s.companyId}/schedules/${item.id}`).set(bearer(s.owner.token)).send({ reason: "Imprevisto" });

        expect((await ScheduleModel.findById(item.id))?.state).toBe(ScheduleState.canceled);
        expect(ids(await list({ state: "canceled" }))).toEqual([item.id]);
        expect((await list()).body.dados).toEqual([]);
    });
});
