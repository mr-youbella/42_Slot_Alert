import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from "node:crypto";
import { Redis } from "@upstash/redis";
import type { SlotConfig } from "./slots";

export type ActivityTone = "info" | "success" | "error";

export type SessionActivity = {
	id: string;
	title: string;
	description: string;
	tone: ActivityTone;
	createdAt: number;
};

export type ServerSession = {
	token: string;
	config: SlotConfig;
	lastCheckAt: number;
	expiresAt: number;
	activities: SessionActivity[];
	lastKnownSlotIds: Set<string>;
};

type StoredSession = Omit<ServerSession, "lastKnownSlotIds"> & {
	lastKnownSlotIds: string[];
};

type RedisStore = typeof globalThis & {
	__slotAlertRedis?: Redis;
};

const SESSION_TTL_SECONDS = 12 * 60 * 60;
const SESSION_TTL_MS = SESSION_TTL_SECONDS * 1000;
const MIN_CHECK_INTERVAL_MS = 10_000;
const SESSION_KEY_PREFIX = "slot-alert:session:";

export class SessionStoreError extends Error { }

function getRedis(): Redis {
	const url = process.env.UPSTASH_REDIS_REST_URL;
	const token = process.env.UPSTASH_REDIS_REST_TOKEN;

	if (!url || !token)
		throw new SessionStoreError("Redis is not configured. Add the Upstash environment variables.");

	const store = globalThis as RedisStore;
	store.__slotAlertRedis ??= new Redis({ url, token });
	return store.__slotAlertRedis;
}

function getEncryptionKey(): Buffer {
	const value = process.env.SESSION_ENCRYPTION_KEY;

	if (!value || !/^[a-f0-9]{64}$/i.test(value))
		throw new SessionStoreError("SESSION_ENCRYPTION_KEY must contain 64 hexadecimal characters.");

	return Buffer.from(value, "hex");
}

function encryptToken(token: string): string {
	const iv = randomBytes(12);
	const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
	const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
	const tag = cipher.getAuthTag();

	return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

function decryptToken(value: string): string {
	const [ivValue, tagValue, encryptedValue] = value.split(".");

	if (!ivValue || !tagValue || !encryptedValue)
		throw new SessionStoreError("Stored session data is invalid.");

	try {
		const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(ivValue, "base64url"));
		decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
		return Buffer.concat([decipher.update(Buffer.from(encryptedValue, "base64url")), decipher.final()]).toString("utf8");
	} catch {
		throw new SessionStoreError("Stored session data could not be decrypted.");
	}
}

function sessionKey(id: string): string {
	return `${SESSION_KEY_PREFIX}${id}`;
}

function toStoredSession(session: ServerSession): StoredSession {
	return {
		...session,
		token: encryptToken(session.token),
		lastKnownSlotIds: [...session.lastKnownSlotIds],
	};
}

function fromStoredSession(session: StoredSession): ServerSession {
	return {
		...session,
		token: decryptToken(session.token),
		lastKnownSlotIds: new Set(session.lastKnownSlotIds),
	};
}

export async function createSession(token: string, config: SlotConfig): Promise<{ id: string; session: ServerSession; }> {
	const id = randomUUID();
	const session: ServerSession = {
		token,
		config,
		lastCheckAt: 0,
		expiresAt: Date.now() + SESSION_TTL_MS,
		activities: [],
		lastKnownSlotIds: new Set(),
	};

	await getRedis().set(sessionKey(id), toStoredSession(session), { ex: SESSION_TTL_SECONDS });
	return { id, session };
}

export async function getSession(id: string | undefined): Promise<ServerSession | null> {
	if (!id)
		return null;

	const storedSession = await getRedis().get<StoredSession>(sessionKey(id));
	if (!storedSession)
		return null;

	if (storedSession.expiresAt <= Date.now()) {
		await deleteSession(id);
		return null;
	}

	return fromStoredSession(storedSession);
}

export async function saveSession(id: string, session: ServerSession) {
	const remainingSeconds = Math.ceil((session.expiresAt - Date.now()) / 1000);

	if (remainingSeconds <= 0) {
		await deleteSession(id);
		return;
	}

	await getRedis().set(sessionKey(id), toStoredSession(session), { ex: remainingSeconds });
}

export async function deleteSession(id: string | undefined) {
	if (id)
		await getRedis().del(sessionKey(id));
}

export function remainingCooldown(session: ServerSession): number {
	return Math.max(0, MIN_CHECK_INTERVAL_MS - (Date.now() - session.lastCheckAt));
}

export function markChecked(session: ServerSession) {
	session.lastCheckAt = Date.now();
}

export function updateSessionConfig(session: ServerSession, config: SlotConfig) {
	session.config = config;
	session.lastCheckAt = 0;
	session.lastKnownSlotIds = new Set();
}

export function addSessionActivity(session: ServerSession, title: string, description: string, tone: ActivityTone = "info",) {
	session.activities.unshift({
		id: randomUUID(),
		title,
		description,
		tone,
		createdAt: Date.now(),
	});
	session.activities = session.activities.slice(0, 20);
}

export function getNewSlotIds(session: ServerSession, slotIds: string[]): string[] {
	return slotIds.filter((id) => !session.lastKnownSlotIds.has(id));
}

export function updateKnownSlotIds(session: ServerSession, slotIds: string[]) {
	session.lastKnownSlotIds = new Set(slotIds);
}
