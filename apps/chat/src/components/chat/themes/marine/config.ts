/**
 * Marine theme brand configuration.
 *
 * All strings that could vary by tenant are read from NEXT_PUBLIC_* env vars
 * at build time. This keeps the OSS repo free of tenant-specific copy.
 * A deploy sets the vars it needs; anything unset falls back to generic
 * placeholders that read cleanly in the demo/reference deploy.
 *
 * Env vars honored:
 *   NEXT_PUBLIC_CHAT_PRODUCT_NAME       — top-bar title
 *   NEXT_PUBLIC_CHAT_TAGLINE            — top-bar subtitle
 *   NEXT_PUBLIC_CHAT_SIDEBAR_TITLE      — sidebar section label (usually the product name)
 *   NEXT_PUBLIC_CHAT_COMPOSER_PLACEHOLDER
 *   NEXT_PUBLIC_CHAT_DISCLAIMER
 *   NEXT_PUBLIC_CHAT_EMPTY_HEADING
 *   NEXT_PUBLIC_CHAT_SUGGESTED_PROMPTS  — JSON: [{ description, prompt }]
 */

export interface SuggestedPrompt {
  description: string;
  prompt: string;
}

export interface MarineBrandConfig {
  productName: string;
  tagline: string;
  sidebarTitle: string;
  composerPlaceholder: string;
  disclaimer: string;
  emptyHeading: string;
  suggestedPrompts: SuggestedPrompt[];
}

const DEFAULT_PROMPTS: SuggestedPrompt[] = [
  {
    description:
      'Start with an open question — the assistant will pick the right tools and context to answer.',
    prompt: 'What can you help me with?',
  },
  {
    description:
      'Ask for a summary, comparison, or step-by-step walkthrough of any topic.',
    prompt: 'Explain something to me, step by step.',
  },
  {
    description:
      'Follow-ups are in natural language — earlier context in the conversation is remembered.',
    prompt: 'Give me a short summary of what we just discussed.',
  },
];

/** Safely parse the SUGGESTED_PROMPTS env var; fall back to defaults on failure. */
function parsePrompts(raw: string | undefined): SuggestedPrompt[] {
  if (!raw) return DEFAULT_PROMPTS;
  try {
    const parsed = JSON.parse(raw);
    if (
      Array.isArray(parsed) &&
      parsed.every(
        (p) => p && typeof p === 'object' && 'description' in p && 'prompt' in p,
      )
    ) {
      return parsed as SuggestedPrompt[];
    }
  } catch {
    /* fall through to defaults */
  }
  return DEFAULT_PROMPTS;
}

export const marineBrand: MarineBrandConfig = {
  productName:
    process.env.NEXT_PUBLIC_CHAT_PRODUCT_NAME || 'Marine AI',
  tagline: process.env.NEXT_PUBLIC_CHAT_TAGLINE || '',
  sidebarTitle:
    process.env.NEXT_PUBLIC_CHAT_SIDEBAR_TITLE ||
    process.env.NEXT_PUBLIC_CHAT_PRODUCT_NAME ||
    'MARINE AI',
  composerPlaceholder:
    process.env.NEXT_PUBLIC_CHAT_COMPOSER_PLACEHOLDER || 'Ask anything',
  disclaimer:
    process.env.NEXT_PUBLIC_CHAT_DISCLAIMER ||
    'AI can make mistakes. Check the responses.',
  emptyHeading:
    process.env.NEXT_PUBLIC_CHAT_EMPTY_HEADING ||
    'What can I help you with today?',
  suggestedPrompts: parsePrompts(process.env.NEXT_PUBLIC_CHAT_SUGGESTED_PROMPTS),
};
