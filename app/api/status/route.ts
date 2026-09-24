import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { checkSlots, SlotError } from "@/lib/slots";
import { getSession, markChecked, remainingCooldown } from "@/lib/server-session";

const SESSION_COOKIE = "slot_alert_session";

export async function GET() {
	const cookieStore = await cookies();
	const id = cookieStore.get(SESSION_COOKIE)?.value;
	const session = getSession(id);

	if (!session)
		return NextResponse.json({ error: "Connect your 42 session first." }, { status: 401 });

	const cooldown = remainingCooldown(session);
	if (cooldown)
	{
		return NextResponse.json(
			{ error: "Please wait before checking again.", retryAfterMs: cooldown },
			{ status: 429 },
		);
	}

	try {
		const result = await checkSlots(session.token, session.config);
		markChecked(session);
		return NextResponse.json({ ...result, project: session.config.project, teamId: session.config.teamId });
	} catch (error) {
		const message = error instanceof SlotError ? error.message : "Could not check 42.";
		const status = error instanceof SlotError ? error.status : 502;
		return NextResponse.json({ error: message }, { status });
	}
}
