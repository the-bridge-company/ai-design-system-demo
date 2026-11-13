import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Palette } from 'lucide-react';
import { Specimen, SpecimenStack, StateGrid } from '../../stories/StateGrid';
import { Badge } from '../Badge';
import { Icon } from '../Icon';
import { Select, type SelectOption } from './Select';

const THEMES: SelectOption[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'contrast', label: 'High contrast', description: 'Not available for the ocean brand', disabled: true },
];

const TOKEN_GROUPS: SelectOption[] = [
  { value: 'color.action.primary.bg', label: 'color.action.primary.bg', group: 'Color' },
  { value: 'color.border.strong', label: 'color.border.strong', group: 'Color' },
  { value: 'color.signal.default', label: 'color.signal.default', group: 'Color' },
  { value: 'space.4', label: 'space.4', group: 'Space' },
  { value: 'space.6', label: 'space.6', group: 'Space' },
  { value: 'radius.control', label: 'radius.control', group: 'Radius' },
  { value: 'radius.overlay', label: 'radius.overlay', group: 'Radius' },
];

const meta = {
  title: 'Forms/Select',
  component: Select,
  args: { label: 'Theme', options: THEMES, placeholder: 'No theme', hint: 'Applies to the preview only.', disabled: false },
  argTypes: {
    // A control, so the Storybook measure (bridge specs --measure --variants) reaches the Disabled variants.
    disabled: { control: 'boolean' },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
    prefix: { control: false },
    options: { control: false },
  },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

const narrow = [(Story: () => JSX.Element) => <div style={{ maxWidth: 320 }}><Story /></div>];

export const Default: Story = { decorators: narrow };
export const WithValue: Story = { decorators: narrow, args: { defaultValue: 'dark' } };
export const WithError: Story = { decorators: narrow, args: { error: 'Pick a theme before you publish the preview.' } };
export const Grouped: Story = {
  decorators: narrow,
  args: { label: 'Token', options: TOKEN_GROUPS, placeholder: 'Choose a token', hint: undefined },
};

const CHANGES: SelectOption[] = [
  { value: 'latest', label: 'Latest library', description: 'What is shipped' },
  { value: 'change-12', label: 'Darker default background', description: 'by florian', group: 'Open changes', badge: <Badge tone="info" size="sm">In review</Badge> },
  { value: 'change-14', label: 'New radius scale', description: 'by sam', group: 'Open changes', badge: <Badge tone="success" size="sm">Ready</Badge> },
  { value: 'change-15', label: 'Focus ring on dark surfaces', description: 'by alex', group: 'Open changes', badge: <Badge tone="warning" size="sm">Changes asked</Badge> },
];

/** A status Badge on each option and in the trigger (the Studio "Viewing" select). */
export const WithBadges: Story = {
  decorators: [(Story) => <div style={{ maxWidth: 360, minHeight: 320 }}><Story /></div>],
  args: { label: 'View the library as', options: CHANGES, defaultValue: 'change-12', defaultOpen: true, hint: undefined },
};

/** The popup rendered open, for review and screenshots. */
export const Open: Story = {
  decorators: [(Story) => <div style={{ maxWidth: 320, minHeight: 360 }}><Story /></div>],
  args: { label: 'Token', options: TOKEN_GROUPS, defaultValue: 'color.border.strong', defaultOpen: true, hint: undefined },
};

const PRODUCTS: SelectOption[] = [
  { value: 'all', label: 'All products', badge: <Badge tone="neutral" size="sm">9</Badge> },
  { value: 'crm', label: 'Acme CRM', badge: <Badge tone="neutral" size="sm">5</Badge> },
  { value: 'pay', label: 'Acme Pay', badge: <Badge tone="neutral" size="sm">4</Badge> },
];
const PEOPLE: SelectOption[] = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'you', label: 'You' },
  { value: 'leo', label: 'Leo' },
  { value: 'sam', label: 'Sam' },
];

function FilterBarDemo() {
  const [people, setPeople] = useState<string[]>(['everyone']);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, minHeight: 280 }}>
      <Select inlineLabel="Product" options={PRODUCTS} defaultValue="all" />
      <Select
        multiple
        inlineLabel="Person"
        options={PEOPLE}
        values={people}
        displayValue={people.includes('everyone') ? 'Everyone' : undefined}
        onValuesChange={(next) => {
          const added = next.filter((v) => !people.includes(v));
          setPeople(added.includes('everyone') || !next.length ? ['everyone'] : next.filter((v) => v !== 'everyone'));
        }}
      />
    </div>
  );
}

/** The filter bar pattern: an inline label in secondary text, the value, the trigger hugging both. Person is multiple. */
export const FilterBar: Story = { render: () => <FilterBarDemo /> };

export const AllStates: Story = {
  render: () => (
    <SpecimenStack>
      <StateGrid
        columns={[{ label: 'Default' }, { label: 'Hover', pseudo: 'hover' }, { label: 'Focus visible', pseudo: 'focus-visible' }]}
        rows={[
          { label: 'Placeholder', value: 'placeholder' },
          { label: 'Selected', value: 'selected' },
          { label: 'Invalid', value: 'invalid' },
          { label: 'Disabled', value: 'disabled' },
        ]}
        render={(state, col) => (
          <div style={{ width: 220 }}>
            <Select
              label={`${state} ${col.label}`}
              hideLabel
              options={THEMES}
              placeholder="No theme"
              defaultValue={state === 'placeholder' ? undefined : 'dark'}
              error={state === 'invalid' ? 'Pick a theme.' : undefined}
              disabled={state === 'disabled'}
            />
          </div>
        )}
      />
      <Specimen label="Sizes (follow density)">
        <div style={{ display: 'grid', gap: 12, width: 260 }}>
          <Select label="Small" size="sm" options={THEMES} defaultValue="light" />
          <Select label="Medium" options={THEMES} defaultValue="light" />
          <Select label="Large" size="lg" options={THEMES} defaultValue="light" />
        </div>
      </Specimen>
      <Specimen label="Inline label (filter bars)">
        <div style={{ display: 'flex', gap: 8 }}>
          <Select inlineLabel="Status" options={[{ value: 'waiting', label: 'Waiting' }, { value: 'decided', label: 'Decided' }]} defaultValue="waiting" />
          <Select inlineLabel="Product" options={PRODUCTS} defaultValue="all" />
          <Select multiple inlineLabel="Person" options={PEOPLE} values={['leo', 'sam']} />
        </div>
      </Specimen>
      <Specimen label="Prefix icon">
        <div style={{ width: 260 }}>
          <Select label="Brand" options={[{ value: 'bridge', label: 'Bridge' }, { value: 'ocean', label: 'Ocean' }]} defaultValue="bridge" prefix={<Icon icon={Palette} size="sm" />} />
        </div>
      </Specimen>
    </SpecimenStack>
  ),
};
