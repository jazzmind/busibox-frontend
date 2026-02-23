/**
 * Chat Loading UI
 *
 * Shown automatically by Next.js during navigation.
 * Renders a skeleton that matches the ChatContainer layout.
 */

import { ChatSkeleton } from '@jazzmind/busibox-app/components';

export default function ChatLoading() {
  return (
    <div className="h-full w-full">
      <ChatSkeleton />
    </div>
  );
}
