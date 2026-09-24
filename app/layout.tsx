import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
	title: {
		default: "42 Slot Alert | Never miss a 42 evaluation slot",
		template: "%s | 42 Slot Alert",
	},
	description: "Monitor 42 evaluation slot availability, get sound and browser alerts, and never miss your next project evaluation.",
	applicationName: "42 Slot Alert",
	keywords: [
		"42 Slot Alert",
		"42 slots",
		"42 evaluation slots",
		"42 school",
		"42 intra",
		"42 project evaluation",
		"42 slot watcher",
	],
	icons: {
		icon: "/images/logo.png",
		apple: "/images/logo.png",
	},
	openGraph: {
		type: "website",
		siteName: "42 Slot Alert",
		title: "42 Slot Alert | Never miss a 42 evaluation slot",
		description: "Monitor 42 evaluation slot availability and get alerted when a new slot opens.",
		images: [
			{
				url: "/images/logo.png",
				width: 1600,
				height: 1600,
				alt: "42 Slot Alert logo",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: "42 Slot Alert",
		description: "Monitor 42 evaluation slot availability and get alerted when a new slot opens.",
		images: ["/images/logo.png"],
	},
	robots: {
		index: true,
		follow: true,
		googleBot: {
			index: true,
			follow: true,
			"max-image-preview": "large",
			"max-snippet": -1,
			"max-video-preview": -1,
		},
	},
	verification: {
		google: "rnlNX8zZkZDeOpPcLQEonRc0uYXRREWnZ2639zanKr8",
	},
};

export default function RootLayout({ children }: LayoutProps<"/">) {
	return (
		<html
			lang="en"
			className="h-full antialiased"
		>
			<body>{children}</body>
		</html>
	);
}
