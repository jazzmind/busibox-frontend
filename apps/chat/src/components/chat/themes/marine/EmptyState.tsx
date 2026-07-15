'use client';

import { marineBrand, type SuggestedPrompt } from './config';

interface MarineEmptyStateProps {
  onPromptClick: (prompt: string) => void;
  /** Override the config-driven heading and prompts (mainly used by /demo). */
  heading?: string;
  prompts?: SuggestedPrompt[];
}

export function MarineEmptyState({
  onPromptClick,
  heading = marineBrand.emptyHeading,
  prompts = marineBrand.suggestedPrompts,
}: MarineEmptyStateProps) {
  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col px-2 pt-16">
      <h2
        className="pb-8 text-[26px] font-bold leading-[34px]"
        style={{ color: 'var(--marine-text)' }}
      >
        {heading}
      </h2>

      <div className="flex flex-col">
        {prompts.map((item, idx) => (
          <div
            key={item.prompt}
            className="flex flex-col py-5"
            style={
              idx < prompts.length - 1
                ? { borderBottom: '1px solid var(--marine-border)' }
                : undefined
            }
          >
            <p
              className="pb-1.5 text-sm leading-[22px]"
              style={{ color: 'var(--marine-text-muted)' }}
            >
              {item.description}
            </p>
            <button
              type="button"
              onClick={() => onPromptClick(item.prompt)}
              className="self-start text-left text-sm font-medium leading-[21px] transition-opacity hover:opacity-80"
              style={{ color: 'var(--marine-teal)' }}
            >
              {item.prompt}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
