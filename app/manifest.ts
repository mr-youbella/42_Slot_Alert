import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
	return {
		name: "42 Slot Alert",
		short_name: "42 Slot Alert",
		description: "Never miss a 42 evaluation slot.",
		start_url: "/",
		display: "standalone",
		background_color: "#090d10",
		theme_color: "#090d10",
		icons: [
			{
				src: "/images/logo.png",
				sizes: "1600x1600",
				type: "image/png",
			},
		],
	};
}
