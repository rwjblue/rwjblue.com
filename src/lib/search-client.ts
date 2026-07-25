interface PagefindResultData {
  url: string;
  plain_excerpt: string;
  meta: { title?: string };
}

interface PagefindResult {
  data: () => Promise<PagefindResultData>;
}

interface PagefindSearch {
  results: PagefindResult[];
}

interface PagefindApi {
  search: (
    query: string | null,
    options?: { filters?: Record<string, unknown> },
  ) => Promise<PagefindSearch | null>;
  init: () => Promise<void>;
}

export interface SearchState {
  query: string;
  types: string[];
  tag: string;
}

const PAGEFIND_BUNDLE = "/pagefind/pagefind.js";
const RESULT_LIMIT = 20;
let pagefindPromise: Promise<PagefindApi> | undefined;

export function parseSearchState(params: URLSearchParams): SearchState {
  return {
    query: params.get("q") ?? "",
    types: [...new Set(params.getAll("type").filter(Boolean))],
    tag: params.get("tag") ?? "",
  };
}

export function searchStateUrl(state: SearchState, current: URL): URL {
  const url = new URL(current);
  url.searchParams.delete("q");
  url.searchParams.delete("type");
  url.searchParams.delete("tag");
  url.searchParams.delete("focus");
  if (state.query) url.searchParams.set("q", state.query);
  for (const type of state.types) url.searchParams.append("type", type);
  if (state.tag) url.searchParams.set("tag", state.tag);
  return url;
}

export function pagefindFiltersFor(
  state: SearchState,
): Record<string, unknown> | undefined {
  const filters: Record<string, unknown> = {};
  if (state.types.length === 1) filters.type = state.types[0];
  if (state.types.length > 1) filters.type = { any: state.types };
  if (state.tag) filters.tag = state.tag;
  return Object.keys(filters).length > 0 ? filters : undefined;
}

const loadPagefind = () => {
  pagefindPromise ??= import(
    /* @vite-ignore */ PAGEFIND_BUNDLE
  ).then(async (module) => {
    const pagefind = module as PagefindApi;
    await pagefind.init();
    return pagefind;
  });
  return pagefindPromise;
};

const resultItem = (result: PagefindResultData) => {
  const item = document.createElement("li");
  const link = document.createElement("a");
  const excerpt = document.createElement("p");
  const path = document.createElement("span");
  link.href = result.url;
  link.textContent = result.meta.title ?? result.url;
  excerpt.textContent = result.plain_excerpt;
  path.textContent = new URL(result.url, window.location.origin).pathname;
  item.append(link, excerpt, path);
  return item;
};

export function initSearchPage() {
  const form = document.querySelector<HTMLFormElement>("[data-search-form]");
  const input = document.querySelector<HTMLInputElement>("[data-search-input]");
  const status = document.querySelector<HTMLElement>("[data-search-status]");
  const results = document.querySelector<HTMLOListElement>("[data-search-results]");
  const typeInputs = [
    ...document.querySelectorAll<HTMLInputElement>("[data-search-type]"),
  ];
  const tagSelect =
    document.querySelector<HTMLSelectElement>("[data-search-tag]");

  if (!form || !input || !status || !results || !tagSelect) return;

  let activeSearch = 0;
  let debounceTimer: number | undefined;

  const state = (): SearchState => ({
    query: input.value.trim(),
    types: typeInputs.filter((control) => control.checked).map((control) => control.value),
    tag: tagSelect.value,
  });

  const syncUrl = (searchState: SearchState) => {
    window.history.replaceState({}, "", searchStateUrl(searchState, new URL(window.location.href)));
  };

  const search = async (sync = true) => {
    const searchState = state();
    const searchId = ++activeSearch;
    if (sync) syncUrl(searchState);

    const hasFilters = searchState.types.length > 0 || Boolean(searchState.tag);
    if (!searchState.query && !hasFilters) {
      results.replaceChildren();
      status.textContent = "Enter a word or phrase, or choose a filter.";
      return;
    }

    const description = searchState.query
      ? `"${searchState.query}"`
      : "the selected filters";
    status.textContent = `Searching for ${description}...`;

    try {
      const pagefind = await loadPagefind();
      const response = await pagefind.search(searchState.query || null, {
        filters: pagefindFiltersFor(searchState),
      });
      if (!response || searchId !== activeSearch) return;

      const visibleResults = response.results.slice(0, RESULT_LIMIT);
      const resultData = await Promise.all(
        visibleResults.map((result) => result.data()),
      );
      if (searchId !== activeSearch) return;

      results.replaceChildren(...resultData.map(resultItem));
      const total = response.results.length;
      if (total === 0) {
        status.textContent = `No results for ${description}.`;
        return;
      }
      const shown = visibleResults.length;
      status.textContent =
        total > shown
          ? `${total} results for ${description}; showing the first ${shown}.`
          : `${total} ${total === 1 ? "result" : "results"} for ${description}.`;
    } catch (error) {
      console.error("Unable to load the static search index.", error);
      results.replaceChildren();
      status.textContent = "Search could not load. Refresh the page and try again.";
    }
  };

  const scheduleSearch = () => {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => void search(), 140);
  };

  input.addEventListener("focus", () => void loadPagefind(), { once: true });
  input.addEventListener("input", scheduleSearch);
  typeInputs.forEach((control) => control.addEventListener("change", () => void search()));
  tagSelect.addEventListener("change", () => void search());
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    window.clearTimeout(debounceTimer);
    void search();
  });

  const initial = parseSearchState(new URLSearchParams(window.location.search));
  input.value = initial.query;
  typeInputs.forEach((control) => {
    control.checked = initial.types.includes(control.value);
  });
  if ([...tagSelect.options].some((option) => option.value === initial.tag)) {
    tagSelect.value = initial.tag;
  }

  if (initial.query || initial.types.length > 0 || initial.tag) {
    void search(false);
  }
}
