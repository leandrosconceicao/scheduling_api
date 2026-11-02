import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CompanyModel } from "@domain";
import { uploadedFiles } from "../support/fakes";
import {
    api, bearer, client, companyPayload, createCompany, createOwnerWithToken, initDatabase, resetState, seedAdmin,
} from "../support/helpers";

describe("Empresas", () => {
    let adminToken: string;
    let owner: Awaited<ReturnType<typeof createOwnerWithToken>>;

    beforeAll(initDatabase);
    beforeEach(async () => {
        await resetState();
        adminToken = await seedAdmin();
        owner = await createOwnerWithToken(adminToken, "dono");
    });

    describe("POST /company", () => {
        it("admin cadastra empresa e os defaults de horário são aplicados", async () => {
            const { res } = await createCompany(adminToken, owner.ownerId);

            expect(res.status).toBe(200);
            expect(res.body.dados).toMatchObject({
                name: "Barbearia Teste",
                ownerId: owner.ownerId,
                configuration: {
                    defaultPeriodInMinutes: 30,
                    openingHours: "08:00",
                    closingTime: "18:00",
                    lunchBreak: { start: "12:00", end: "13:00" },
                    lockSchedulePeriodInMinutes: 10,
                },
            });
        });

        it("a empresa passa a constar nas empresas do owner no login", async () => {
            const { id } = await createCompany(adminToken, owner.ownerId);

            const login = await api().post("/owner/auth").send({ username: "dono", password: "senha-dono" });

            expect(login.body.dados.companies).toEqual([expect.objectContaining({ _id: id })]);
        });

        it("somente admin pode cadastrar (owner → 403, anônimo → 401)", async () => {
            const body = companyPayload(owner.ownerId);

            expect((await api().post("/company").set(bearer(owner.token)).send(body)).status).toBe(403);
            expect((await api().post("/company").send(body)).status).toBe(401);
            expect(await CompanyModel.countDocuments()).toBe(0);
        });

        it.each([
            ["CNPJ com tamanho errado", { cnpj: "123" }],
            ["nome ausente", { name: undefined }],
            ["ownerId inválido", { ownerId: "abc" }],
            ["horário de abertura inválido", { configuration: { defaultPeriodInMinutes: 30, openingHours: "25:00" } }],
            ["configuração ausente", { configuration: undefined }],
        ])("rejeita payload inválido: %s (406)", async (_, overrides) => {
            const res = await api().post("/company").set(bearer(adminToken)).send(companyPayload(owner.ownerId, overrides));

            expect(res.status).toBe(406);
            expect(await CompanyModel.countDocuments()).toBe(0);
        });

        it("rejeita CNPJ duplicado com 409", async () => {
            const cnpj = "12345678000199";
            await createCompany(adminToken, owner.ownerId, { cnpj });

            const { res } = await createCompany(adminToken, owner.ownerId, { cnpj });

            expect(res.status).toBe(409);
        });
    });

    describe("GET /company/:id", () => {
        it("cliente autenticado consulta a empresa e recebe os tipos de serviço", async () => {
            const { id } = await createCompany(adminToken, owner.ownerId);
            await api().post(`/schedules/types/${id}`).set(bearer(owner.token)).send({ name: "Corte", price: 40 });

            const res = await api().get(`/company/${id}`).set(bearer(client().token));

            expect(res.status).toBe(200);
            expect(res.body.dados._id).toBe(id);
            expect(res.body.dados.scheduleTypes).toHaveLength(1);
            expect(res.body.dados.scheduleTypes[0].name).toBe("Corte");
        });

        it("exige token de cliente", async () => {
            const { id } = await createCompany(adminToken, owner.ownerId);

            expect((await api().get(`/company/${id}`)).status).toBe(401);
        });

        it("retorna 404 para empresa inexistente e 406 para id inválido", async () => {
            const token = client().token;

            expect((await api().get("/company/64b7f0c2a1b2c3d4e5f60718").set(bearer(token))).status).toBe(404);
            expect((await api().get("/company/abc").set(bearer(token))).status).toBe(406);
        });
    });

    describe("GET /company/search_domain", () => {
        it("localiza a empresa pelo subdomínio, sem autenticação, expondo apenas o id", async () => {
            const { id } = await createCompany(adminToken, owner.ownerId, { subdomain: "minha-loja" });

            const res = await api().get("/company/search_domain").query({ subdomain: "minha-loja" });

            expect(res.status).toBe(200);
            expect(res.body.dados).toEqual({ _id: id });
        });

        it("retorna 404 para subdomínio desconhecido e 406 sem o parâmetro", async () => {
            expect((await api().get("/company/search_domain").query({ subdomain: "nao-existe" })).status).toBe(404);
            expect((await api().get("/company/search_domain")).status).toBe(406);
        });
    });

    describe("PATCH /company/:id", () => {
        it("dono atualiza nome, endereço e horários", async () => {
            const { id } = await createCompany(adminToken, owner.ownerId);

            const res = await api().patch(`/company/${id}`).set(bearer(owner.token)).send({
                name: "Novo Nome",
                address: { city: "Recife", state: "PE" },
                configuration: {
                    defaultPeriodInMinutes: 45,
                    openingHours: "09:00",
                    closingTime: "17:00",
                    lunchBreak: { start: "11:30", end: "12:30" },
                },
            });

            expect(res.status).toBe(200);
            expect(res.body.dados.name).toBe("Novo Nome");
            expect(res.body.dados.address).toMatchObject({ city: "Recife", state: "PE" });
            expect(res.body.dados.configuration).toMatchObject({
                defaultPeriodInMinutes: 45,
                openingHours: "09:00",
                closingTime: "17:00",
                lunchBreak: { start: "11:30", end: "12:30" },
            });
        });

        it("atualização parcial preserva os demais campos", async () => {
            const { id } = await createCompany(adminToken, owner.ownerId);

            const res = await api().patch(`/company/${id}`).set(bearer(owner.token)).send({ name: "Só o nome" });

            expect(res.body.dados.name).toBe("Só o nome");
            expect(res.body.dados.configuration.openingHours).toBe("08:00");
        });

        it("outro owner não altera a empresa (403) e nada é gravado", async () => {
            const { id } = await createCompany(adminToken, owner.ownerId);
            const intruder = await createOwnerWithToken(adminToken, "intruso");

            const res = await api().patch(`/company/${id}`).set(bearer(intruder.token)).send({ name: "Invadida" });

            expect(res.status).toBe(403);
            expect((await CompanyModel.findById(id))?.name).toBe("Barbearia Teste");
        });

        it("admin altera qualquer empresa", async () => {
            const { id } = await createCompany(adminToken, owner.ownerId);

            const res = await api().patch(`/company/${id}`).set(bearer(adminToken)).send({ name: "Por Admin" });

            expect(res.status).toBe(200);
        });

        it("rejeita horário inválido (406) e empresa inexistente (404)", async () => {
            const { id } = await createCompany(adminToken, owner.ownerId);

            const invalid = await api().patch(`/company/${id}`).set(bearer(owner.token)).send({
                configuration: { defaultPeriodInMinutes: 30, openingHours: "99:99", closingTime: "18:00", lunchBreak: { start: "12:00", end: "13:00" } },
            });
            const missing = await api().patch("/company/64b7f0c2a1b2c3d4e5f60718").set(bearer(owner.token)).send({ name: "x" });

            expect(invalid.status).toBe(406);
            expect(missing.status).toBe(404);
        });

        it("cliente (Firebase) não acessa a rota de owner (401)", async () => {
            const { id } = await createCompany(adminToken, owner.ownerId);

            const res = await api().patch(`/company/${id}`).set(bearer(client().token)).send({ name: "x" });

            expect(res.status).toBe(401);
        });
    });

    describe("DELETE /company/:id", () => {
        it("admin exclui (soft delete); a empresa deixa de ser localizada e libera o CNPJ", async () => {
            const cnpj = "11111111000111";
            const { id } = await createCompany(adminToken, owner.ownerId, { cnpj, subdomain: "loja" });

            const res = await api().delete(`/company/${id}`).set(bearer(adminToken));

            expect(res.status).toBe(204);
            expect((await api().get(`/company/${id}`).set(bearer(client().token))).status).toBe(404);
            expect((await api().get("/company/search_domain").query({ subdomain: "loja" })).status).toBe(404);
            expect((await createCompany(adminToken, owner.ownerId, { cnpj })).res.status).toBe(200);
        });

        it("owner não exclui (403) e excluir duas vezes retorna 404", async () => {
            const { id } = await createCompany(adminToken, owner.ownerId);

            expect((await api().delete(`/company/${id}`).set(bearer(owner.token))).status).toBe(403);
            expect((await api().delete(`/company/${id}`).set(bearer(adminToken))).status).toBe(204);
            expect((await api().delete(`/company/${id}`).set(bearer(adminToken))).status).toBe(404);
        });
    });

    describe("PUT /company/update_logo/:companyId", () => {
        it("dono envia o logo, que é gravado no storage e a URL salva na empresa", async () => {
            const { id } = await createCompany(adminToken, owner.ownerId);

            const res = await api().put(`/company/update_logo/${id}`).set(bearer(owner.token))
                .attach("file", Buffer.from("conteudo-da-imagem"), "logo.png");

            expect(res.status).toBe(200);
            expect(res.body.dados.logoUrl).toBe(`https://storage.test/${id}/logo.png`);
            expect(uploadedFiles).toEqual([{ path: `${id}/logo.png`, size: "conteudo-da-imagem".length }]);
            expect((await CompanyModel.findById(id))?.logoUrl).toBe(res.body.dados.logoUrl);
        });

        it("outro owner não envia logo (403) e nada vai ao storage", async () => {
            const { id } = await createCompany(adminToken, owner.ownerId);
            const intruder = await createOwnerWithToken(adminToken, "intruso");

            const res = await api().put(`/company/update_logo/${id}`).set(bearer(intruder.token))
                .attach("file", Buffer.from("x"), "logo.png");

            expect(res.status).toBe(403);
            expect(uploadedFiles).toHaveLength(0);
        });

        // DEFEITO CONHECIDO: z.base64() aceita string vazia, então a API grava um arquivo vazio em "<companyId>/" e responde 200.
        // Remova o ".fails" quando o controller/serviço passar a exigir o arquivo.
        it.fails("rejeita requisição sem arquivo (406)", async () => {
            const { id } = await createCompany(adminToken, owner.ownerId);

            const res = await api().put(`/company/update_logo/${id}`).set(bearer(owner.token));

            expect(res.status).toBe(406);
            expect(uploadedFiles).toHaveLength(0);
        });
    });
});
