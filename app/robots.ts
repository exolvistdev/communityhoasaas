import type { MetadataRoute } from "next";

const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/features", "/pricing", "/about", "/contact", "/privacy"],
        disallow: [
          "/dashboard",
          "/portal",
          "/guard",
          "/platform",
          "/settings",
          "/account",
          "/api/",
          "/login",
          "/onboarding",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
