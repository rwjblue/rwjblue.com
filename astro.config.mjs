import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import { createSitemapFilter } from "./scripts/sitemap-filter.mjs";

export default defineConfig({
  site: "https://rwjblue.com",
  integrations: [
    sitemap({
      filter: createSitemapFilter(),
    }),
  ],
});
