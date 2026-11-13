// A DS Select for pages driven by a plain script (a hydrated island, client:load). The page renders it with its
// options and first value; the script follows picks with onSelectPick(id) and moves it with setSelect(id), both in
// lib/select-bridge. With `name`, a hidden input carries the value in its form and announces each pick with a
// bubbling change event, so form scripts read it like the native select it replaces. An empty value ("All", "Not
// set") is a real option here: Base UI reads "" as no selection, so it travels inside the island as EMPTY.
// With `filter`, it is Studio's one filter pattern (studio/ListFilters MultiFilter): the label inside the trigger,
// several values ticked at once, travelling to the script comma separated; the "" option is the "all" word, read when
// nothing is ticked, never an option.
import { useEffect, useRef, useState } from 'react';
import { Select, type SelectSize } from '@bridge-ds/react';
import { SELECT_PICK_EVENT, SELECT_SET_EVENT, selectState, type BridgedOption, type SelectPickDetail, type SelectState } from '../../lib/select-bridge';
import { CountTag } from './studio/CountTag';
import { MultiFilter } from './studio/ListFilters';

export interface BridgedSelectProps {
  /** The key the script uses (setSelect, onSelectPick). */
  id: string;
  label: string;
  hideLabel?: boolean;
  /** A filter bar's filter: inline label, several values (comma separated in the bridge), "" option = the all word. */
  filter?: boolean;
  hint?: string;
  options: BridgedOption[];
  value: string;
  size?: SelectSize;
  name?: string;
  className?: string;
  'aria-describedby'?: string;
}

const EMPTY = '\u0000empty';
const enc = (v: string) => (v === '' ? EMPTY : v);
const dec = (v: string | null) => (v == null || v === EMPTY ? '' : v);

const withBadges = (options: BridgedOption[]) =>
  options.map(({ count, badge, ...o }) => ({
    ...o,
    value: enc(o.value),
    badge: badge ?? (count === undefined ? undefined : <CountTag n={count} />),
  }));

export default function BridgedSelect({ id, label, hideLabel, filter, hint, options: initialOptions, value: initialValue, size = 'sm', name, className, ...aria }: BridgedSelectProps) {
  const [state, setState] = useState<Required<SelectState>>({ value: initialValue, options: initialOptions });
  const hidden = useRef<HTMLInputElement>(null);
  const picked = useRef(false);

  useEffect(() => {
    const remembered = selectState(id);
    if (remembered) setState((s) => ({ value: remembered.value ?? s.value, options: remembered.options ?? s.options }));
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ id: string } & SelectState>).detail;
      if (d?.id !== id) return;
      setState((s) => ({ value: d.value === undefined ? s.value : d.value, options: d.options ?? s.options }));
    };
    document.addEventListener(SELECT_SET_EVENT, on);
    return () => document.removeEventListener(SELECT_SET_EVENT, on);
  }, [id]);

  // After a pick has rendered, the hidden input holds the new value: tell form listeners.
  useEffect(() => {
    if (!picked.current) return;
    picked.current = false;
    hidden.current?.dispatchEvent(new Event('change', { bubbles: true }));
  }, [state.value]);

  const send = (next: string) => {
    if (next === state.value) return;
    picked.current = true;
    setState((s) => ({ ...s, value: next }));
    document.dispatchEvent(new CustomEvent<SelectPickDetail>(SELECT_PICK_EVENT, { detail: { id, value: next } }));
  };

  return (
    <span className="bridged-select" data-bridged-select={id}>
      {filter ? (
        <MultiFilter
          label={label}
          all={state.options.find((o) => o.value === '')?.label ?? 'All'}
          options={state.options.filter((o) => o.value !== '').map((o) => ({ value: o.value, label: o.label, count: o.count }))}
          picked={(state.value ?? '').split(',').filter(Boolean)}
          onPick={(v) => send(v.join(','))}
        />
      ) : (
        <Select
          label={label}
          hideLabel={hideLabel}
          hint={hint}
          size={size}
          className={className}
          options={withBadges(state.options)}
          value={enc(state.value ?? '')}
          onValueChange={(v) => send(dec(v))}
          {...aria}
        />
      )}
      {name && <input ref={hidden} type="hidden" name={name} value={state.value ?? ''} />}
    </span>
  );
}
