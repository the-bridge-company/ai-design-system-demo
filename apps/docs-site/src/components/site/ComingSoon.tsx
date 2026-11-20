// The screen of a section that is not open yet (lib/nav.ts NavEntry.soon, owner 2026-11-20): anyone who has the
// address of a Patterns page, in the Library or in Studio, sees this instead of the page. One sentence, one way on.
// Rendered on the server only (no client directive): static markup.
import { Hand } from 'lucide-react';
import { EmptyState } from '@bridge-ds/react';
import ButtonLink from '../ds/ButtonLink';
import { studioHref } from '../../lib/team-path';

export function ComingSoon({ studio }: { studio: boolean }) {
  return (
    <section className="coming-soon">
      <EmptyState
        icon={Hand}
        title="Patterns are coming soon"
        description="The interactions and actions your components share, in one place. Until then, each component's page says how it behaves."
        headingLevel={2}
        actions={
          <ButtonLink variant="primary" href={studio ? studioHref('components/') : '/components/'}>
            Open Components
          </ButtonLink>
        }
      />
    </section>
  );
}
