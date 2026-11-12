// Team Settings: shows one group at a time (lib/settings-sections.ts). The DS Tabs on top (SettingsTabs.tsx) pick the
// group and keep it in the address (#set-group-tools), so Back and a shared link land on the same group. An older
// anchor (#roles, #figma) opens its group and scrolls to the band once its island has drawn it.
import { DEFAULT_SETTINGS_GROUP, groupForHash, groupId, hashNamesBand, type SettingsGroupKey } from '../lib/settings-sections';

export interface SettingsSections {
  /** Shows the group, tells the tabs, and writes it to the address (a tab picked by the user). */
  select: (key: SettingsGroupKey) => void;
  /** Stops listening to the address. */
  dispose: () => void;
}

/**
 * Wires the group panels ([data-set-group]) to the address. `onShow` hears every group shown, from a tab or from the
 * address, so the tabs mark the same one. Shows the group the address names right away.
 */
export function initSettingsSections(onShow: (key: SettingsGroupKey) => void = () => {}, root: ParentNode = document): SettingsSections {
  const groups = [...root.querySelectorAll<HTMLElement>('[data-set-group]')];
  let waiting: number | null = null;

  const show = (key: SettingsGroupKey) => {
    for (const g of groups) g.hidden = g.dataset.setGroup !== key;
    onShow(key);
  };

  // A band drawn by an island after the team is read: wait for it (a few seconds at most), then scroll to it.
  const scrollToBand = (id: string) => {
    if (waiting !== null) window.clearInterval(waiting);
    let tries = 0;
    const tick = () => {
      const el = document.getElementById(id);
      if (el || ++tries > 40) {
        if (waiting !== null) window.clearInterval(waiting);
        waiting = null;
        el?.scrollIntoView({ block: 'start' });
      }
    };
    waiting = window.setInterval(tick, 125);
    tick();
  };

  const follow = (hash: string) => {
    show(groupForHash(hash));
    if (hashNamesBand(hash)) scrollToBand(hash.replace(/^#/, ''));
  };
  const onHash = () => follow(location.hash);

  window.addEventListener('hashchange', onHash);
  if (groups.length) follow(location.hash || `#${groupId(DEFAULT_SETTINGS_GROUP)}`);

  return {
    select(key) {
      show(key);
      history.replaceState(history.state, '', `${location.pathname}${location.search}#${groupId(key)}`);
    },
    dispose() {
      window.removeEventListener('hashchange', onHash);
      if (waiting !== null) window.clearInterval(waiting);
    },
  };
}
