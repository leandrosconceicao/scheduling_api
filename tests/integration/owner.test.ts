import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import Jwt from "jsonwebtoken";
import { OwnerModel } from "@domain";
import { ADMIN, api, bearer, createOwner, createOwnerWithToken, initDatabase, login, resetState, seedAdmin } from "../support/helpers";

describe("Owners", () => {
    let adminToken: string;

    beforeAll(initDatabase);
    beforeEach(async () => {
        await resetState();
        adminToken = await seedAdmin();
    });

    describe("POST /owner/auth", () => {
        it("autentica com credenciais válidas e devolve um JWT de 30 minutos", async () => {
            const res = await api().post("/owner/auth").send({ username: ADMIN.username, password: ADMIN.password });

            expect(res.status).toBe(200);
            expect(res.body.statusProcess).toBe(true);
            expect(res.body.dados).toMatchObject({ name: ADMIN.name, username: ADMIN.username });
            expect(res.body.dados.password).toBeUndefined();

            const payload = Jwt.decode(res.body.dados.token) as Jwt.JwtPayload;
            expect(payload.role).toBe("admin");
            expect(payload.exp! - payload.iat!).toBe(30 * 60);
        });

        it("rejeita senha incorreta com 401", async () => {
            const res = await api().post("/owner/auth").send({ username: ADMIN.username, password: "errada" });
            expect(res.status).toBe(401);
        });

        it("rejeita usuário inexistente com a mesma mensagem (sem enumerar usuários)", async () => {
            const wrongPass = await api().post("/owner/auth").send({ username: ADMIN.username, password: "errada" });
            const unknown = await api().post("/owner/auth").send({ username: "ninguem", password: "x" });

            expect(unknown.status).toBe(401);
            expect(unknown.body.message).toBe(wrongPass.body.message);
        });

        it("rejeita corpo inválido com 406", async () => {
            const res = await api().post("/owner/auth").send({ username: "x" });
            expect(res.status).toBe(406);
        });

        it("rejeita JSON malformado com 400", async () => {
            const res = await api().post("/owner/auth").set("Content-Type", "application/json").send("{invalido");
            expect(res.status).toBe(400);
        });
    });

    describe("POST /owner", () => {
        it("admin cria owner com senha armazenada em hash e papel padrão 'owner'", async () => {
            const { res } = await createOwner(adminToken, "novo", "segredo123");

            expect(res.status).toBe(200);
            const stored = await OwnerModel.findOne({ username: "novo" });
            expect(stored?.password).not.toBe("segredo123");
            expect(stored?.role).toBe("owner");
            expect(await login("novo", "segredo123")).toBeTruthy();
        });

        it("não permite username duplicado", async () => {
            await createOwner(adminToken, "dup");
            const { res } = await createOwner(adminToken, "dup");

            expect(res.status).toBe(400);
            expect(await OwnerModel.countDocuments({ username: "dup" })).toBe(1);
        });

        it("exige token", async () => {
            const res = await api().post("/owner").send({ username: "a", password: "b", name: "c" });
            expect(res.status).toBe(401);
        });

        it("owner comum não pode criar owners (403)", async () => {
            const { token } = await createOwnerWithToken(adminToken);
            const res = await api().post("/owner").set(bearer(token)).send({ username: "a", password: "b", name: "c" });
            expect(res.status).toBe(403);
        });

        it("não permite escalar privilégio enviando role=admin no corpo", async () => {
            const res = await api().post("/owner").set(bearer(adminToken))
                .send({ username: "tentativa", password: "x", name: "y", role: "admin" });

            expect(res.status).toBe(200);
            expect((await OwnerModel.findOne({ username: "tentativa" }))?.role).toBe("owner");
        });
    });

    describe("PATCH /owner/:id", () => {
        it("owner altera o próprio nome e senha", async () => {
            const { token, ownerId } = await createOwnerWithToken(adminToken, "alvo");

            const res = await api().patch(`/owner/${ownerId}`).set(bearer(token)).send({ name: "Novo Nome", password: "nova-senha" });

            expect(res.status).toBe(200);
            expect(res.body.dados.name).toBe("Novo Nome");
            expect(await login("alvo", "nova-senha")).toBeTruthy();
            expect(await login("alvo", "senha-dono")).toBeUndefined();
        });

        it("owner não altera outro owner (403)", async () => {
            const a = await createOwnerWithToken(adminToken, "a");
            const b = await createOwnerWithToken(adminToken, "b");

            const res = await api().patch(`/owner/${b.ownerId}`).set(bearer(a.token)).send({ name: "hack" });

            expect(res.status).toBe(403);
            expect((await OwnerModel.findById(b.ownerId))?.name).not.toBe("hack");
        });

        it("admin altera qualquer owner", async () => {
            const { ownerId } = await createOwnerWithToken(adminToken, "alvo");
            const res = await api().patch(`/owner/${ownerId}`).set(bearer(adminToken)).send({ name: "Por Admin" });

            expect(res.status).toBe(200);
            expect(res.body.dados.name).toBe("Por Admin");
        });

        it("retorna 406 para id inválido e 404 para owner inexistente", async () => {
            expect((await api().patch("/owner/abc").set(bearer(adminToken)).send({ name: "x" })).status).toBe(406);
            expect((await api().patch("/owner/64b7f0c2a1b2c3d4e5f60718").set(bearer(adminToken)).send({ name: "x" })).status).toBe(404);
        });
    });

    describe("DELETE /owner/:id", () => {
        it("admin remove (soft delete) e o owner não consegue mais autenticar", async () => {
            const { ownerId } = await createOwnerWithToken(adminToken, "saindo");

            const res = await api().delete(`/owner/${ownerId}`).set(bearer(adminToken));

            expect(res.status).toBe(200);
            expect((await OwnerModel.findById(ownerId))?.deleted).toBe(true);
            expect(await login("saindo", "senha-dono")).toBeUndefined();
        });

        it("owner comum não pode remover (403)", async () => {
            const a = await createOwnerWithToken(adminToken, "a");
            const res = await api().delete(`/owner/${a.ownerId}`).set(bearer(a.token));
            expect(res.status).toBe(403);
        });

        it("permite recriar o username após a exclusão", async () => {
            const { ownerId } = await createOwnerWithToken(adminToken, "reuso");
            await api().delete(`/owner/${ownerId}`).set(bearer(adminToken));

            const { res } = await createOwner(adminToken, "reuso");
            expect(res.status).toBe(200);
        });
    });

    describe("Token de owner", () => {
        it("aceita o token sem o prefixo Bearer", async () => {
            const res = await api().post("/owner").set("Authorization", adminToken).send({ username: "sem-prefixo", password: "x", name: "y" });
            expect(res.status).toBe(200);
        });

        it("rejeita token assinado com outra chave (401)", async () => {
            const forged = Jwt.sign({ role: "admin" }, "outra-chave", { subject: "x" });
            const res = await api().post("/owner").set(bearer(forged)).send({ username: "a", password: "b", name: "c" });
            expect(res.status).toBe(401);
        });

        it("rejeita token expirado (401)", async () => {
            const expired = Jwt.sign({ role: "admin" }, process.env.CHAVE_JWT!, { subject: "x", expiresIn: -10 });
            const res = await api().post("/owner").set(bearer(expired)).send({ username: "a", password: "b", name: "c" });
            expect(res.status).toBe(401);
        });

        it("rejeita token malformado (401)", async () => {
            const res = await api().post("/owner").set(bearer("lixo")).send({ username: "a", password: "b", name: "c" });
            expect(res.status).toBe(401);
        });
    });
});
