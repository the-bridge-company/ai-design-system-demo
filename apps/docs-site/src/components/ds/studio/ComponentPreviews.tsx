// The library components a Studio page can preview in its thumbnails (lib/branch-thumb kind "component", drawn by
// BranchThumb with the Library's own stage, components/ds/library/ComponentStage). Given once per page through
// context, so every card of a component reads the same entry. Being built gives it:
//   - Bridge's own Studio: the components and their docs.json previews from the build (pages/studio/building.astro),
//     drawn in the browser by ClientExample, as Bridge's Library draws them with Example.
//   - A team's Studio: the team's model (scripts/team-data, the page's one memoized read) and its Storybook, https only;
//     a component previews with its first story the published Storybook lists, as the team's Library does.
import { createContext, useContext, useEffect, useState } from 'react';
import { stageComponent, stageSource, type StageComponent, type StageExample } from '../library/ComponentStage';
import { isHosted } from '../../../lib/team-path';

export interface ComponentPreviews {
  /** By the library's own spelling of the name. */
  components: Map<string, StageComponent>;
  storybook?: string | undefined;
  Example?: StageExample | undefined;
}

const Previews = createContext<ComponentPreviews | null>(null);
export const ComponentPreviewsProvider = Previews.Provider;
export const useComponentPreviews = () => useContext(Previews);

/** The names of the components that have a preview to show (lib/building-view rowThumb `previewed`). */
export function previewedNames(p: ComponentPreviews | null): string[] {
  if (!p) return [];
  return [...p.components.values()].filter((c) => stageSource(c, p.storybook, p.Example) !== null).map((c) => c.name);
}

/** Bridge's own components as the self-hosted page passes them from the build (name, docs.json preview, first story). */
export type SitePreviewList = StageComponent[];

/**
 * The page's previews: the list given by Bridge's own page, else the team's on a team address (read after the list,
 * never holding it up); null until read, and when they cannot be read (the thumbnails keep the component icon).
 */
export function useComponentPreviewsOf(site: SitePreviewList | undefined): ComponentPreviews | null {
  const [team, setTeam] = useState<ComponentPreviews | null>(null);
  const [own, setOwn] = useState<ComponentPreviews | null>(null);
  useEffect(() => {
    let live = true;
    if (site) {
      void import('./ClientExample').then((m) => live && setOwn({ components: new Map(site.map((c) => [c.name, c])), Example: m.default }));
    } else if (isHosted()) {
      void Promise.all([import('../../../scripts/team-data'), import('../../../lib/library/components'), import('../../../lib/team-components'), import('../../../lib/library/component-page'), import('../../../scripts/storybook-source')])
        .then(async ([data, lib, sb, page, source]) => {
          const d = await data.loadTeamData();
          const storybook = sb.httpsStorybook(d.storybook);
          // The published Storybook's index (one read, shared with the page): a story it does not list would play
          // Storybook's own error, so a component previews with the first story it lists. Unreadable: as written.
          const entries = storybook ? await source.loadStorybook(storybook).then((s) => s.index.entries, () => null) : null;
          if (!live) return;
          const components = lib.loadComponents(d.model).map((c) => {
            const stage = stageComponent(c);
            return entries ? { ...stage, storyId: page.firstListedStory(c, entries)?.id ?? null } : stage;
          });
          setTeam({ components: new Map(components.map((c) => [c.name, c])), storybook });
        })
        .catch(() => {});
    }
    return () => {
      live = false;
    };
  }, [site]);
  return own ?? team;
}
