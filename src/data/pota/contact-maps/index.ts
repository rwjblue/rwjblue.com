const contactMaps = import.meta.glob("./*.json", {
  eager: true,
  import: "default",
});

const CONTACT_MAPS = Object.fromEntries(
  Object.entries(contactMaps).map(([path, map]) => {
    const repoPath = `src/data/pota/contact-maps/${path.slice(2)}`;
    return [repoPath, map];
  }),
);

export function contactMapForPath(contactMapPath?: string) {
  if (!contactMapPath) {
    return undefined;
  }

  return CONTACT_MAPS[contactMapPath as keyof typeof CONTACT_MAPS];
}

export function contactMapForNote(note: { data: { contactMap?: string } }) {
  return contactMapForPath(note.data.contactMap);
}
