export const formatDate = (date: Date, month: "short" | "long" = "short") =>
  date.toLocaleDateString("en-US", {
    month,
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

const PARK_REF_RE = /^[a-z]{2}-\d+$/i;

export const displayTags = (tags: string[]) =>
  tags.filter((t) => !PARK_REF_RE.test(t));
