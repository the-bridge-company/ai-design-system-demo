// Team Settings: shows one group at a time (lib/settings-sections.ts). The section nav's links switch the group and
// keep it in the address (#set-group-tools), so Back and a shared link land on the same group. An older anchor
// (#roles, #figma) opens its group and scrolls to the band once its island has drawn it.
import { DEFAULT_SETTINGS_GROUP, groupForHash, groupId, hashNamesBand, type SettingsGroupKey } from '../lib/settings-sections';

export function initSettingsSections(root: ParentNode = document): void {
  const groups = [...root.querySelectorAll<HTMLElement>('[data-set-group]')];
  const links = [...root.querySelectorAll<HTMLAnchorElement>('[data-set-tab]')];
  if (!groups.length) return;
  let waiting: number | null = null;

  const show = (key: SettingsGroupKey) => {
    for (const g of groups) g.hidden = g.dataset.setGroup !== key;
    for (const a of links) {
      if (a.dataset.setTab === key) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    }
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

  for (const a of links) {
    a.addEventListener('click', (e) => {
      const key = a.dataset.setTab as SettingsGroupKey | undefined;
      if (!key) return;
      e.preventDefault();
      show(key);
      history.replaceState(history.state, '', `${location.pathname}${location.search}#${groupId(key)}`);
    });
  }
  window.addEventListener('hashchange', () => follow(location.hash));
  follow(location.hash || `#${groupId(DEFAULT_SETTINGS_GROUP)}`);
}
