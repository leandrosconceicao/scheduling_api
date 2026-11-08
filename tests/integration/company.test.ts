import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CompanyModel } from "@domain";
import { deletedFiles, uploadedFiles } from "../support/fakes";
import {
    api, bearer, client, companyPayload, createCompany, createOwnerWithToken, initDatabase, makePng, resetState, seedAdmin,
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
                    workingDays: [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day })),
                },
            });
        });

        it("cadastra empresa com dias de funcionamento definidos (ordenados)", async () => {
            const { res } = await createCompany(adminToken, owner.ownerId, {
                configuration: { defaultPeriodInMinutes: 30, workingDays: [6, 1, 2, 3, 4, 5] },
            });

            expect(res.status).toBe(200);
            expect(res.body.dados.configuration.workingDays).toEqual([1, 2, 3, 4, 5, 6].map((day) => ({ day })));
        });

        it("cadastra horários próprios por dia (sábado meio período e sem almoço)", async () => {
            const { res } = await createCompany(adminToken, owner.ownerId, {
                configuration: {
                    defaultPeriodInMinutes: 30,
                    workingDays: [1, 2, 3, 4, 5, { day: 6, openingHours: "08:00", closingTime: "12:00", lunchBreak: null }],
                },
            });

            expect(res.status).toBe(200);
            expect(res.body.dados.configuration).toMatchObject({ openingHours: "08:00", closingTime: "18:00" });
            expect(res.body.dados.configuration.workingDays).toEqual([
                { day: 1 }, { day: 2 }, { day: 3 }, { day: 4 }, { day: 5 },
                { day: 6, openingHours: "08:00", closingTime: "12:00", lunchBreak: null },
            ]);
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
            ["dia da semana inválido", { configuration: { defaultPeriodInMinutes: 30, workingDays: [1, 7] } }],
            ["dias de funcionamento vazio", { configuration: { defaultPeriodInMinutes: 30, workingDays: [] } }],
            ["dias da semana repetidos", { configuration: { defaultPeriodInMinutes: 30, workingDays: [1, { day: 1, closingTime: "12:00" }] } }],
            ["horário do dia inválido", { configuration: { defaultPeriodInMinutes: 30, workingDays: [{ day: 6, closingTime: "25:00" }] } }],
            ["fechamento antes da abertura", { configuration: { defaultPeriodInMinutes: 30, openingHours: "18:00", closingTime: "08:00" } }],
            ["fechamento do dia antes da abertura padrão", { configuration: { defaultPeriodInMinutes: 30, workingDays: [{ day: 6, closingTime: "07:00" }] } }],
            ["almoço terminando antes de começar", { configuration: { defaultPeriodInMinutes: 30, lunchBreak: { start: "13:00", end: "12:00" } } }],
            ["período zerado", { configuration: { defaultPeriodInMinutes: 0 } }],
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

        it("dono altera os dias de funcionamento", async () => {
            const { id } = await createCompany(adminToken, owner.ownerId);

            const res = await api().patch(`/company/${id}`).set(bearer(owner.token)).send({
                configuration: {
                    defaultPeriodInMinutes: 30, openingHours: "08:00", closingTime: "18:00",
                    lunchBreak: { start: "12:00", end: "13:00" }, workingDays: [1, 2, 3, 4, 5],
                },
            });

            expect(res.status).toBe(200);
            expect(res.body.dados.configuration.workingDays).toEqual([1, 2, 3, 4, 5].map((day) => ({ day })));
        });

        it("configuration aceita atualização parcial: só os campos enviados mudam", async () => {
            const { id } = await createCompany(adminToken, owner.ownerId);

            const onlyDays = await api().patch(`/company/${id}`).set(bearer(owner.token)).send({
                configuration: { workingDays: [1, { day: 6, closingTime: "12:00", lunchBreak: null }] },
            });

            expect(onlyDays.status).toBe(200);
            expect(onlyDays.body.dados.configuration).toMatchObject({
                defaultPeriodInMinutes: 30,
                openingHours: "08:00",
                closingTime: "18:00",
                lunchBreak: { start: "12:00", end: "13:00" },
                lockSchedulePeriodInMinutes: 10,
                workingDays: [{ day: 1 }, { day: 6, closingTime: "12:00", lunchBreak: null }],
            });

            const onlyClosing = await api().patch(`/company/${id}`).set(bearer(owner.token)).send({
                configuration: { closingTime: "20:00", lockSchedulePeriodInMinutes: 5 },
            });

            expect(onlyClosing.status).toBe(200);
            expect(onlyClosing.body.dados.configuration).toMatchObject({
                openingHours: "08:00",
                closingTime: "20:00",
                lockSchedulePeriodInMinutes: 5,
                workingDays: [{ day: 1 }, { day: 6, closingTime: "12:00", lunchBreak: null }],
            });
        });

        it("valida a configuração resultante da mescla com o que já está salvo (406) e nada é gravado", async () => {
            const { id } = await createCompany(adminToken, owner.ownerId);

            // Isoladamente "19:00" é válido, mas fica depois do fechamento já salvo (18:00)
            const lateOpening = await api().patch(`/company/${id}`).set(bearer(owner.token)).send({
                configuration: { openingHours: "19:00" },
            });
            // Sábado herdaria a abertura padrão (08:00), posterior ao fechamento informado para o dia
            const dayBeforeOpening = await api().patch(`/company/${id}`).set(bearer(owner.token)).send({
                configuration: { workingDays: [{ day: 6, closingTime: "07:30" }] },
            });

            expect(lateOpening.status).toBe(406);
            expect(dayBeforeOpening.status).toBe(406);

            const saved = (await CompanyModel.findById(id))!.configuration;
            expect(saved.openingHours).toBe("08:00");
            expect(saved.workingDays).toHaveLength(7);
        });

        it("atualiza só os campos de endereço enviados e preserva os demais", async () => {
            const { id } = await createCompany(adminToken, owner.ownerId, {
                address: { street: "Rua A", number: "100", city: "São Paulo", state: "SP", zipCode: "01000000" },
            });

            const res = await api().patch(`/company/${id}`).set(bearer(owner.token)).send({
                address: { city: "Recife", state: "PE", complement: "Sala 2" },
            });

            expect(res.status).toBe(200);
            expect(res.body.dados.address).toMatchObject({
                street: "Rua A",
                number: "100",
                zipCode: "01000000",
                city: "Recife",
                state: "PE",
                complement: "Sala 2",
            });

            const cleared = await api().patch(`/company/${id}`).set(bearer(owner.token)).send({ address: { complement: "" } });

            expect(cleared.body.dados.address).toMatchObject({ complement: "", street: "Rua A", city: "Recife" });
        });

        it("cadastra redes sociais ainda não preenchidas e preserva as não enviadas", async () => {
            const { id } = await createCompany(adminToken, owner.ownerId, { social: { instagram: "@antigo" } });

            const res = await api().patch(`/company/${id}`).set(bearer(owner.token)).send({
                social: { email: "contato@barbearia.com", whatsapp: "81999999999" },
            });

            expect(res.status).toBe(200);
            expect(res.body.dados.social).toMatchObject({
                instagram: "@antigo",
                email: "contato@barbearia.com",
                whatsapp: "81999999999",
            });

            const cleared = await api().patch(`/company/${id}`).set(bearer(owner.token)).send({ social: { instagram: "" } });

            expect(cleared.body.dados.social).toMatchObject({ instagram: "", email: "contato@barbearia.com" });
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
                .attach("file", await makePng(), "logo.png");

            expect(res.status).toBe(200);
            expect(res.body.dados.logoUrl).toMatch(new RegExp(`^https://storage.test/${id}/logo-[0-9a-f-]{36}\\.webp$`));
            expect(uploadedFiles).toHaveLength(1);
            expect(uploadedFiles[0].path).toBe(res.body.dados.logoUrl.replace("https://storage.test/", ""));
            expect((await CompanyModel.findById(id))?.logoUrl).toBe(res.body.dados.logoUrl);
        });

        it("redimensiona para no máximo 512 px e converte para WebP", async () => {
            const { id } = await createCompany(adminToken, owner.ownerId);

            await api().put(`/company/update_logo/${id}`).set(bearer(owner.token)).attach("file", await makePng(2000, 1000), "logo.png");

            const { default: sharp } = await import("sharp");
            const meta = await sharp(uploadedFiles[0].buffer).metadata();
            expect(meta).toMatchObject({ format: "webp", width: 512, height: 256 });
        });

        it("ao trocar o logo, remove o arquivo anterior do storage", async () => {
            const { id } = await createCompany(adminToken, owner.ownerId);

            const first = await api().put(`/company/update_logo/${id}`).set(bearer(owner.token)).attach("file", await makePng(), "a.png");
            const second = await api().put(`/company/update_logo/${id}`).set(bearer(owner.token)).attach("file", await makePng(), "b.png");

            expect(second.body.dados.logoUrl).not.toBe(first.body.dados.logoUrl);
            expect(deletedFiles).toEqual([first.body.dados.logoUrl.replace("https://storage.test/", "")]);
        });

        it("rejeita arquivo que não é imagem, mesmo com MIME de imagem (406)", async () => {
            const { id } = await createCompany(adminToken, owner.ownerId);

            const res = await api().put(`/company/update_logo/${id}`).set(bearer(owner.token))
                .attach("file", Buffer.from("conteudo-qualquer"), { filename: "logo.png", contentType: "image/png" });

            expect(res.status).toBe(406);
            expect(uploadedFiles).toHaveLength(0);
        });

        it("rejeita MIME não permitido (406) e arquivo acima de 2 MB (406)", async () => {
            const { id } = await createCompany(adminToken, owner.ownerId);

            const pdf = await api().put(`/company/update_logo/${id}`).set(bearer(owner.token))
                .attach("file", Buffer.from("%PDF-1.4"), { filename: "x.pdf", contentType: "application/pdf" });
            const big = await api().put(`/company/update_logo/${id}`).set(bearer(owner.token))
                .attach("file", Buffer.alloc(2 * 1024 * 1024 + 1), { filename: "x.png", contentType: "image/png" });

            expect(pdf.status).toBe(406);
            expect(big.status).toBe(406);
            expect(uploadedFiles).toHaveLength(0);
        });

        it("outro owner não envia logo (403) e nada vai ao storage", async () => {
            const { id } = await createCompany(adminToken, owner.ownerId);
            const intruder = await createOwnerWithToken(adminToken, "intruso");

            const res = await api().put(`/company/update_logo/${id}`).set(bearer(intruder.token))
                .attach("file", await makePng(), "logo.png");

            expect(res.status).toBe(403);
            expect(uploadedFiles).toHaveLength(0);
        });

        it("rejeita requisição sem arquivo (406)", async () => {
            const { id } = await createCompany(adminToken, owner.ownerId);

            const res = await api().put(`/company/update_logo/${id}`).set(bearer(owner.token));

            expect(res.status).toBe(406);
            expect(uploadedFiles).toHaveLength(0);
        });
    });
});
