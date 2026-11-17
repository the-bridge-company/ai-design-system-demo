---
"@bridge-ds/core": minor
"@bridge-ds/docs-site": patch
"@bridge-ds/mcp": patch
---

Patterns: a "Used in" place can be in a product that lives in its own repository. Add `product` (a key of bridge.config.json `products`) to a `usedIn` entry and its `file` is read from that product's repository; without it, `file` stays relative to the design system repository. A key the config does not list is reported as a problem with the file, never dropped silently. The Library's Used in names the product ("Contacts, in CRM") and links each file to its repository on GitHub; `bridge_get_pattern` and llms.txt give agents the product's name and repository.
