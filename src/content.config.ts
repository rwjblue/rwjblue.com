import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const notes = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/notes" }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    publishAt: z
      .string()
      .datetime({ offset: true })
      .transform((value) => new Date(value))
      .optional(),
    summary: z.string(),
    visibility: z.enum(["public", "unlisted", "draft"]).default("public"),
    shareImage: z.string().optional(),
    beaconMap: z.boolean().optional(),
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
    series: z
      .object({
        slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
        title: z.string().min(1),
        order: z.number().int().positive(),
      })
      .optional(),
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

const equipment = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/equipment" }),
  schema: z.object({
    name: z.string(),
    category: z.enum([
      "radios",
      "antennas",
      "keys",
      "station-accessories",
      "power",
      "supports",
      "test-equipment",
    ]),
    summary: z.string(),
    status: z.enum(["current", "incoming", "retired"]).default("current"),
    quantity: z.number().int().positive().default(1),
    state: z.string().optional(),
    useContexts: z
      .array(z.enum(["home", "portable"]))
      .default([]),
    connections: z
      .array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/))
      .default([]),
    sortOrder: z.number().int().nonnegative().default(100),
    externalUrl: z.string().url().optional(),
    dxEngineeringUrl: z.string().url().optional(),
    image: z.string().optional(),
    imageAlt: z.string().optional(),
    imageSourceName: z.string().optional(),
    imageSourceUrl: z.string().url().optional(),
  }),
});

export const collections = { notes, projects, equipment };
