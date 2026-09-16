const escapeHtml = (text: string) => text.replace(/[&<>"']/g, character =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);

interface ScaleGroup { text: string; annotation?: string }
interface ScaleRow { groups: ScaleGroup[]; kind: "groups" | "phrases" | "prose" }
interface ScaleSection { title: string; rows: ScaleRow[] }

const sectionTitles = new Map([["warm up", "Warm-up"], ["warm-up", "Warm-up"], ["exercise", "Exercise"], ["drill", "Drill"]]);
const prosignSymbols: Record<string, string> = { DN: "/", SK: "*", AR: "+", BT: "=" };

/** Recover reading structure from the existing private, whitespace-flattened import. */
export function sendingScaleSections(text: string): ScaleSection[] {
  const sections: ScaleSection[] = [];
  let section: ScaleSection | undefined;
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  for (const [index, line] of lines.entries()) {
    const title = sectionTitles.get(line.toLowerCase());
    if (title) {
      section = { title, rows: [] };
      sections.push(section);
      continue;
    }
    // The introduction and trailing revision date aren't sending material.
    const endOfSection = index === lines.length - 1 || sectionTitles.has(lines[index + 1].toLowerCase());
    if (!section || (endOfSection && /^[A-Za-z]{3,9}\s*[-–—]\s*\d{4}$/.test(line))) continue;
    const upper = line.toUpperCase();
    const previous = section.rows.at(-1);
    const annotations = upper.match(/<[A-Z]+>/g);
    if (annotations && upper.replace(/<[A-Z]+>/g, "").trim() === "" && previous?.kind === "groups") {
      const targets = annotations.map(annotation => {
        const name = annotation.slice(1, -1);
        return { name, group: previous.groups.find(group => group.text === prosignSymbols[name]?.repeat(5)) };
      });
      if (targets.every(target => target.group)) {
        for (const { name, group } of targets) group!.annotation = name;
        continue;
      }
    }
    if (/^[\/,.?*+=\s]+$/.test(upper)) {
      // Each run stays together; whitespace separates runs, not their characters.
      const runs = upper.replace(/\s/g, "").match(/(.)\1*/g)!;
      section.rows.push({ kind: "groups", groups: runs.map(text => ({ text })) });
      continue;
    }
    // Restore separation between repeated phrases without embedding course text.
    const repeated = /^(.+?)(?:\s+\1)+$/.exec(upper);
    if (repeated && repeated[1].includes(" ")) {
      section.rows.push({ kind: "phrases", groups: Array.from({ length: upper.split(repeated[1]).length - 1 }, () => ({ text: repeated[1] })) });
      continue;
    }
    const words = upper.split(/\s+/);
    const grouped = words.every(word => /^[A-Z0-9]{5,6}$|^[\/,.?]$/.test(word));
    section.rows.push({ kind: grouped ? "groups" : "prose", groups: (grouped ? words : [upper]).map(text => ({ text })) });
  }
  return sections;
}

export function sendingReadingHtml(text: string, scales = false): string {
  const sections = scales ? sendingScaleSections(text) : [];
  if (!sections.length) return `<div class="training-sending-plain">${escapeHtml(text)}</div>`;
  return sections.map(section => `<section class="training-scale-section"><h3>${section.title}</h3>${section.rows.map(row =>
    `<div class="training-scale-row training-scale-${row.kind}">${row.groups.map(group =>
      `<span class="training-scale-group"><span>${escapeHtml(group.text)}</span>${group.annotation ? `<small class="training-scale-annotation" aria-label="Prosign ${group.annotation}">${group.annotation}</small>` : ""}</span>`).join(" ")}</div>`
  ).join("")}</section>`).join("");
}
