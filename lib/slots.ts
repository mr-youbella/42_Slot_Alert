export type SlotConfig = {
	project: string;
	teamId: string;
	nextDaysLimit: number;
};

export type SlotCheck = {
	availableSlots: number;
	slotIds: string[];
	checkedAt: string;
};

const PROJECT_HOST = "projects.intra.42.fr";
const PROJECT_PATTERN = /^[a-z0-9][a-z0-9_-]{0,79}$/i;
const TEAM_PATTERN = /^\d{1,16}$/;

export function parseSlotConfig(project: unknown, teamId: unknown, nextDaysLimit: unknown): SlotConfig | null {
	const days = typeof nextDaysLimit === "number" ? nextDaysLimit : typeof nextDaysLimit === "string" ? Number(nextDaysLimit) : NaN;

	if (typeof project !== "string" || typeof teamId !== "string" || !PROJECT_PATTERN.test(project) || !TEAM_PATTERN.test(teamId) || !Number.isInteger(days) || days < 1 || days > 30)
		return null;

	return { project, teamId, nextDaysLimit: days };
}

function extractSlots(payload: unknown): unknown[] {
	if (Array.isArray(payload))
		return payload;

	if (payload && typeof payload === "object" && "slots" in payload && Array.isArray(payload.slots))
		return payload.slots;

	return [];
}

function extractSlotIds(slots: unknown[]): string[] {
	const ids = new Set<string>();

	for (const slot of slots) {
		if (!slot || typeof slot !== "object" || !("ids" in slot) || typeof slot.ids !== "string")
			continue;

		for (const id of slot.ids.split(",")) {
			const normalizedId = id.trim();
			if (normalizedId)
				ids.add(normalizedId);
		}
	}

	return [...ids];
}

function formatDateOffset(daysOffset: number): string {
	const date = new Date();
	date.setDate(date.getDate() + daysOffset);

	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

export async function checkSlots(token: string, config: SlotConfig,): Promise<SlotCheck> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 12_000);
	const url = new URL(`https://${PROJECT_HOST}/projects/${encodeURIComponent(config.project)}/slots.json`,);

	url.searchParams.set("team_id", config.teamId);
	url.searchParams.set("start", formatDateOffset(0));
	url.searchParams.set("end", formatDateOffset(config.nextDaysLimit));

	try {
		const response = await fetch(url, {
			headers: {
				Accept: "application/json",
				Cookie: `_intra_42_session_production=${token}`,
			},
			cache: "no-store",
			signal: controller.signal,
		});

		if (response.status === 401 || response.status === 403)
			throw new SlotError(401, "Your 42 session has expired. Connect again.");
		if (response.status === 404)
			throw new SlotError(404, "Project or Team ID was not found on 42.");
		if (!response.ok)
			throw new SlotError(502, "42 could not complete this check. Try again soon.");

		let payload: unknown;
		try {
			payload = await response.json();
		} catch {
			throw new SlotError(502, "42 returned an unexpected response. Try again soon.");
		}

		const slots = extractSlots(payload);
		const slotIds = extractSlotIds(slots);
		return {
			availableSlots: slotIds.length,
			slotIds,
			checkedAt: new Date().toISOString(),
		};
	} catch (error) {
		if (error instanceof SlotError)
			throw error;
		if (error instanceof DOMException && error.name === "AbortError")
			throw new SlotError(504, "42 took too long to respond. Try again.");

		throw new SlotError(502, "Could not reach 42. Check your connection and try again.");
	} finally {
		clearTimeout(timeout);
	}
}

export class SlotError extends Error {
	constructor(public readonly status: number, message: string,) {
		super(message);
	}
}
