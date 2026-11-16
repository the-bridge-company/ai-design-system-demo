import type { Meta, StoryObj } from '@storybook/react-vite';
import { CalendarCheck } from 'lucide-react';
import { Link } from '../Link';
import { AnnouncementStrip } from './AnnouncementStrip';

/** A 390px phone viewport, so the media queries see a narrow screen (a narrow wrapper would not). */
const phone = {
  parameters: { viewport: { options: { phone390: { name: 'Phone 390', styles: { width: '390px', height: '844px' }, type: 'mobile' } } } },
  globals: { viewport: { value: 'phone390', isRotated: false } },
};

const message = (
  <>
    Paid plans open in 2027. Teams created by 31 March 2027 stay <strong>FREE</strong>, with no end date.
  </>
);

const meta = {
  title: 'Feedback/AnnouncementStrip',
  component: AnnouncementStrip,
  args: {
    label: 'Founding teams',
    icon: CalendarCheck,
    children: message,
    action: <Link href="#founding">Read the commitment</Link>,
    appearance: 'harbor',
  },
  argTypes: {
    appearance: { control: 'inline-radio', options: ['harbor', 'neutral'] },
    icon: { control: false },
    action: { control: false },
    children: { control: false },
  },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AnnouncementStrip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Harbor: Story = {};
/** Neutral: when the page under the strip opens with a Harbor zone of its own. */
export const Neutral: Story = { args: { appearance: 'neutral' } };
export const MessageOnly: Story = { args: { icon: undefined, action: undefined, children: 'Bridge is free for every team today.' } };
/** On a phone the link takes its own line under the message. */
export const Phone: Story = { ...phone };

/** The whole strip is the link: the message says enough, no "Read more". */
export const WholeStripLink: Story = { args: { action: undefined, href: '#founding' } };
