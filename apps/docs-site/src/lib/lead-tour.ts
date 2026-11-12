// The lead's first-visit tour of the Studio home (StudioHome.tsx, HomeTour.tsx): three steps, each anchored where it
// points. The same for every team's lead, the sample team's included. Pure, covered by lead-tour.test.ts.

export type LeadTourAt = 'rows' | 'more' | 'branches';

const LEAD_TOUR: Record<LeadTourAt, { title: string; text: string }> = {
  rows: {
    title: 'Changes wait for your review',
    text: 'Each row is a change a teammate or Claude AI opened. Bridge shows it before and after, so you review the look, not the code.',
  },
  more: {
    title: 'The whole queue, one by one',
    text: 'Review all opens every change in turn: approve, ask for changes, and move on to the next.',
  },
  branches: {
    title: 'Explore with Claude AI',
    text: 'Each card is a product screen the team tries with Claude AI. Bridge spots what the library does not have yet, and the pieces worth keeping go to review.',
  },
};

/** One step's words. */
export const leadTour = (at: LeadTourAt): { title: string; text: string } => LEAD_TOUR[at];

/** The steps the page can point at, in order: the grouped row only when there is one. */
export function leadTourSteps(x: { rows: boolean; more: boolean; branches: boolean }): LeadTourAt[] {
  return (['rows', 'more', 'branches'] as const).filter((s) => x[s]);
}
