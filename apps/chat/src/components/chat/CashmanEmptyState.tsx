'use client';

interface SuggestedPrompt {
  description: string;
  prompt: string;
}

const SUGGESTED_PROMPTS: SuggestedPrompt[] = [
  {
    description:
      'Sledgewood observes 11 paid company holidays in 2026, plus 2 floating holidays you can use any time.',
    prompt: 'What are our 2026 company holidays?',
  },
  {
    description:
      'PTO accrues monthly from your start date — rates increase after two years of service.',
    prompt: 'How does PTO accrual work, and how much do I earn?',
  },
  {
    description:
      'Sledgewood offers two medical plans: an HSA Plan and a Standard HRA Plan, each with different deductibles and employer contributions.',
    prompt: 'What health insurance plans do we offer?',
  },
];

interface CashmanEmptyStateProps {
  onPromptClick: (prompt: string) => void;
}

export function CashmanEmptyState({ onPromptClick }: CashmanEmptyStateProps) {
  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col px-2 pt-16">
      <h2
        className="pb-8 text-[26px] font-bold leading-[34px]"
        style={{ color: '#101828' }}
      >
        What can I do for you today?
      </h2>

      <div className="flex flex-col">
        {SUGGESTED_PROMPTS.map((item, idx) => (
          <div
            key={item.prompt}
            className="flex flex-col py-5"
            style={
              idx < SUGGESTED_PROMPTS.length - 1
                ? { borderBottom: '1px solid #ebebeb' }
                : undefined
            }
          >
            <p
              className="pb-1.5 text-sm leading-[22px]"
              style={{ color: '#6b6c72' }}
            >
              {item.description}
            </p>
            <button
              type="button"
              onClick={() => onPromptClick(item.prompt)}
              className="self-start text-left text-sm font-medium leading-[21px] transition-opacity hover:opacity-80"
              style={{ color: '#068284' }}
            >
              {item.prompt}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
