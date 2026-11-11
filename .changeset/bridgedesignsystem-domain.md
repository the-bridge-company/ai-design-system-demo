---
"@bridge-ds/docs-site": patch
"@bridge-ds/mcp": patch
"@bridge-ds/core": patch
"@bridge-ds/figma-plugin": patch
"@bridge-ds/toolbar": patch
---

Bridge moves to https://bridgedesignsystem.com. Pages on bridge.floriangouloubi.com redirect there permanently, with the same path and query. The API, the Claude connector (/mcp, OAuth, its metadata), the GitHub webhook, a GitHub sign-in already on its way and files such as tokens.css keep answering on the old address, so connectors, Figma plugins and toolbars installed with it keep working. A Claude connector added with the old address keeps its issuer; the person signs in on the new address. The Figma plugin may reach both addresses. The MCP server, the toolbar's read proxy, docs links and templates name the new address.
