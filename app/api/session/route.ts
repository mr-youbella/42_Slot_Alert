import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/server_session";

const SESSION_COOKIE = "slot_alert_session";

export async function GET() {
	const cookieStore = await cookies();
	let session;

	try {
		session = await getSession(cookieStore.get(SESSION_COOKIE)?.value);
	} catch {
		return NextResponse.json({ error: "Session storage is temporarily unavailable." }, { status: 503 });
	}

	if (!session)
		return NextResponse.json({ connected: false }, { status: 401 });

	return NextResponse.json({
		connected: true,
		project: session.config.project,
		teamId: session.config.teamId,
		nextDaysLimit: session.config.nextDaysLimit,
		activities: session.activities,
	});
}
