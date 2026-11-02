import "@/dependency_injection";
import database from "@config/database";
import request from "supertest";
import mongoose from "mongoose";
import { createApp } from "@/create_app";
import { OwnerModel, OwnerRole, Password } from "@domain";
import { clientToken, resetFakes } from "./fakes";

export const app = createApp();
export const api = () => request(app);
export { clientToken };

export const ADMIN = { username: "admin", password: "admin-pass", name: "Administrador" };

/** Garante índices (unicidade) criados antes do primeiro teste e limpa dados/fakes entre testes. */
export async function initDatabase() {
    await database.asPromise();
    await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
}

export async function resetState() {
    resetFakes();
    await Promise.all(Object.values(mongoose.models).map((m) => m.deleteMany({})));
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

// ---- Owners ----
// O primeiro admin só pode ser criado direto no banco (README: "Criando o primeiro administrador")
export async function seedAdmin() {
    await OwnerModel.create({
        ...ADMIN,
        password: await Password.hash(ADMIN.password),
        role: OwnerRole.admin,
    });
    return login(ADMIN.username, ADMIN.password);
}

export async function login(username: string, password: string) {
    const res = await api().post("/owner/auth").send({ username, password });
    return res.body.dados?.token as string;
}

export async function createOwner(adminToken: string, username = "dono", password = "senha-dono") {
    const res = await api().post("/owner").set(bearer(adminToken)).send({ username, password, name: `Nome ${username}` });
    return { res, username, password };
}

export async function createOwnerWithToken(adminToken: string, username = "dono") {
    const { password } = await createOwner(adminToken, username);
    const token = await login(username, password);
    const ownerId = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).sub as string;
    return { token, ownerId, username };
}

// ---- Companies ----
export function companyPayload(ownerId: string, overrides: Record<string, unknown> = {}) {
    return {
        cnpj: String(Math.floor(Math.random() * 1e14)).padStart(14, "0"),
        name: "Barbearia Teste",
        subdomain: `barbearia-${Math.random().toString(36).slice(2, 8)}`,
        ownerId,
        configuration: { defaultPeriodInMinutes: 30 },
        ...overrides,
    };
}

export async function createCompany(adminToken: string, ownerId: string, overrides: Record<string, unknown> = {}) {
    const res = await api().post("/company").set(bearer(adminToken)).send(companyPayload(ownerId, overrides));
    return { res, id: res.body.dados?._id as string };
}

// ---- Schedules ----
export async function createScheduleType(ownerToken: string, companyId: string, name = "Corte", price = 50) {
    const res = await api().post(`/schedules/types/${companyId}`).set(bearer(ownerToken)).send({ name, price });
    return { res, id: res.body.dados?._id as string };
}

export async function createEmployee(ownerToken: string, companyId: string, name = "João") {
    const res = await api().post(`/company/employees/${companyId}`).set(bearer(ownerToken))
        .send({ name, profilePhotoUrl: "https://img.test/joao.png" });
    return { res, id: res.body.dados?._id as string };
}

/** Horário local de amanhã (a API monta a grade com horário local do servidor). */
export function slot(hour: number, minute = 0, durationMinutes = 30, daysAhead = 1) {
    const start = new Date();
    start.setDate(start.getDate() + daysAhead);
    start.setHours(hour, minute, 0, 0);
    const end = new Date(start.getTime() + durationMinutes * 60_000);
    return { startsAt: start.toISOString(), endsAt: end.toISOString() };
}

export function localDate(daysAhead = 1) {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const client = (uid = "cliente-1") => ({
    uid,
    token: clientToken({ uid, name: `Cliente ${uid}`, email: `${uid}@teste.com` }),
});

/** Cenário completo: admin, dono, empresa, tipo de serviço e funcionário. */
export async function setupCompanyScenario() {
    const adminToken = await seedAdmin();
    const owner = await createOwnerWithToken(adminToken);
    const company = await createCompany(adminToken, owner.ownerId);
    const type = await createScheduleType(owner.token, company.id);
    const employee = await createEmployee(owner.token, company.id);

    return { adminToken, owner, companyId: company.id, typeId: type.id, employeeId: employee.id };
}
