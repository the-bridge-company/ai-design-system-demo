// A count next to a label ("Exploring 2", "Waiting on you 2"): the DS Badge count appearance (the same as Library
// review's group counts), small, in tabular figures, so
// it reads as a count and not as a word glued to the label. The heading it sits in centers it on its line
// (styles/ds-studio.css .count-tag and :has(> .count-tag)).
import { Badge } from '@bridge-ds/react';

export function CountTag({ n, label }: { n: number; label?: string }) {
  return (
    <Badge appearance="count" size="sm" className="count-tag" aria-label={label}>
      {n}
    </Badge>
  );
}
