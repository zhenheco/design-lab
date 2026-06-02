export interface FeedbackEntry {
    signal: string;
    user_quote: string;
    verdict?: 'like' | 'dislike';
    client?: string;
    case_slug?: string;
    dimension?: string;
    derived_rule?: string;
    occurred_at?: string;
    [key: string]: unknown;
}

export function appendFeedback(vault: string, entry: FeedbackEntry): void;
export function readFeedback(vault: string): FeedbackEntry[];
