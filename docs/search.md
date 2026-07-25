# Site Search

The search page uses the static Pagefind index. Searchable pages declare one of
the public content types `Note`, `Project`, `Radio guide`, or `Tool`; public
note and project tags remain Pagefind tag filters. Listing, draft, unlisted, and
generated utility pages remain outside the index.

The `q`, repeatable `type`, and single `tag` URL parameters are the shareable
search state. Multiple content types use Pagefind's `any` compound filter while
the selected tag combines with them using the default `all` behavior.

Pressing `/` from ordinary page content opens search and focuses its query
field. The shortcut ignores input, textarea, select, contenteditable, modified,
and already-handled key events.
