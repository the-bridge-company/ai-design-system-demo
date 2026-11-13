// Settings > Reviews on a team's Settings (batch D, D6): who reviews (ReviewsSection) at the top of the Reviews tab, the
// one place it lives (the Team tab no longer repeats it under the members), at the width every Settings section has.
// It reads the team's members the way the Members band does (members-state useMembers) and says nothing until they are
// read, so nothing appears and goes away.
import ReviewsSection from './ReviewsSection';
import { useMembers } from './members-state';

export default function ReviewsTab() {
  const { load } = useMembers();
  if (load.status !== 'ready') return null;
  const d = load.data;
  if (d.context !== 'real' || d.signedOut) return null;
  return <ReviewsSection repo={d.repo} canEdit={d.canManage} members={d.members} reviews={d.reviews ?? null} />;
}
