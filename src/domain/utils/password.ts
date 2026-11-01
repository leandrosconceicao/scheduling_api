import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt) as (password: string, salt: string, keylen: number) => Promise<Buffer>;

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

export class Password {

    // Formato armazenado: "<salt>:<hash>", ambos em hex
    static async hash(password: string): Promise<string> {
        const salt = randomBytes(SALT_LENGTH).toString("hex");
        const derivedKey = await scryptAsync(password, salt, KEY_LENGTH);

        return `${salt}:${derivedKey.toString("hex")}`;
    }

    static async verify(password: string, stored: string): Promise<boolean> {
        const [salt, hash] = stored.split(":");

        if (!salt || !hash) return false;

        const storedKey = Buffer.from(hash, "hex");
        const derivedKey = await scryptAsync(password, salt, KEY_LENGTH);

        return storedKey.length === derivedKey.length && timingSafeEqual(storedKey, derivedKey);
    }
}
