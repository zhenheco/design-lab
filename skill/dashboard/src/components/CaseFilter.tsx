import { useState } from 'react';

interface Props {
    initialScenario?: string;
    initialSentiment?: 'positive' | 'negative' | '';
    scenarios: string[];
}

export function CaseFilter({ initialScenario = '', initialSentiment = '', scenarios }: Props) {
    const [scenario, setScenario] = useState(initialScenario);
    const [sentiment, setSentiment] = useState<'' | 'positive' | 'negative'>(initialSentiment);

    const apply = () => {
        const params = new URLSearchParams();
        if (scenario) {
            params.set('scenario', scenario);
        }
        if (sentiment) {
            params.set('sentiment', sentiment);
        }

        const query = params.toString();
        window.location.search = query ? `?${query}` : '';
    };

    const reset = () => {
        window.location.search = '';
    };

    return (
        <div className="mt-4 flex flex-wrap items-center gap-3">
            <select
                value={scenario}
                onChange={(event) => setScenario(event.target.value)}
                className="rounded border border-[color:var(--color-border)] px-3 py-1.5 text-sm"
            >
                <option value="">All scenarios</option>
                {scenarios.map((item) => (
                    <option key={item} value={item}>
                        {item}
                    </option>
                ))}
            </select>

            <div className="flex gap-1 rounded border border-[color:var(--color-border)] p-0.5">
                {(['', 'positive', 'negative'] as const).map((option) => (
                    <button
                        key={option || 'all'}
                        type="button"
                        onClick={() => setSentiment(option)}
                        className={`rounded px-3 py-1 text-sm ${
                            sentiment === option
                                ? 'bg-[color:var(--color-fg)] text-white'
                                : 'hover:bg-gray-100'
                        }`}
                    >
                        {option || 'All'}
                    </button>
                ))}
            </div>

            <button
                type="button"
                onClick={apply}
                className="rounded bg-[color:var(--color-fg)] px-3 py-1.5 text-sm text-white"
            >
                Apply
            </button>
            <button
                type="button"
                onClick={reset}
                className="rounded border border-[color:var(--color-border)] px-3 py-1.5 text-sm"
            >
                Reset
            </button>
        </div>
    );
}
