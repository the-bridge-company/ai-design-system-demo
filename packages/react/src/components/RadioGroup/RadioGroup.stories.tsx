import type { Meta, StoryObj } from '@storybook/react-vite';
import { Specimen, SpecimenStack, StateGrid } from '../../stories/StateGrid';
import { Avatar } from '../Avatar';
import { VisuallyHidden } from '../VisuallyHidden';
import { Radio, RadioGroup } from './RadioGroup';

const meta = {
  title: 'Forms/RadioGroup',
  component: RadioGroup,
  args: { label: 'Merge strategy', defaultValue: 'squash', children: null },
  argTypes: { orientation: { control: 'inline-radio', options: ['vertical', 'horizontal'] }, appearance: { control: 'inline-radio', options: ['list', 'tile'] } },
} satisfies Meta<typeof RadioGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

const options = (
  <>
    <Radio value="merge" label="Merge commit" description="Keeps every commit from the branch." />
    <Radio value="squash" label="Squash and merge" description="One commit per pull request. Recommended for token changes." />
    <Radio value="rebase" label="Rebase and merge" />
  </>
);

export const Default: Story = { render: (args) => <RadioGroup {...args}>{options}</RadioGroup> };
export const Horizontal: Story = {
  args: { label: 'Theme', orientation: 'horizontal', defaultValue: 'light' },
  render: (args) => (
    <RadioGroup {...args}>
      <Radio value="light" label="Light" />
      <Radio value="dark" label="Dark" />
      <Radio value="system" label="System" />
    </RadioGroup>
  ),
};
export const Invalid: Story = { args: { defaultValue: undefined, required: true, error: 'Pick a merge strategy before you publish.' }, render: (args) => <RadioGroup {...args}>{options}</RadioGroup> };

/** Picture options: the tile is the control, its caption line kept on every tile so rows are one height. */
const faces = ['Ana Lima', 'Ben Okafor', 'Chloé Martin', 'Dev Patel', 'Eva Novak', 'Femi Adé'];
const tiles = faces.map((name, i) => (
  <Radio
    key={name}
    value={name}
    disabled={i === 3}
    label={
      <>
        <Avatar name={name} size="lg" decorative />
        <span aria-hidden="true">{i === 3 ? 'Taken' : '\u00a0'}</span>
        <VisuallyHidden>{i === 3 ? `${name}, taken` : name}</VisuallyHidden>
      </>
    }
  />
));

export const Tile: Story = {
  args: { label: 'Pick a face', hideLabel: true, appearance: 'tile', defaultValue: 'Ben Okafor' },
  render: (args) => <RadioGroup {...args}>{tiles}</RadioGroup>,
};

type Row = 'unchecked' | 'checked' | 'disabled' | 'disabledChecked';

export const AllStates: Story = {
  render: () => (
    <SpecimenStack>
      <StateGrid<Row>
        columns={[{ label: 'Default' }, { label: 'Hover', pseudo: 'hover' }, { label: 'Focus visible', pseudo: 'focus-visible' }]}
        rows={[
          { label: 'Unselected', value: 'unchecked' },
          { label: 'Selected', value: 'checked' },
          { label: 'Disabled', value: 'disabled' },
          { label: 'Disabled selected', value: 'disabledChecked' },
        ]}
        render={(row, col) => (
          <RadioGroup label={`${row} ${col.label}`} hideLabel defaultValue={row === 'checked' || row === 'disabledChecked' ? 'a' : undefined} disabled={row.startsWith('disabled')}>
            <Radio value="a" label="Squash and merge" />
          </RadioGroup>
        )}
      />
      <Specimen label="Tile appearance (one taken)">
        <RadioGroup label="Pick a face" hideLabel appearance="tile" defaultValue="Ben Okafor">
          {tiles}
        </RadioGroup>
      </Specimen>
      <Specimen label="Invalid">
        <RadioGroup label="Merge strategy" required error="Pick a merge strategy before you publish.">
          {options}
        </RadioGroup>
      </Specimen>
    </SpecimenStack>
  ),
};
