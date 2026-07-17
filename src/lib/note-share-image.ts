import type { CollectionEntry } from "astro:content";
import sharp from "sharp";

const WIDTH = 1200;
const HEIGHT = 630;

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function wrapText(value: string, maxCharacters: number, maxLines: number) {
  const words = value.trim().split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;

    if (candidate.length <= maxCharacters || !current) {
      current = candidate;
      continue;
    }

    lines.push(current);
    current = word;

    if (lines.length === maxLines - 1) {
      break;
    }
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  }

  const consumed = lines.join(" ").split(/\s+/).length;
  if (consumed < words.length) {
    lines[lines.length - 1] = `${lines.at(-1)?.replace(/[.,;:!?]?$/, "")}…`;
  }

  return lines;
}

function textLines(
  lines: string[],
  x: number,
  startY: number,
  lineHeight: number,
  className: string,
) {
  return lines
    .map(
      (line, index) =>
        `<text x="${x}" y="${startY + index * lineHeight}" class="${className}">${escapeXml(line)}</text>`,
    )
    .join("");
}

export async function renderNoteShareImage(note: CollectionEntry<"notes">) {
  const formattedDate = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(note.data.date);
  const titleLines = wrapText(note.data.title, 27, 3);
  const summaryLines = wrapText(note.data.summary, 58, 3);
  const titleStartY = titleLines.length === 1 ? 246 : titleLines.length === 2 ? 218 : 186;
  const summaryStartY = titleStartY + titleLines.length * 72 + 34;
  const tags = note.data.tags.slice(0, 4).join(" · ").toUpperCase();

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
      <style>
        .brand { font: 800 17px ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: 1.4px; }
        .eyebrow { font: 800 17px ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: 1.6px; fill: #2f6f4e; }
        .title { font: 800 58px Inter, ui-sans-serif, system-ui, sans-serif; fill: #172026; }
        .summary { font: 400 22px Inter, ui-sans-serif, system-ui, sans-serif; fill: #5f6f79; }
        .meta { font: 700 15px ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: 1px; fill: #5f6f79; }
      </style>
      <rect width="1200" height="630" fill="#f7f4ee" />
      <rect x="0" y="0" width="18" height="630" fill="#2f6f4e" />
      <rect x="844" y="0" width="356" height="630" fill="#172026" />
      <path d="M874 118 H1170 M874 198 H1110 M934 278 H1170 M874 358 H1110 M934 438 H1170 M874 518 H1170" stroke="#60736a" stroke-width="2" opacity="0.55" />
      <path d="M894 118 V358 M1010 198 V518 M1134 118 V438" stroke="#60736a" stroke-width="2" opacity="0.45" />
      <circle cx="894" cy="118" r="12" fill="#d98c4a" />
      <circle cx="1134" cy="118" r="9" fill="#f7f4ee" />
      <circle cx="1010" cy="198" r="13" fill="#78b494" />
      <circle cx="894" cy="358" r="9" fill="#f7f4ee" />
      <circle cx="1010" cy="518" r="12" fill="#d98c4a" />
      <circle cx="1134" cy="438" r="13" fill="#78b494" />
      <circle cx="934" cy="278" r="7" fill="#f7f4ee" />
      <circle cx="1170" cy="278" r="7" fill="#d98c4a" />

      <text x="62" y="70" class="brand" fill="#172026">RWJBLUE / N1RWJ</text>
      <text x="62" y="130" class="eyebrow">NOTE · ${escapeXml(formattedDate.toUpperCase())}</text>
      ${textLines(titleLines, 62, titleStartY, 72, "title")}
      ${textLines(summaryLines, 62, summaryStartY, 31, "summary")}
      <line x1="62" y1="558" x2="796" y2="558" stroke="#c5ccc4" stroke-width="2" />
      <text x="62" y="592" class="meta">${escapeXml(tags || "NOTES")}</text>
      <text x="1138" y="592" text-anchor="end" class="brand" fill="#f7f4ee">RWJBLUE.COM</text>
    </svg>
  `;

  return sharp(Buffer.from(svg)).png().toBuffer();
}
