import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
	title: "42 Slot Alert",
	description: "Monitor 42 evaluation slots in one focused dashboard.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
	return (
		<html
			lang="en"
			className="h-full antialiased"
		>
			<body className="min-h-full flex flex-col">{children}</body>
		</html>
	);
}
