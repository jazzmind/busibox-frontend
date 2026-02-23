import { redirect } from 'next/navigation';

/**
 * Legacy route. With basePath="/agents", this would be `/agents/agents`.
 * Redirect to the dashboard at `/agents` instead.
 */
export default function AgentsLegacyPage() {
  redirect('/');
}
