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

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const MIN_CHECK_INTERVAL_MS = 10_000;

const store = globalThis as typeof globalThis & {
	__slotAlertSessions?: Map<string, ServerSession>;
};

const sessions = store.__slotAlertSessions ?? new Map<string, ServerSession>();
store.__slotAlertSessions = sessions;

export function createSession(token: string, config: SlotConfig): string {
	const id = crypto.randomUUID();

	sessions.set(id, {
		token,
		config,
		lastCheckAt: 0,
		expiresAt: Date.now() + SESSION_TTL_MS,
		activities: [],
		lastKnownSlotIds: new Set(),
	});

	return id;
}

export function getSession(id: string | undefined): ServerSession | null {
	if (!id)
		return null;

	const session = sessions.get(id);
	if (!session || session.expiresAt < Date.now()) {
		sessions.delete(id);
		return null;
	}

	return session;
}

export function deleteSession(id: string | undefined) {
	if (id)
		sessions.delete(id);
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
		id: crypto.randomUUID(),
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
