---
"@bridge-ds/react": minor
"@bridge-ds/docs-site": patch
---

New Stepper: the steps of a flow as one path (numbered markers on a connecting line; done, current and upcoming states; vertical, or horizontal that stacks on narrow containers; aria-current="step"). SegmentedControl items take a `count`, shown in a count tag like Tabs and SidebarNav; the three share one count tag (neutral pill, stronger tone on the selected item). PopoverContent takes `initialFocus`. Craft fixes: Breadcrumb and Pagination items ignore a page's own list spacing (later crumbs sat 3px low), Kbd sm and Avatar xs text no longer go under 12px, SidebarNav rows use the 20px UI line height.

Library: the a11y check icons center on the first line, the component header groups its resources, the color specimens pass AA (pressed surface, overlay scrim, primitive ramp labels), counts sit in count tags (token types, component families), the duplicated component count is gone, the "Figma is ahead" line shows only to maintainers, Button usage reads without code. Home: an "Open the demo" button next to Get started, step numbers on the first line, the waiting review cards at a legible size, the Acme team's names in the mocks.
