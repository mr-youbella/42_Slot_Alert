import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { checkSlots, SlotError } from "@/lib/slots";
import { addSessionActivity, getNewSlotIds, getSession, markChecked, remainingCooldown, updateKnownSlotIds, } from "@/lib/server_session";

const SESSION_COOKIE = "slot_alert_session";

export async function GET() {
	const cookieStore = await cookies();
	const id = cookieStore.get(SESSION_COOKIE)?.value;
	const session = getSession(id);

	if (!session)
		return NextResponse.json({ error: "Connect your 42 session first." }, { status: 401 });

	const cooldown = remainingCooldown(session);
	if (cooldown) {
		return NextResponse.json(
			{ error: "Please wait before checking again.", retryAfterMs: cooldown },
			{ status: 429 },
		);
	}

	try {
		const result = await checkSlots(session.token, session.config);
		const newSlotIds = getNewSlotIds(session, result.slotIds);
		const hasNewAvailability = newSlotIds.length > 0;
		updateKnownSlotIds(session, result.slotIds);
		markChecked(session);
		addSessionActivity(
			session,
			hasNewAvailability ? "New evaluation slot found" : "Checked for available slots",
			result.availableSlots > 0 ? `${result.availableSlots} slot(s) available` : "No availability",
			hasNewAvailability ? "success" : "info",
		);
		return NextResponse.json({
			...result,
			project: session.config.project,
			teamId: session.config.teamId,
			hasNewAvailability,
			activities: session.activities,
		});
	} catch (error) {
		const message = error instanceof SlotError ? error.message : "Could not check 42.";
		const status = error instanceof SlotError ? error.status : 502;
		addSessionActivity(session, "Slot check failed", message, "error");
		return NextResponse.json(
			{ error: message, activities: session.activities },
			{ status },
		);
	}
}
