interface PagefindResultData {
  url: string;
  plain_excerpt: string;
  meta: {
    title?: string;
  };
}

interface PagefindResult {
  data: () => Promise<PagefindResultData>;
}

interface PagefindSearch {
  results: PagefindResult[];
}

interface PagefindApi {
  debouncedSearch: (
    query: string,
  ) => Promise<PagefindSearch | null>;
  init: () => Promise<void>;
}

const PAGEFIND_BUNDLE = "/pagefind/pagefind.js";
const RESULT_LIMIT = 20;

let pagefindPromise: Promise<PagefindApi> | undefined;

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

  if (!form || !input || !status || !results) {
    return;
  }

  let activeSearch = 0;

  const updateUrl = (query: string) => {
    const url = new URL(window.location.href);

    if (query) {
      url.searchParams.set("q", query);
    } else {
      url.searchParams.delete("q");
    }

    window.history.replaceState({}, "", url);
  };

  const search = async (rawQuery: string, syncUrl = true) => {
    const query = rawQuery.trim();
    const searchId = ++activeSearch;

    if (syncUrl) {
      updateUrl(query);
    }

    if (!query) {
      results.replaceChildren();
      status.textContent = "Enter a word or phrase to search the site.";
      return;
    }

    status.textContent = `Searching for "${query}"...`;

    try {
      const pagefind = await loadPagefind();
      const response = await pagefind.debouncedSearch(query);

      if (!response || searchId !== activeSearch) {
        return;
      }

      const visibleResults = response.results.slice(0, RESULT_LIMIT);
      const resultData = await Promise.all(
        visibleResults.map((result) => result.data()),
      );

      if (searchId !== activeSearch) {
        return;
      }

      results.replaceChildren(...resultData.map(resultItem));

      if (response.results.length === 0) {
        status.textContent = `No results for "${query}".`;
        return;
      }

      const shown = visibleResults.length;
      const total = response.results.length;
      status.textContent =
        total > shown
          ? `${total} results for "${query}"; showing the first ${shown}.`
          : `${total} ${total === 1 ? "result" : "results"} for "${query}".`;
    } catch (error) {
      console.error("Unable to load the static search index.", error);
      results.replaceChildren();
      status.textContent =
        "Search could not load. Refresh the page and try again.";
    }
  };

  input.addEventListener(
    "focus",
    () => {
      void loadPagefind();
    },
    { once: true },
  );

  input.addEventListener("input", () => {
    void search(input.value);
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void search(input.value);
  });

  const initialQuery = new URLSearchParams(window.location.search).get("q") ?? "";

  if (initialQuery) {
    input.value = initialQuery;
    void search(initialQuery, false);
  }
}
