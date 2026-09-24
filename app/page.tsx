"use client";
import { useCallback, useEffect, useRef, useState } from "react";

type ApiResult = {
	availableSlots?: number;
	slotIds?: string[];
	connected?: boolean;
	error?: string;
	project?: string;
	teamId?: string;
};

const events = [
	["Checked for available slots", "No availability", "12 sec ago", "bg-slate-500"],
	["Monitoring enabled", "Automatic checks every 60 sec", "4 min ago", "bg-blue-400"],
	["Alert preferences updated", "Browser notifications on", "8 min ago", "bg-blue-400"],
	["Checked for available slots", "No availability", "9 min ago", "bg-slate-500"],
];

function Toggle({ on, click, label }: { on: boolean; click: () => void; label: string }) {
	return (
		<button
			role="switch"
			aria-checked={on}
			aria-label={label}
			onClick={click}
			className={`relative h-7 w-12 shrink-0 overflow-hidden rounded-full border-0 p-0 outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-[#6ea8fe] focus-visible:ring-offset-2 focus-visible:ring-offset-[#11161c] ${on ? "bg-[#31d17c]" : "bg-[#3a4451]"}`}
		>
			<span
				className={`absolute inset-y-1 left-1 size-5 rounded-full bg-[#f8fafc] shadow-[0_1px_2px_rgba(0,0,0,0.28)] transition-transform duration-200 ${on ? "translate-x-5" : "translate-x-0"}`}
			/>
		</button>
	);
}

function CardTitle({ icon, title, text }: { icon: string; title: string; text: string }) {
	return (
		<div className="flex justify-between border-b border-[#252d36] px-5 py-5 sm:px-6">
			<div className="flex gap-3">
				<span className="grid size-9 place-items-center rounded-xl border border-[#2b3440] bg-[#181e26] text-[#9facc0]">
					{icon}
				</span>
				<div>
					<h2 className="text-sm font-semibold">{title}</h2>
					<p className="mt-1 text-xs text-[#738096]">{text}</p>
				</div>
			</div>
			<span className="text-[#77859a]">•••</span>
		</div>
	);
}

export default function Home() {
	const [monitoring, setMonitoring] = useState(true);
	const [sound, setSound] = useState(true);
	const [notifications, setNotifications] = useState(false);
	const [interval, setIntervalValue] = useState("60 sec");
	const [project, setProject] = useState("");
	const [team, setTeam] = useState("");
	const [projectLink, setProjectLink] = useState("");
	const [linkError, setLinkError] = useState("");
	const [sessionToken, setSessionToken] = useState("");
	const [showToken, setShowToken] = useState(false);
	const [showCookieHelp, setShowCookieHelp] = useState(false);
	const [connected, setConnected] = useState(false);
	const [availableSlots, setAvailableSlots] = useState(0);
	const lastKnownSlotIds = useRef(new Set<string>());
	const [connectionError, setConnectionError] = useState("");
	const [reCheckError, setReCheckError] = useState("");
	const [isChecking, setIsChecking] = useState(false);
	const [ago, setAgo] = useState(12);
	const [toast, setToast] = useState(false);
	const [saved, setSaved] = useState(false);
	const intervalSeconds = interval === "30 sec" ? 30 : interval === "2 min" ? 120 : 60;

	useEffect(() => {
		const id = setInterval(() => setAgo((n) => n + 1), 1000);
		return () => clearInterval(id);
	}, []);

	useEffect(() => {
		async function restoreConnection() {
			try {
				const response = await fetch("/api/session", { cache: "no-store" });
				const data = (await response.json()) as ApiResult;

				if (!response.ok || !data.connected)
					return;

				setConnected(true);
				if (data.project)
					setProject(data.project);
				if (data.teamId)
					setTeam(data.teamId);
			} catch { }
		};

		restoreConnection();
	}, []);

	const playAlertSound = useCallback(async () => {
		if (!sound)
			return;

		try {
			const audio = new Audio("/sounds/alert_sound.mp3");
			audio.volume = 0.5;
			await audio.play();
		} catch (error) {
			console.error("Could not play alert sound:", error);
		}
	}, [sound]);

	const requestStatus = useCallback(async () => {
		setIsChecking(true);
		setReCheckError("");

		try {
			const response = await fetch("/api/status", { cache: "no-store" });
			const data = (await response.json()) as ApiResult;

			if (!response.ok)
				throw new Error(data.error ?? "Could not check 42.");

			const nextSlotCount = data.availableSlots ?? 0;
			const nextSlotIds = data.slotIds ?? [];
			const hasNewAvailability = nextSlotIds.some((id) => !lastKnownSlotIds.current.has(id),);
			setAvailableSlots(nextSlotCount);
			lastKnownSlotIds.current = new Set(nextSlotIds);
			setAgo(0);
			if (hasNewAvailability) {
				setToast(true);
				playAlertSound();

				if (notifications && "Notification" in window && Notification.permission === "granted")
					new Notification("42 Slot Alert", { body: `${nextSlotCount} evaluation slot(s) are available for ${project}.`, });
			}
		} catch (error) {
			setReCheckError(error instanceof Error ? error.message : "Could not check 42.");
		} finally {
			setIsChecking(false);
		}
	}, [notifications, playAlertSound, project]);

	function checkNow() {
		if (!connected) {
			setConnectionError("Connect your 42 session before checking slots.");
			setReCheckError("Connect your 42 session before checking slots.");
			return;
		}

		void requestStatus();
	};

	async function connectTo42() {
		setIsChecking(true);
		setConnectionError("");
		setReCheckError("");

		try {
			const response = await fetch("/api/connect", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ token: sessionToken, project, teamId: team }),
			});
			const data = (await response.json()) as ApiResult;

			if (!response.ok)
				throw new Error(data.error ?? "Could not connect to 42.");

			setSessionToken("");
			setConnected(true);
			setAvailableSlots(data.availableSlots ?? 0);
			lastKnownSlotIds.current = new Set(data.slotIds ?? []);
			setAgo(0);
		} catch (error) {
			setConnected(false);
			setConnectionError(error instanceof Error ? error.message : "Could not connect to 42.");
		} finally {
			setIsChecking(false);
		}
	};

	async function disconnect42() {
		setIsChecking(true);
		setConnectionError("");

		try {
			const response = await fetch("/api/disconnect", { method: "POST" });
			if (!response.ok)
				throw new Error("Could not disconnect. Try again.");

			setConnected(false);
			setAvailableSlots(0);
			lastKnownSlotIds.current = new Set();
			setSessionToken("");
			setReCheckError("");
		} catch (error) {
			setConnectionError(
				error instanceof Error ? error.message : "Could not disconnect.",
			);
		} finally {
			setIsChecking(false);
		}
	}

	useEffect(() => {
		if (!connected || !monitoring)
			return;

		const id = window.setInterval(() => void requestStatus(), intervalSeconds * 1000);
		return () => window.clearInterval(id);
	}, [connected, intervalSeconds, monitoring, requestStatus]);

	async function save() {
		setConnectionError("");

		if (!connected) {
			setSaved(true);
			setTimeout(() => setSaved(false), 1800);
			return;
		}

		try {
			const response = await fetch("/api/config", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ project, teamId: team }),
			});
			const data = (await response.json()) as ApiResult;
			if (!response.ok)
				throw new Error(data.error ?? "Could not save this configuration.");

			setAvailableSlots(data.availableSlots ?? 0);
			lastKnownSlotIds.current = new Set(data.slotIds ?? []);
			setAgo(0);
			setSaved(true);
			setTimeout(() => setSaved(false), 1800);
		} catch (error) {
			setConnectionError(
				error instanceof Error ? error.message : "Could not save this configuration.",
			);
		}
	}

	async function toggleNotifications() {
		if (notifications) {
			setNotifications(false);
			return;
		}

		if (!("Notification" in window)) {
			setConnectionError("This browser does not support notifications.");
			return;
		}

		const permission = await Notification.requestPermission();
		setNotifications(permission === "granted");

		if (permission !== "granted")
			setConnectionError("Notification permission was not granted.");
	}

	function updateProjectFromLink(value: string) {
		setProjectLink(value);
		setLinkError("");

		if (!value.trim())
			return;

		try {
			const url = new URL(value);
			const projectMatch = url.pathname.match(/^\/projects\/([^/]+)\/slots(?:\.json)?\/?$/,);
			const nextTeamId = url.searchParams.get("team_id");

			if (url.protocol !== "https:" || url.hostname !== "projects.intra.42.fr" || !projectMatch || !nextTeamId) {
				setLinkError("Paste a 42 slots link that includes both the project and team_id.",);
				return;
			}

			setProject(decodeURIComponent(projectMatch[1]));
			setTeam(nextTeamId);
		} catch {
			setLinkError("That does not look like a valid 42 slots link.");
		}
	};

	function control(label: string, description: string, value: boolean, action: () => void, icon = "") {
		return (
			<div className="flex items-center justify-between gap-5 px-5 py-4 sm:px-6">
				<div>
					<p className="text-sm font-medium text-slate-200">
						{icon} {label}
					</p>
					{description && (
						<p className="mt-1 text-xs text-[#738096]">{description}</p>
					)}
				</div>
				<Toggle on={value} click={action} label={label} />
			</div>
		);
	};

	return (
		<main className="min-h-screen bg-[#090d10] text-[#eef2f7]">
			<nav className="border-b border-[#202731] bg-[#0b0f12]">
				<div className="mx-auto flex h-17.25 max-w-330 items-center justify-between px-5 sm:px-8">
					<div className="flex items-center gap-3">
						<span className="grid size-9 place-items-center rounded-[11px] bg-slate-100 text-lg text-[#11161b]">
							⌑
						</span>
						<b className="text-sm">42 Slot Alert</b>
						<span
							className={`hidden items-center gap-2 rounded-full border px-3 py-1 text-xs sm:flex ${monitoring ? "border-emerald-400/15 bg-emerald-400/[.07] text-emerald-300" : "border-slate-700 text-slate-400"}`}
						>
							<i
								className={`size-1.5 rounded-full ${monitoring ? "bg-emerald-400 shadow-[0_0_8px_#31d17c]" : "bg-slate-500"}`}
							/>
							{monitoring ? "Monitoring active" : "Monitoring paused"}
						</span>
					</div>
					<div className="flex items-center gap-3 text-[#91a0b4]">
						<button aria-label="Notifications" className="relative">
							♧
							<i className="absolute -right-1 -top-1 size-1.5 rounded-full bg-emerald-400" />
						</button>
						<button aria-label="Settings">⚙</button>
						<span className="grid size-9 place-items-center rounded-full border border-[#2b3440] bg-[#151b22] text-xs">
							42
						</span>
					</div>
				</div>
			</nav>
			<div className="mx-auto max-w-330 px-5 py-10 sm:px-8 sm:py-12">
				<section className="mb-9 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
					<div>
						<p className="mb-2 text-xs uppercase tracking-[.14em] text-[#6c7b90]">
							Overview
						</p>
						<h1 className="text-[27px] font-semibold tracking-[-.04em]">
							Evaluation monitoring
						</h1>
					</div>
					<p className="text-xs text-[#738096]">
						◷ &nbsp; Next check in {monitoring ? Math.max(0, intervalSeconds - ago) : "paused"}{" "}
						seconds
					</p>
				</section>
				<section className="overflow-hidden rounded-2xl border border-[#252e38] bg-[#11161c]">
					<div className="flex flex-col justify-between gap-8 px-6 py-8 sm:px-8 md:flex-row md:items-center md:py-9">
						<div>
							<div className="mb-6 flex gap-3 text-xs text-[#8e9bad]">
								<code className="rounded-md border border-[#2b3540] bg-[#181e26] px-2.5 py-1">
									{project || "project"}
								</code>
								<span>Team #{team || "—"}</span>
							</div>
							<div className="flex items-center gap-3">
								<i className="size-2.5 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(49,209,124,.12),0_0_10px_#31d17c]" />
								<h2 className="text-2xl font-semibold tracking-[-.04em] sm:text-[29px]">
									{availableSlots > 0 ? "Slots available now" : "No slots available right now"}
								</h2>
							</div>
							<p className="mt-2.5 text-sm text-[#8b98aa]">
								We are checking automatically every {interval}.
							</p>
							<p className="mt-7 text-xs text-[#718096]">
								● &nbsp; Last checked{" "}
								{ago === 0 ? "just now" : ago + " sec ago"}
							</p>
						</div>
						<div className="min-w-44.5 border-t border-[#252e38] pt-6 md:border-l md:border-t-0 md:pl-12 md:pt-0">
							<p className="text-sm text-[#909caf]">
								Available slots
							</p>
							<p className="mt-1 text-5xl font-semibold tracking-[-.07em]">
								{availableSlots}
							</p>
							<p className="mt-1 text-xs text-[#667388]">
								No openings detected
							</p>
						</div>
					</div>
					<div className="flex flex-col gap-4 border-t border-[#252e38] px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
						<p className="text-xs text-[#8794a6]">
							<span className="text-emerald-400">♢</span>&nbsp;
							Credentials will be secured server-side
						</p>
						<button
							onClick={checkNow}
							className="w-fit rounded-lg border border-[#33404d] bg-[#141b22] px-3.5 py-2 text-xs hover:bg-[#1d2630]"
						>
							{isChecking ? "Checking…" : "↻ Check now"}
						</button>
					</div>
					{reCheckError && (
						<p
							role="alert"
							className="m-3 rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-200"
						>
							{reCheckError}
						</p>
					)}
				</section>
				<div className="mt-5 grid gap-5 lg:grid-cols-2">
					<section className="overflow-hidden rounded-2xl border border-[#252e38] bg-[#11161c]">
						<CardTitle
							icon="☷"
							title="Monitoring controls"
							text="Choose how often we check for new openings."
						/>
						<div className="divide-y divide-[#252d36]">
							<div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
								<div>
									<p className="text-sm font-medium">
										Check interval
									</p>
									<p className="mt-1 text-xs text-[#738096]">
										More frequent checks use more requests
									</p>
								</div>
								<div className="flex rounded-xl border border-[#2b3440] bg-[#181e26] p-1">
									{["30 sec", "60 sec", "2 min"].map((x) => (
										<button
											key={x}
											onClick={() => {
												setIntervalValue(x);
												setAgo(0);
											}}
											className={`rounded-lg px-3 py-1.5 text-xs ${interval === x ? "bg-[#37414f] text-white" : "text-[#788599]"}`}
										>
											{x}
										</button>
									))}
								</div>
							</div>
							{control("Play alert sound", "", sound, () => setSound(!sound), "♬",)}
							{control("Browser notifications", "", notifications, () => toggleNotifications(), "♧",)}
						</div>
					</section>
					<section className="overflow-hidden rounded-2xl border border-[#252e38] bg-[#11161c]">
						<CardTitle
							icon="◷"
							title="Recent activity"
							text="A record of your latest monitoring events."
						/>
						<ol className="space-y-5 px-5 py-6 sm:px-6">
							{events.map(([title, description, time, dot]) => (
								<li key={time} className="flex gap-3.5">
									<i
										className={`mt-1.5 size-2 shrink-0 rounded-full ${dot}`}
									/>
									<div className="flex flex-1 justify-between gap-3">
										<div>
											<p className="text-sm text-[#d3d9e1]">
												{title}
											</p>
											<p className="mt-1 text-xs text-[#718096]">
												{description}
											</p>
										</div>
										<time className="shrink-0 text-xs text-[#718096]">
											{time}
										</time>
									</div>
								</li>
							))}
						</ol>
					</section>
				</div>
				<section className="mt-5 overflow-hidden rounded-2xl border border-[#252e38] bg-[#11161c]">
					<CardTitle
						icon="⚙"
						title="Project configuration"
						text="The project and team we should monitor."
					/>
					<div className="grid gap-5 px-5 py-6 sm:grid-cols-2 sm:px-6">
						<label className="sm:col-span-2 text-xs text-[#9ba8b9]">
							42 project slots link
							<input
								value={projectLink}
								onChange={(e) => updateProjectFromLink(e.target.value)}
								type="url"
								autoComplete="off"
								spellCheck="false"
								placeholder="https://projects.intra.42.fr/projects/ft_irc/slots?team_id=7697544"
								className="mt-2 h-11 w-full rounded-lg border border-[#2d3743] bg-[#181e26] px-3.5 font-mono text-xs text-slate-100 outline-none placeholder:text-[#59677a] focus:border-[#6ea8fe]"
							/>
							{linkError ? (
								<p className="mt-2 text-xs text-rose-300">{linkError}</p>
							) : (
								<p className="mt-2 text-xs text-[#728096]">
									Paste your 42 link and we fill the project and Team ID
									automatically.
								</p>
							)}
						</label>
						<label className="text-xs text-[#9ba8b9]">
							Project
							<input
								value={project}
								onChange={(e) => setProject(e.target.value)}
								placeholder="ft_irc"
								className="mt-2 h-11 w-full rounded-lg border border-[#2d3743] bg-[#181e26] px-3.5 font-mono text-sm text-slate-100 outline-none focus:border-[#6ea8fe]"
							/>
						</label>
						<label className="text-xs text-[#9ba8b9]">
							Team ID
							<input
								value={team}
								onChange={(e) => setTeam(e.target.value)}
								placeholder="7697544"
								className="mt-2 h-11 w-full rounded-lg border border-[#2d3743] bg-[#181e26] px-3.5 font-mono text-sm text-slate-100 outline-none focus:border-[#6ea8fe]"
							/>
						</label>
					</div>
					<div className="flex flex-col gap-4 border-t border-[#252d36] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
						<p className="text-xs leading-5 text-[#728096]">
							ⓘ &nbsp; Session credentials are stored securely on the server and never shown in your browser.
						</p>
						<button
							onClick={save}
							className={`h-10 rounded-lg px-4 text-xs font-semibold ${saved ? "bg-emerald-400 text-[#062211]" : "bg-[#f3f5f7] text-[#15191e]"}`}
						>
							{saved ? "✓ Saved" : "Save changes"}
						</button>
					</div>
				</section>
				<section className="mt-5 overflow-hidden rounded-2xl border border-[#252e38] bg-[#11161c]">
					<CardTitle
						icon="♢"
						title="42 connection"
						text="Connect your 42 session to read slots for this project."
					/>
					<div className="px-5 py-6 sm:px-6">
						<div className="flex flex-col gap-3 sm:flex-row sm:items-end">
							<label className="flex-1 text-xs text-[#9ba8b9]">
								42 session cookie{" "}
								<span className="text-[#65748a]">
									(_intra_42_session_production)
								</span>
								<div className="relative mt-2">
									<input
										value={sessionToken}
										onChange={(e) => {
											setSessionToken(e.target.value);
											setConnected(false);
										}}
										type={showToken ? "text" : "password"}
										autoComplete="off"
										spellCheck="false"
										placeholder="Paste your session cookie value"
										className="h-11 w-full rounded-lg border border-[#2d3743] bg-[#181e26] py-2 pl-3.5 pr-16 font-mono text-sm text-slate-100 outline-none placeholder:text-[#59677a] focus:border-[#6ea8fe]"
									/>
									<button
										type="button"
										onClick={() => setShowToken(!showToken)}
										className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs text-[#91a0b4] hover:bg-[#252d36] hover:text-white"
									>
										{showToken ? "Hide" : "Show"}
									</button>
								</div>
							</label>
							<button
								type="button"
								onClick={() => {
									if (connected)
										disconnect42();
									else
										connectTo42();
								}}
								disabled={isChecking || (!connected && !sessionToken.trim())}
								className={`h-11 rounded-lg px-4 text-xs font-semibold transition ${connected ? "bg-emerald-400 text-[#062211]" : "bg-[#f3f5f7] text-[#15191e] hover:bg-white"}`}
							>
								{isChecking ? "Connecting…" : connected ? "Disconnect" : "Connect 42"}
							</button>
						</div>
						<div className="mt-4 flex flex-col gap-3 rounded-xl border border-[#27313b] bg-[#0d1217] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
							<p className="text-xs leading-5 text-[#8492a5]">
								Your session cookie is as sensitive as a password. Never share it or add it to GitHub.
							</p>
							<button
								type="button"
								onClick={() => setShowCookieHelp(!showCookieHelp)}
								className="w-fit text-xs font-medium text-[#79aefe] hover:text-[#b7d2ff]"
							>
								{showCookieHelp ? "Hide instructions" : "How do I find my cookie?"}{" "} ↗
							</button>
						</div>
						{showCookieHelp && (
							<div className="mt-3 rounded-xl border border-[#2a3540] bg-[#131a21] p-4 text-xs leading-6 text-[#9ba8b9]">
								<p className="font-semibold text-[#e5ebf2]">
									Find your own 42 session cookie
								</p>
								<ol className="mt-2 list-decimal space-y-1 pl-4">
									<li>
										Sign in to{" "}
										<span className="font-mono text-[#c8d7e9]">
											intra.42.fr
										</span>{" "}
										in your browser.
									</li>
									<li>
										Open browser developer tools, then go to Application / Storage → Cookies →{" "}
										<span className="font-mono text-[#c8d7e9]">
											https://profile.intra.42.fr/
										</span>
										.
									</li>
									<li>
										Copy only the value of{" "}
										<span className="font-mono text-[#c8d7e9]">
											_intra_42_session_production
										</span>{" "}
										and paste it above.
									</li>
								</ol>
								<p className="mt-2 text-amber-300/90">
									Treat this value like your password. Sign out of 42 to invalidate it if you ever share it by mistake.
								</p>
							</div>
						)}
						{connectionError && (
							<p
								role="alert"
								className="mt-3 rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-200"
							>
								{connectionError}
							</p>
						)}
					</div>
				</section>
				<footer className="mt-8 flex justify-between border-t border-[#202731] pt-5 text-xs text-[#647287]">
					<p>42 Slot Alert · Built for focused students</p>
					<a href="mailto:support@example.com">Need help? ↗</a>
				</footer>
			</div>
			{toast && (
				<aside className="fixed inset-x-4 bottom-4 z-10 sm:inset-x-auto sm:right-5 sm:w-90">
					<div className="rounded-xl border border-emerald-300/15 bg-[#102017] p-4 shadow-2xl shadow-black/40">
						<div className="flex gap-3">
							<span className="grid size-9 place-items-center rounded-lg bg-emerald-400/15 text-emerald-300">
								✧
							</span>
							<div className="flex-1">
								<div className="flex justify-between">
									<b className="text-sm">
										New evaluation slot found
									</b>
									<button
										onClick={() => setToast(false)}
										aria-label="Dismiss"
									>
										X
									</button>
								</div>
								<p className="mt-1 text-xs text-[#9caf9f]">
									A slot may be available for{" "}
									<code>{project || "ft_irc"}</code>.
								</p>
								<div className="mt-3 flex gap-3">
									<button
										onClick={() => setToast(false)}
										className="rounded-lg bg-emerald-400 px-3 py-1.5 text-xs font-semibold text-[#052212]"
									>
										View slot ↗
									</button>
									<button
										onClick={() => setToast(false)}
										className="text-xs text-[#98aa9b]"
									>
										Dismiss
									</button>
								</div>
							</div>
						</div>
					</div>
				</aside>
			)}
		</main>
	);

}
