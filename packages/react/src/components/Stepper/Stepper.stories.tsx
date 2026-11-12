import type { Meta, StoryObj } from '@storybook/react-vite';
import { Specimen, SpecimenStack } from '../../stories/StateGrid';
import { Avatar } from '../Avatar';
import { Stepper } from './Stepper';

const STEPS = [{ label: 'You explore' }, { label: 'Dana decides', meta: 'now, for 3 days', leading: <Avatar name="Dana" size="xs" /> }, { label: 'Developers build it' }, { label: 'Live' }];
const TWO = [{ label: 'Card padding' }, { label: 'Send to the developers' }];

const meta = { title: 'Navigation/Stepper', component: Stepper, args: { label: 'Steps', steps: STEPS, current: 1 } } satisfies Meta<typeof Stepper>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AllStates: Story = {
  render: () => (
    <SpecimenStack>
      <Specimen label="Done, current, upcoming">
        <Stepper label="Vertical" steps={STEPS} current={1} />
      </Specimen>
      <Specimen label="All done">
        <Stepper label="Done" steps={STEPS} current={STEPS.length} />
      </Specimen>
      <Specimen label="Horizontal">
        <Stepper label="Horizontal" orientation="horizontal" steps={STEPS} current={1} />
      </Specimen>
      <Specimen label="Horizontal, narrow container">
        <div style={{ width: 280 }}>
          <Stepper label="Narrow" orientation="horizontal" steps={TWO} current={0} />
        </div>
      </Specimen>
    </SpecimenStack>
  ),
};
