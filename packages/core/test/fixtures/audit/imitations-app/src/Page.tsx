import { Button, Link } from '@bridge-ds/react';

export function Page({ count }: { count: number }) {
  return (
    <div>
      <nav className="page-tabs" role="tablist" aria-label="Sections">
        <Link role="tab" href="#usage" aria-selected="true">
          Usage
        </Link>
      </nav>
      {/* bridge-audit-ignore-next-line: vertical step tabs, a Tabs "steps" appearance is requested */}
      <div role="tablist" aria-orientation="vertical" />
      {/* bridge-audit-ignore-next-line */}
      <div role="tabpanel" id="usage" />
      <span className="nav-count">{count}</span>
      <Button>Save</Button>
    </div>
  );
}
