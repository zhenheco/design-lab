export type FeedbackVerdict = 'like' | 'dislike';

export function verdictFromSignal(signal: string): FeedbackVerdict | null {
    const normalized = signal.toLowerCase();
    if (
        normalized.includes('dislike') ||
        normalized.includes('negative') ||
        normalized.includes('avoid') ||
        normalized.includes('bad')
    ) {
        return 'dislike';
    }
    if (
        normalized.includes('like') ||
        normalized.includes('positive') ||
        normalized.includes('good') ||
        normalized.includes('prefer')
    ) {
        return 'like';
    }

    return null;
}
