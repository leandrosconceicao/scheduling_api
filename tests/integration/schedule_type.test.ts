import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ScheduleTypeModel } from "@domain";
import {
    api, bearer, client, createCompany, createOwnerWithToken, createScheduleType, initDatabase, resetState, seedAdmin, slot,
} from "../support/helpers";

describe("Tipos de serviço", () => {
    let adminToken: string;
    let owner: Awaited<ReturnType<typeof createOwnerWithToken>>;
    let companyId: string;

    beforeAll(initDatabase);
    beforeEach(async () => {
        await resetState();
        adminToken = await seedAdmin();
        owner = await createOwnerWithToken(adminToken, "dono");
        companyId = (await createCompany(adminToken, owner.ownerId)).id;
    });

    describe("POST /schedules/types/:companyId", () => {
        it("dono cadastra o tipo com preço decimal", async () => {
            const { res } = await createScheduleType(owner.token, companyId, "Barba", 35.5);

            expect(res.status).toBe(200);
            expect(res.body.dados).toMatchObject({ name: "Barba", companyId, priceAsNumber: 35.5 });
            expect(res.body.dados.price.$numberDecimal).toBe("35.50");
        });

        it("não permite nome duplicado na mesma empresa (409)", async () => {
            await createScheduleType(owner.token, companyId, "Corte");

            expect((await createScheduleType(owner.token, companyId, "Corte")).res.status).toBe(409);
        });

        it("outro owner não cadastra tipo na empresa alheia (403)", async () => {
            const intruder = await createOwnerWithToken(adminToken, "intruso");

            expect((await createScheduleType(intruder.token, companyId)).res.status).toBe(403);
            expect(await ScheduleTypeModel.countDocuments()).toBe(0);
        });

        it("rejeita preço não numérico e nome ausente (406)", async () => {
            const badPrice = await api().post(`/schedules/types/${companyId}`).set(bearer(owner.token)).send({ name: "x", price: "10" });
            const noName = await api().post(`/schedules/types/${companyId}`).set(bearer(owner.token)).send({ price: 10 });

            expect(badPrice.status).toBe(406);
            expect(noName.status).toBe(406);
        });

        it("cliente (Firebase) não cadastra tipo (401)", async () => {
            const res = await api().post(`/schedules/types/${companyId}`).set(bearer(client().token)).send({ name: "x", price: 1 });

            expect(res.status).toBe(401);
        });
    });

    describe("listagens", () => {
        it("cliente e dono listam os tipos da empresa", async () => {
            await createScheduleType(owner.token, companyId, "Corte");
            await createScheduleType(owner.token, companyId, "Barba");

            const asClient = await api().get(`/schedules/types/${companyId}`).set(bearer(client().token));
            const asOwner = await api().get(`/company/${companyId}/schedule_types`).set(bearer(owner.token));

            expect(asClient.body.dados).toHaveLength(2);
            expect(asOwner.body.dados).toHaveLength(2);
        });

        it("não lista tipos de outra empresa", async () => {
            const other = (await createCompany(adminToken, owner.ownerId)).id;
            await createScheduleType(owner.token, other, "Outro");

            const res = await api().get(`/schedules/types/${companyId}`).set(bearer(client().token));

            expect(res.body.dados).toHaveLength(0);
        });

        it("a listagem administrativa é restrita ao dono da empresa (403)", async () => {
            const intruder = await createOwnerWithToken(adminToken, "intruso");

            const res = await api().get(`/company/${companyId}/schedule_types`).set(bearer(intruder.token));

            expect(res.status).toBe(403);
        });
    });

    describe("PATCH /schedules/types/:companyId/:id", () => {
        it("dono altera nome e preço", async () => {
            const { id } = await createScheduleType(owner.token, companyId, "Corte", 40);

            const res = await api().patch(`/schedules/types/${companyId}/${id}`).set(bearer(owner.token))
                .send({ name: "Corte Premium", price: 65.9 });

            expect(res.status).toBe(200);
            expect(res.body.dados).toMatchObject({ name: "Corte Premium", priceAsNumber: 65.9 });
        });

        it("outro owner não altera (403)", async () => {
            const { id } = await createScheduleType(owner.token, companyId);
            const intruder = await createOwnerWithToken(adminToken, "intruso");

            const res = await api().patch(`/schedules/types/${companyId}/${id}`).set(bearer(intruder.token)).send({ name: "Hack" });

            expect(res.status).toBe(403);
            expect((await ScheduleTypeModel.findById(id))?.name).toBe("Corte");
        });

        it("não altera tipo usando o id de outra empresa (404)", async () => {
            const { id } = await createScheduleType(owner.token, companyId);
            const other = (await createCompany(adminToken, owner.ownerId)).id;

            const res = await api().patch(`/schedules/types/${other}/${id}`).set(bearer(owner.token)).send({ name: "Cruzado" });

            expect(res.status).toBe(404);
        });

        it("rejeita nome vazio (406)", async () => {
            const { id } = await createScheduleType(owner.token, companyId);

            const res = await api().patch(`/schedules/types/${companyId}/${id}`).set(bearer(owner.token)).send({ name: "" });

            expect(res.status).toBe(406);
        });
    });

    describe("DELETE /schedules/types/:companyId/:id", () => {
        it("dono remove (soft delete); o tipo some das listagens e o nome pode ser reutilizado", async () => {
            const { id } = await createScheduleType(owner.token, companyId, "Corte");

            expect((await api().delete(`/schedules/types/${companyId}/${id}`).set(bearer(owner.token))).status).toBe(204);

            const list = await api().get(`/schedules/types/${companyId}`).set(bearer(client().token));
            expect(list.body.dados).toHaveLength(0);
            expect((await createScheduleType(owner.token, companyId, "Corte")).res.status).toBe(200);
        });

        it("outro owner não remove (403) e id de outra empresa retorna 404", async () => {
            const { id } = await createScheduleType(owner.token, companyId);
            const intruder = await createOwnerWithToken(adminToken, "intruso");
            const other = (await createCompany(adminToken, owner.ownerId)).id;

            expect((await api().delete(`/schedules/types/${companyId}/${id}`).set(bearer(intruder.token))).status).toBe(403);
            expect((await api().delete(`/schedules/types/${other}/${id}`).set(bearer(owner.token))).status).toBe(404);
            expect((await ScheduleTypeModel.findById(id))?.deleted).toBeUndefined();
        });

        // DEFEITO CONHECIDO: getScheduleTypeById não filtra "deleted", então um tipo removido ainda pode ser reservado.
        // Remova o ".fails" quando o repositório passar a ignorar tipos excluídos.
        it.fails("um tipo removido não pode mais ser usado para reservar horário", async () => {
            const { id } = await createScheduleType(owner.token, companyId, "Corte");
            await api().delete(`/schedules/types/${companyId}/${id}`).set(bearer(owner.token));

            const res = await api().post(`/lock_schedule/${companyId}`).set(bearer(client().token))
                .send({ ...slot(10), typeId: id });

            expect(res.status).toBe(404);
        });
    });
});
