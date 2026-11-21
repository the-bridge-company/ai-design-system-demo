---
'@bridge-ds/mcp': minor
'@bridge-ds/docs-site': patch
---

The hosted Bridge connector keeps the repository's files by commit between calls. A call on an unchanged repository now reads one thing live, the branch's commit, with the person's own access, instead of the tree, the config and every token file again. A push is a new commit, so the next call reads the new files. For a member signed in by email, a warm call went from about 120 to about 7 storage commands and from 30 to 1 GitHub read once the proxy's short cache has expired. `BridgeContext.create` takes a new `snapshots` option (`SnapshotCache`, `sharedSnapshots`); without it, nothing changes.
