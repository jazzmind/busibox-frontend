import { redirect } from 'next/navigation';

interface ConversationPageProps {
  params: Promise<{ conversationId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ConversationPage({ params, searchParams }: ConversationPageProps) {
  const { conversationId } = await params;
  const resolved = searchParams ? await searchParams : {};
  const nextParams = new URLSearchParams();
  nextParams.set('conversation', conversationId);
  for (const [key, value] of Object.entries(resolved)) {
    if (key === 'conversation') continue;
    if (Array.isArray(value)) {
      value.forEach((v) => {
        if (v !== undefined) nextParams.append(key, v);
      });
    } else if (value !== undefined) {
      nextParams.set(key, value);
    }
  }
  redirect(`/?${nextParams.toString()}`);
}
