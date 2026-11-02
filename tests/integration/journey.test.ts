import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { clientToken, dbEvents } from "../support/fakes";
import { api, bearer, initDatabase, localDate, resetState, seedAdmin, slot } from "../support/helpers";
import { OwnerModel } from "@domain";

describe("Jornada completa (ponta a ponta)", () => {
    beforeAll(initDatabase);
    beforeEach(resetState);

    it("do onboarding do estabelecimento ao cancelamento pelo cliente", async () => {
        // 1. Onboarding: admin cria o dono e a empresa; dono configura tipos e equipe
        const adminToken = await seedAdmin();
        await api().post("/owner").set(bearer(adminToken)).send({ username: "salao", password: "s3nha", name: "Dona do Salão" }).expect(200);
        const ownerLogin = await api().post("/owner/auth").send({ username: "salao", password: "s3nha" }).expect(200);
        const ownerId = (await OwnerModel.findOne({ username: "salao" }))!.id;

        const company = await api().post("/company").set(bearer(adminToken)).send({
            cnpj: "12345678000195", name: "Salão Bela", subdomain: "bela", ownerId,
            configuration: { defaultPeriodInMinutes: 30 },
        }).expect(200);
        const companyId = company.body.dados._id;

        // O token do dono emitido antes da empresa existir continua válido (a posse é checada no banco)
        const ownerToken = ownerLogin.body.dados.token;
        const type = await api().post(`/schedules/types/${companyId}`).set(bearer(ownerToken)).send({ name: "Escova", price: 80 }).expect(200);
        const employee = await api().post(`/company/employees/${companyId}`).set(bearer(ownerToken))
            .send({ name: "Júlia", profilePhotoUrl: "https://img.test/julia.png" }).expect(200);

        // 2. Cliente abre o app do estabelecimento a partir do subdomínio
        const clientAuth = bearer(clientToken({ uid: "cli-1", name: "Cliente Um", email: "cli1@teste.com" }));
        const found = await api().get("/company/search_domain").query({ subdomain: "bela" }).expect(200);
        expect(found.body.dados._id).toBe(companyId);

        const details = await api().get(`/company/${companyId}`).set(clientAuth).expect(200);
        expect(details.body.dados.scheduleTypes.map((t: any) => t.name)).toEqual(["Escova"]);
        const employees = await api().get(`/company/employees/${companyId}`).set(clientAuth).expect(200);
        expect(employees.body.dados.map((e: any) => e.name)).toEqual(["Júlia"]);

        // 3. Cliente consulta a grade, escolhe um horário livre e o reserva
        const date = localDate(2);
        const grid = await api().get(`/schedules/${companyId}`).query({ startsAt: date, endsAt: date }).set(clientAuth).expect(200);
        const free = grid.body.dados.find((e: any) => e.state === "open" && new Date(e.startsAt).getHours() === 14);
        const when = { startsAt: free.startsAt, endsAt: free.endsAt };

        await api().post(`/lock_schedule/${companyId}`).set(clientAuth).send({ ...when, typeId: type.body.dados._id }).expect(200);

        // 4. Enquanto reservado, outro cliente não consegue o mesmo horário
        const rival = bearer(clientToken({ uid: "cli-2", name: "Cliente Dois" }));
        await api().post(`/lock_schedule/${companyId}`).set(rival).send({ ...when, typeId: type.body.dados._id }).expect(400);

        // 5. Confirmação
        const confirmed = await api().post(`/schedules/${companyId}`).set(clientAuth).send({
            ...when, typeId: type.body.dados._id, employeeId: employee.body.dados._id, phoneNumber: "+5581988887777",
        }).expect(200);
        const scheduleId = confirmed.body.dados._id;
        expect(confirmed.body.dados.state).toBe("scheduled");

        // 6. A grade passa a mostrar o horário ocupado; o rival não vê os dados do cliente
        const gridAfter = await api().get(`/schedules/${companyId}`).query({ startsAt: date, endsAt: date }).set(rival).expect(200);
        const taken = gridAfter.body.dados.find((e: any) => e.startsAt === free.startsAt);
        expect(taken.state).toBe("scheduled");
        expect(taken.client).toBeUndefined();
        await api().post(`/lock_schedule/${companyId}`).set(rival).send({ ...when, typeId: type.body.dados._id }).expect(400);

        // 7. O dono enxerga o agendamento com os dados do cliente
        const ownerView = await api().get(`/company/${companyId}/schedules`).query({ startsAt: date, endsAt: date }).set(bearer(ownerToken)).expect(200);
        expect(ownerView.body.dados.find((e: any) => e._id === scheduleId).client.phoneNumber).toBe("+5581988887777");

        // 8. O cliente cancela e o horário volta para a grade; o rival consegue agendar
        const eventsBefore = dbEvents.length;
        await api().delete(`/schedules/${companyId}/${scheduleId}`).set(clientAuth).expect(200);
        expect(dbEvents.length).toBe(eventsBefore + 1);

        await api().post(`/lock_schedule/${companyId}`).set(rival).send({ ...when, typeId: type.body.dados._id }).expect(200);
        await api().post(`/schedules/${companyId}`).set(rival).send({
            ...when, typeId: type.body.dados._id, employeeId: employee.body.dados._id, phoneNumber: "+5581977776666",
        }).expect(200);

        // 9. O dono cancela o novo agendamento informando o motivo
        const rivalSchedule = (await api().get(`/company/${companyId}/schedules`).query({ startsAt: date, endsAt: date }).set(bearer(ownerToken)))
            .body.dados.find((e: any) => e.state === "scheduled");
        const byCompany = await api().delete(`/company/${companyId}/schedules/${rivalSchedule._id}`).set(bearer(ownerToken))
            .send({ reason: "Imprevisto no salão" }).expect(200);
        expect(byCompany.body.dados.cancellation).toMatchObject({ canceledBy: "company", reason: "Imprevisto no salão" });
    });
});

describe("Comportamentos transversais", () => {
    beforeAll(initDatabase);
    beforeEach(resetState);

    it("GET /health responde sem autenticação", async () => {
        const res = await api().get("/health");

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ message: "API Online" });
    });

    it("rota inexistente retorna 404 no formato padrão da API", async () => {
        const res = await api().get("/nao-existe");

        expect(res.status).toBe(404);
        expect(res.body).toMatchObject({ statusCode: 404, statusProcess: false, message: "Recurso não localizado" });
    });

    it("recusa operadores NoSQL no login (injeção) sem vazar detalhes internos", async () => {
        await seedAdmin();

        const res = await api().post("/owner/auth").send({ username: { $ne: null }, password: { $ne: null } });

        expect(res.status).toBe(406);
        expect(JSON.stringify(res.body)).not.toMatch(/stack|mongo/i);
    });
});
