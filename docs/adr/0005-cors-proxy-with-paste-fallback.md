# 5. Fetch article URLs via a public CORS proxy, paste as fallback

## Status

Accepted

## Context

One supported input is an article **URL**. A browser cannot fetch arbitrary third-party pages
directly because of the same-origin policy; the response lacks permissive CORS headers. With no
backend of our own (ADR-0001), we cannot proxy the request server-side ourselves.

Options: (a) stand up a small proxy server — rejected, breaks client-only; (b) use a public
CORS proxy; (c) drop URL input entirely and require pasting.

## Decision

Fetch URLs through a **public CORS proxy** at runtime, and always offer **paste the article
text** as a first-class fallback. Pasted text/HTML is parsed by the same readability heuristic
and works fully offline. The UI tells the user to paste if a fetch is blocked.

## Consequences

- **Positive:** URL input works for many sites with zero infrastructure on our side.
- **Positive:** The paste path guarantees the feature always works, regardless of CORS, proxy
  uptime, or network.
- **Negative:** Depends on a third-party proxy's availability, rate limits, and trust — it sees
  the requested URL and response. Not suitable for private/authenticated pages.
- **Negative:** Some sites block proxies or return non-article markup; extraction quality varies.
- **Mitigation:** URL fetch is an explicit button action (not auto-run on type, see ADR-0008) to
  avoid spamming the proxy while the user edits.
