---
'@bridge-ds/docs-site': patch
---

Studio for an email member: the GitHub reads a page sends at one moment now go to Bridge in one request (`GET /api/contribute?repo=<team>&read=...&read=...`) instead of one request each. One member check, one counter round trip and one MGET for the whole batch: about 4 requests per Studio load instead of 22, and 2 to 5 times fewer Redis commands (docs/QUOTA-LOADTEST.md). Same answers, same cache and limits; members signed in with GitHub are unchanged.
