import type { MetadataRoute } from "next";

const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    "",
    "/features",
    "/pricing",
    "/about",
    "/contact",
    "/privacy",
    "/terms",
  ].map(
    (path) => ({
      url: `${base}${path}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: path === "" ? 1 : 0.7,
    })
  );
}
