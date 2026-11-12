---
"@bridge-ds/docs-site": patch
---

The sample team no longer depends on GitHub's live rate limit. Reads through Bridge answer what is kept whenever GitHub cannot be asked: a reader over their request budget, a team or reader over their GitHub calls, GitHub's limit or a GitHub outage all serve the last good answer (marked stale) instead of "Bridge is busy". Visitors of the sample team get kept answers at once while one function checks GitHub behind them (stale-while-revalidate, one call across functions). The team's product list falls back to the last one Bridge read. Studio keeps the team it opened when a read fails, never shows "Nothing needs you", "Nothing noted yet" or "Nothing in progress" from a failed read, and says quietly when part of a page could not be read. An open tab reloads once to the new version when a deploy removed the code it needed, and a token style rule a browser rejects no longer throws.
