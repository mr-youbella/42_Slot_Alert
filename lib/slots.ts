export type SlotConfig = {
	project: string;
	teamId: string;
};

export type SlotCheck = {
	availableSlots: number;
	checkedAt: string;
};

const PROJECT_HOST = "projects.intra.42.fr";
const PROJECT_PATTERN = /^[a-z0-9][a-z0-9_-]{0,79}$/i;
const TEAM_PATTERN = /^\d{1,16}$/;

export function parseSlotConfig(project: unknown, teamId: unknown,): SlotConfig | null {
	if (typeof project !== "string" || typeof teamId !== "string" || !PROJECT_PATTERN.test(project) || !TEAM_PATTERN.test(teamId))
		return null;

	return { project, teamId };
}

export function parseSlotsLink(value: unknown): SlotConfig | null {
	if (typeof value !== "string")
		return null;

	try {
		const url = new URL(value);
		const match = url.pathname.match(/^\/projects\/([^/]+)\/slots(?:\.json)?\/?$/,);

		if (url.protocol !== "https:" || url.hostname !== PROJECT_HOST || !match)
			return null;

		return parseSlotConfig(decodeURIComponent(match[1]), url.searchParams.get("team_id"),);
	} catch {
		return null;
	}
}

function extractCount(payload: unknown): number {
	if (Array.isArray(payload))
		return payload.length;

	if (payload && typeof payload === "object" && "slots" in payload && Array.isArray(payload.slots))
		return payload.slots.length;

	return 0;
}

export async function checkSlots(token: string, config: SlotConfig,): Promise<SlotCheck> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 12_000);
	const url = new URL(`https://${PROJECT_HOST}/projects/${encodeURIComponent(config.project)}/slots.json`,);

	url.searchParams.set("team_id", config.teamId);

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

		return { availableSlots: extractCount(payload), checkedAt: new Date().toISOString(), };
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
