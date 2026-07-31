import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import { createSitemapFilter } from "./scripts/sitemap-filter.mjs";

const redirectsFile = new URL("./public/_redirects", import.meta.url);
const redirectsPath = fileURLToPath(redirectsFile);

function readRedirects() {
  return new Map(
    readFileSync(redirectsFile, "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const [source, destination, status = "302"] = line.split(/\s+/);

        return [source, { destination, status: Number(status) }];
      }),
  );
}

function cloudflareRedirectsDev() {
  let redirects = readRedirects();

  return {
    name: "cloudflare-redirects",
    configureServer(server) {
      server.watcher.add(redirectsPath);
      server.watcher.on("change", (changedPath) => {
        if (changedPath === redirectsPath) redirects = readRedirects();
      });

      server.middlewares.use((request, response, next) => {
        const pathname = new URL(request.url, "http://localhost").pathname;
        const redirect = redirects.get(pathname);

        if (!redirect) return next();

        response.statusCode = redirect.status;
        response.setHeader("Location", redirect.destination);
        response.end();
      });
    },
  };
}

export default defineConfig({
  site: "https://rwjblue.com",
  integrations: [
    sitemap({
      filter: createSitemapFilter(),
    }),
  ],
  vite: {
    plugins: [cloudflareRedirectsDev()],
  },
});
