import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { checkSlots, parseSlotConfig, SlotError } from "@/lib/slots";
import {
	addSessionActivity,
	createSession,
	deleteSession,
	getSession,
	updateKnownSlotIds,
} from "@/lib/server-session";

const SESSION_COOKIE = "slot_alert_session";

function isSameOrigin(request: NextRequest) {
	const origin = request.headers.get("origin");
	return !origin || origin === request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
	if (!isSameOrigin(request))
		return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
	if (Number(request.headers.get("content-length") ?? 0) > 8_192)
		return NextResponse.json({ error: "Request is too large." }, { status: 413 });

	let body: { token?: unknown; project?: unknown; teamId?: unknown };
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
	}

	const config = parseSlotConfig(body.project, body.teamId);
	const token = typeof body.token === "string" ? body.token.trim() : "";
	if (!config)
		return NextResponse.json({ error: "Enter a valid project and Team ID." }, { status: 400 });
	if (token.length < 20 || token.length > 4096 || /[\u0000-\u001F]/.test(token))
		return NextResponse.json({ error: "Enter a valid 42 session cookie." }, { status: 400 });

	try {
		const result = await checkSlots(token, config);
		const cookieStore = await cookies();
		deleteSession(cookieStore.get(SESSION_COOKIE)?.value);
		const id = createSession(token, config);
		const session = getSession(id);

		if (!session)
			throw new Error("Could not create a session.");

		updateKnownSlotIds(session, result.slotIds);
		addSessionActivity(
			session,
			"Connected to 42",
			"Session verified and slot monitoring is ready.",
			"success",
		);
		const response = NextResponse.json({
			...result,
			connected: true,
			activities: session.activities,
			hasNewAvailability: false,
		});

		response.cookies.set(SESSION_COOKIE, id, {
			httpOnly: true,
			sameSite: "strict",
			secure: process.env.NODE_ENV === "production",
			path: "/",
			maxAge: 12 * 60 * 60,
		});

		return response;
	} catch (error) {
		const message = error instanceof SlotError ? error.message : "Could not connect to 42.";
		const status = error instanceof SlotError ? error.status : 502;
		return NextResponse.json({ error: message }, { status });
	}
}
