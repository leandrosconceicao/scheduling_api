import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { EmployeeModel } from "@domain";
import { deletedFiles, uploadedFiles } from "../support/fakes";
import {
    api, bearer, client, createCompany, createEmployee, createOwnerWithToken, initDatabase, makePng, resetState, seedAdmin,
} from "../support/helpers";

describe("Funcionários", () => {
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

    describe("POST /company/employees/:companyId", () => {
        it("dono cadastra funcionário na própria empresa", async () => {
            const { res } = await createEmployee(owner.token, companyId, "Maria");

            expect(res.status).toBe(200);
            expect(res.body.dados).toMatchObject({ name: "Maria", companyId, rating: 5 });
        });

        it("não permite funcionário com o mesmo nome na mesma empresa (409), mas permite em outra", async () => {
            await createEmployee(owner.token, companyId, "Maria");
            expect((await createEmployee(owner.token, companyId, "Maria")).res.status).toBe(409);

            const other = (await createCompany(adminToken, owner.ownerId)).id;
            expect((await createEmployee(owner.token, other, "Maria")).res.status).toBe(200);
        });

        it("outro owner não cadastra na empresa alheia (403)", async () => {
            const intruder = await createOwnerWithToken(adminToken, "intruso");

            const { res } = await createEmployee(intruder.token, companyId);

            expect(res.status).toBe(403);
            expect(await EmployeeModel.countDocuments()).toBe(0);
        });

        it("rejeita nome ausente (406) e ignora profilePhotoUrl enviado no body", async () => {
            const noName = await api().post(`/company/employees/${companyId}`).set(bearer(owner.token)).send({});
            const withUrl = await api().post(`/company/employees/${companyId}`).set(bearer(owner.token))
                .send({ name: "Ana", profilePhotoUrl: "https://img.test/a.png" });

            expect(noName.status).toBe(406);
            expect(withUrl.status).toBe(200);
            expect(withUrl.body.dados.profilePhotoUrl).toBeUndefined();
        });

        it("retorna 404 para empresa inexistente", async () => {
            const { res } = await createEmployee(owner.token, "64b7f0c2a1b2c3d4e5f60718");

            expect(res.status).toBe(404);
        });
    });

    describe("listagens", () => {
        beforeEach(async () => {
            await createEmployee(owner.token, companyId, "Ana");
            await createEmployee(owner.token, companyId, "Bia");
        });

        it("cliente lista os funcionários da empresa (GET /company/employees/:companyId)", async () => {
            const res = await api().get(`/company/employees/${companyId}`).set(bearer(client().token));

            expect(res.status).toBe(200);
            expect(res.body.dados.map((e: any) => e.name).sort()).toEqual(["Ana", "Bia"]);
        });

        it("dono lista os funcionários (GET /company/:companyId/employees)", async () => {
            const res = await api().get(`/company/${companyId}/employees`).set(bearer(owner.token));

            expect(res.status).toBe(200);
            expect(res.body.dados).toHaveLength(2);
        });

        it("outro owner não lista pela rota administrativa (403)", async () => {
            const intruder = await createOwnerWithToken(adminToken, "intruso");

            const res = await api().get(`/company/${companyId}/employees`).set(bearer(intruder.token));

            expect(res.status).toBe(403);
        });

        it("a listagem não mistura funcionários de outras empresas", async () => {
            const other = (await createCompany(adminToken, owner.ownerId)).id;
            await createEmployee(owner.token, other, "Carla");

            const res = await api().get(`/company/employees/${companyId}`).set(bearer(client().token));

            expect(res.body.dados.map((e: any) => e.name)).not.toContain("Carla");
        });

        it("a listagem de cliente exige token", async () => {
            expect((await api().get(`/company/employees/${companyId}`)).status).toBe(401);
        });
    });

    describe("GET/PATCH/DELETE /company/employees/:companyId/:id", () => {
        let employeeId: string;

        beforeEach(async () => {
            employeeId = (await createEmployee(owner.token, companyId, "Ana")).id;
        });

        it("dono consulta o funcionário", async () => {
            const res = await api().get(`/company/employees/${companyId}/${employeeId}`).set(bearer(owner.token));

            expect(res.status).toBe(200);
            expect(res.body.dados.name).toBe("Ana");
        });

        it("não localiza o funcionário usando o id de outra empresa (404)", async () => {
            const other = (await createCompany(adminToken, owner.ownerId)).id;

            const res = await api().get(`/company/employees/${other}/${employeeId}`).set(bearer(owner.token));

            expect(res.status).toBe(404);
        });

        it("dono atualiza o nome e o body não altera a foto", async () => {
            const res = await api().patch(`/company/employees/${companyId}/${employeeId}`).set(bearer(owner.token))
                .send({ name: "Ana Paula", profilePhotoUrl: "https://img.test/nova.png" });

            expect(res.status).toBe(200);
            expect(res.body.dados.name).toBe("Ana Paula");
            expect(res.body.dados.profilePhotoUrl).toBeUndefined();
        });

        describe("PUT /company/employees/:companyId/:id/photo", () => {
            const photoPath = () => `/company/employees/${companyId}/${employeeId}/photo`;

            it("dono envia a foto, que é convertida para WebP 256 px e a URL salva no funcionário", async () => {
                const res = await api().put(photoPath()).set(bearer(owner.token)).attach("file", await makePng(), "foto.png");

                expect(res.status).toBe(200);
                expect(res.body.dados.profilePhotoUrl).toMatch(
                    new RegExp(`^https://storage.test/${companyId}/employees/${employeeId}-[0-9a-f-]{36}\\.webp$`));
                expect((await EmployeeModel.findById(employeeId))?.profilePhotoUrl).toBe(res.body.dados.profilePhotoUrl);

                const { default: sharp } = await import("sharp");
                expect(await sharp(uploadedFiles[0].buffer).metadata()).toMatchObject({ format: "webp", width: 256, height: 205 });
            });

            it("ao trocar a foto, remove a anterior", async () => {
                const first = await api().put(photoPath()).set(bearer(owner.token)).attach("file", await makePng(), "a.png");
                await api().put(photoPath()).set(bearer(owner.token)).attach("file", await makePng(), "b.png");

                expect(deletedFiles).toEqual([first.body.dados.profilePhotoUrl.replace("https://storage.test/", "")]);
            });

            it("outro owner recebe 403 e nada vai ao storage", async () => {
                const intruder = await createOwnerWithToken(adminToken, "intruso");

                const res = await api().put(photoPath()).set(bearer(intruder.token)).attach("file", await makePng(), "foto.png");

                expect(res.status).toBe(403);
                expect(uploadedFiles).toHaveLength(0);
            });

            it("rejeita requisição sem arquivo, arquivo inválido e MIME não permitido (406)", async () => {
                const none = await api().put(photoPath()).set(bearer(owner.token));
                const fake = await api().put(photoPath()).set(bearer(owner.token))
                    .attach("file", Buffer.from("nao-e-imagem"), { filename: "f.png", contentType: "image/png" });
                const gif = await api().put(photoPath()).set(bearer(owner.token))
                    .attach("file", Buffer.from("GIF89a"), { filename: "f.gif", contentType: "image/gif" });

                expect([none.status, fake.status, gif.status]).toEqual([406, 406, 406]);
                expect(uploadedFiles).toHaveLength(0);
            });
        });

        it("outro owner não atualiza nem exclui (403)", async () => {
            const intruder = await createOwnerWithToken(adminToken, "intruso");
            const path = `/company/employees/${companyId}/${employeeId}`;

            expect((await api().patch(path).set(bearer(intruder.token)).send({ name: "Hack" })).status).toBe(403);
            expect((await api().delete(path).set(bearer(intruder.token))).status).toBe(403);
            expect((await EmployeeModel.findById(employeeId))).toMatchObject({ name: "Ana", deleted: undefined });
        });

        it("dono exclui (soft delete); o funcionário some das consultas e o nome pode ser reutilizado", async () => {
            const path = `/company/employees/${companyId}/${employeeId}`;

            expect((await api().delete(path).set(bearer(owner.token))).status).toBe(204);
            expect((await api().get(path).set(bearer(owner.token))).status).toBe(404);

            const list = await api().get(`/company/employees/${companyId}`).set(bearer(client().token));
            expect(list.body.dados).toHaveLength(0);

            expect((await createEmployee(owner.token, companyId, "Ana")).res.status).toBe(200);
        });

        it("retorna 406 para id inválido", async () => {
            const res = await api().get(`/company/employees/${companyId}/abc`).set(bearer(owner.token));

            expect(res.status).toBe(406);
        });
    });
});
