import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { checkSlots, parseSlotConfig, SlotError } from "@/lib/slots";
import {
	addSessionActivity,
	getSession,
	markChecked,
	updateKnownSlotIds,
	updateSessionConfig,
} from "@/lib/server-session";

const SESSION_COOKIE = "slot_alert_session";

export async function POST(request: NextRequest) {
	const origin = request.headers.get("origin");
	if (origin && origin !== request.nextUrl.origin)
		return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });

	let body: { project?: unknown; teamId?: unknown };
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
	}

	const config = parseSlotConfig(body.project, body.teamId);
	if (!config)
		return NextResponse.json({ error: "Enter a valid project and Team ID." }, { status: 400 });

	const cookieStore = await cookies();
	const session = getSession(cookieStore.get(SESSION_COOKIE)?.value);
	if (!session)
		return NextResponse.json({ error: "Connect your 42 session first." }, { status: 401 });

	try {
		const result = await checkSlots(session.token, config);
		updateSessionConfig(session, config);
		updateKnownSlotIds(session, result.slotIds);
		markChecked(session);
		addSessionActivity(session, "Project configuration updated", `${config.project} · Team #${config.teamId}`, "success",);
		return NextResponse.json({
			...result,
			project: config.project,
			teamId: config.teamId,
			activities: session.activities,
		});
	} catch (error) {
		const message = error instanceof SlotError ? error.message : "Could not save this configuration.";
		const status = error instanceof SlotError ? error.status : 502;
		return NextResponse.json({ error: message }, { status });
	}
}
