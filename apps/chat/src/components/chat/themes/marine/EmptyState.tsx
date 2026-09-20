'use client';

import { useState } from 'react';
import { SendHorizontal } from 'lucide-react';
import { marineBrand, parsePromptTemplate, type SuggestedPrompt } from './config';

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
            <PromptEntry prompt={item.prompt} onSend={onPromptClick} />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * A plain prompt is a link that sends on click. A prompt with a
 * `{{placeholder}}` becomes an inline sentence with a text field in the gap:
 *   Deep dive into the topic [ topic… ] ▶
 * Enter or the arrow sends the completed sentence; the field is required.
 */
function PromptEntry({
  prompt,
  onSend,
}: {
  prompt: string;
  onSend: (prompt: string) => void;
}) {
  const template = parsePromptTemplate(prompt);
  const [value, setValue] = useState('');

  if (!template) {
    return (
      <button
        type="button"
        onClick={() => onSend(prompt)}
        className="self-start text-left text-sm font-medium leading-[21px] transition-opacity hover:opacity-80"
        style={{ color: 'var(--marine-teal)' }}
      >
        {prompt}
      </button>
    );
  }

  const filled = value.trim();
  const submit = () => {
    if (!filled) return;
    onSend(`${template.before}${filled}${template.after}`.trim());
    setValue('');
  };

  return (
    <form
      className="flex flex-wrap items-center gap-x-2 gap-y-1.5 self-start text-sm font-medium leading-[21px]"
      style={{ color: 'var(--marine-teal)' }}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {template.before.trim() && <span>{template.before.trim()}</span>}
      <span
        className="inline-flex items-center rounded-md border transition-colors focus-within:ring-2 focus-within:ring-[var(--marine-teal)]/30"
        style={{ borderColor: 'var(--marine-teal-border)', backgroundColor: 'var(--marine-surface)' }}
      >
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={`${template.placeholder}…`}
          aria-label={template.placeholder}
          className="h-8 w-[220px] max-w-full bg-transparent px-2.5 text-sm font-normal outline-none placeholder:italic"
          style={{ color: 'var(--marine-text)' }}
        />
        <button
          type="submit"
          disabled={!filled}
          aria-label="Send"
          className="flex h-8 w-8 items-center justify-center rounded-r-md text-white transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          style={{ backgroundColor: 'var(--marine-teal)' }}
        >
          <SendHorizontal className="h-4 w-4" />
        </button>
      </span>
      {template.after.trim() && <span>{template.after.trim()}</span>}
    </form>
  );
}
