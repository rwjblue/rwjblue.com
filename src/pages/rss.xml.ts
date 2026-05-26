import rss from "@astrojs/rss";
import { getCollection, type CollectionEntry } from "astro:content";
import MarkdownIt from "markdown-it";
import sanitizeHtml from "sanitize-html";

const FEED_SITE = "https://rwjblue.com";
const RADIO_SITE = "https://n1rwj.com";
const FEED_TITLE = "Robert Jackson / Notes";
const FEED_DESCRIPTION =
  "Field logs, software observations, radio updates, and site notes from Robert Jackson.";

const parser = new MarkdownIt({
  html: false,
  linkify: true,
});

type NoteEntry = CollectionEntry<"notes">;

const canonicalHostForNote = (note: NoteEntry) =>
  note.data.tags.includes("radio") ? RADIO_SITE : FEED_SITE;

const canonicalUrlForNote = (note: NoteEntry) =>
  `${canonicalHostForNote(note)}/notes/${note.id}/`;

const absoluteAttribute = (value: string | undefined, baseUrl: string) => {
  if (!value) {
    return value;
  }

  return new URL(value, baseUrl).toString();
};

const renderContent = (note: NoteEntry) => {
  const noteUrl = canonicalUrlForNote(note);

  return sanitizeHtml(parser.render(note.body), {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "title", "width", "height"],
    },
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          href: absoluteAttribute(attribs.href, noteUrl),
        },
      }),
      img: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          src: absoluteAttribute(attribs.src, noteUrl),
        },
      }),
    },
  });
};

export async function GET() {
  const notes = (await getCollection("notes")).sort(
    (a, b) => b.data.date.valueOf() - a.data.date.valueOf(),
  );

  return rss({
    title: FEED_TITLE,
    description: FEED_DESCRIPTION,
    site: FEED_SITE,
    items: notes.map((note) => {
      const noteUrl = canonicalUrlForNote(note);

      return {
        title: note.data.title,
        description: note.data.summary,
        pubDate: note.data.date,
        categories: note.data.tags,
        link: noteUrl,
        guid: noteUrl,
        content: renderContent(note),
      };
    }),
  });
}
