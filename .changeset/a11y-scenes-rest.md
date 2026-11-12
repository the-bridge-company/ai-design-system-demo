---
"@bridge-ds/docs-site": patch
---

The Field Guide scenes rest within 5 seconds (WCAG 2.2.2, pause, stop, hide). The sign-in story plays on from the closed bridge and rests on it, with the cart crossing under the flag and "kept"; the Studio header scenes, Home's harbor and Quality's lighthouse breathe for a moment, then hold still. Reduced motion still never starts them. Tests: Testing Library waits up to 5 seconds for an island's first lazy load (the demo dialog took about 3 seconds cold), which made demo-gate and other first-open tests fail on a busy run.
