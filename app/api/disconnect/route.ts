import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { deleteSession } from "@/lib/server_session";

const SESSION_COOKIE = "slot_alert_session";

export async function POST(request: NextRequest) {
	const origin = request.headers.get("origin");
	if (origin && origin !== request.nextUrl.origin)
		return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });

	const cookieStore = await cookies();
	deleteSession(cookieStore.get(SESSION_COOKIE)?.value);
	const response = NextResponse.json({ disconnected: true });
	response.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
	return response;
}
