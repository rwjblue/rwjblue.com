export interface SeriesPosition {
  slug: string;
  order: number;
}

export interface ChronologicalItem {
  date: Date;
  series?: SeriesPosition;
  id?: string;
  href?: string;
}

const stableKey = (item: ChronologicalItem) => item.id ?? item.href ?? "";

export const compareChronologicalItemsNewestFirst = (
  left: ChronologicalItem,
  right: ChronologicalItem,
) => {
  const dateComparison = right.date.valueOf() - left.date.valueOf();
  if (dateComparison !== 0) {
    return dateComparison;
  }

  if (
    left.series &&
    right.series &&
    left.series.slug === right.series.slug
  ) {
    const seriesComparison = right.series.order - left.series.order;
    if (seriesComparison !== 0) {
      return seriesComparison;
    }
  }

  return stableKey(right).localeCompare(stableKey(left));
};
