import type { MetadataRoute } from "next";

const routes = [
  "",
  "/about",
  "/services",
  "/access",
  "/care",
  "/connect",
  "/business",
  "/products",
  "/repairs",
  "/contact",
  "/insights",
  "/careers",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://swd.example";
  return routes.map((route) => ({
    url: `${base}${route}`,
    lastModified: new Date(),
  }));
}
