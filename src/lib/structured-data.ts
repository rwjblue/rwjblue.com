export const SITE_URL = "https://rwjblue.com";

export interface BreadcrumbItem {
  name: string;
  path: string;
}

export const absoluteSiteUrl = (path: string) =>
  new URL(path, SITE_URL).toString();

export const personStructuredData = {
  "@context": "https://schema.org",
  "@type": "Person",
  "@id": `${SITE_URL}/about/#person`,
  name: "Robert Jackson",
  alternateName: ["rwjblue", "N1RWJ"],
  url: `${SITE_URL}/about/`,
  sameAs: [
    "https://github.com/rwjblue",
    "https://www.qrz.com/db/N1RWJ",
    "https://bsky.app/profile/rwjblue.com",
    "https://mstdn.social/@rwjblue",
  ],
};

export const breadcrumbStructuredData = (items: BreadcrumbItem[]) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((item, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: item.name,
    item: absoluteSiteUrl(item.path),
  })),
});

export const articleStructuredData = ({
  title,
  description,
  path,
  published,
  image,
}: {
  title: string;
  description: string;
  path: string;
  published: Date;
  image?: string;
}) => ({
  "@context": "https://schema.org",
  "@type": "Article",
  headline: title,
  description,
  datePublished: published.toISOString(),
  dateModified: published.toISOString(),
  mainEntityOfPage: absoluteSiteUrl(path),
  url: absoluteSiteUrl(path),
  ...(image ? { image: absoluteSiteUrl(image) } : {}),
  author: {
    "@id": personStructuredData["@id"],
  },
  publisher: {
    "@id": personStructuredData["@id"],
  },
});
