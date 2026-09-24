import type { SlotConfig } from "./slots";

type ServerSession = {
	token: string;
	config: SlotConfig;
	lastCheckAt: number;
	expiresAt: number;
};

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const MIN_CHECK_INTERVAL_MS = 15_000;

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
}
