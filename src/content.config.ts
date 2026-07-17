import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const notes = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/notes" }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    summary: z.string(),
    shareImage: z.string().optional(),
    shareImageHero: z.string().optional(),
    contactMap: z.string().optional(),
    boundaryMap: z
      .object({
        title: z.string(),
        subtitle: z.string().optional(),
        geoJson: z.string(),
        sourceLabel: z.string().optional(),
        sourceUrl: z.string().url().optional(),
      })
      .optional(),
    tags: z.array(z.string()).default([]),
  }),
});

const projects = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/projects" }),
  schema: z.object({
    title: z.string(),
    status: z.enum(["active", "historical", "experiment", "quiet"]),
    updated: z.coerce.date(),
    summary: z.string(),
    tags: z.array(z.string()).default([]),
  }),
});

export const collections = { notes, projects };
