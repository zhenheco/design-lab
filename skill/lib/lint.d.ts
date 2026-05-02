export interface NeverRule {
    id: string;
    rule: string;
    detector: {
        type: string;
        pattern: string;
        target: string;
    };
}

export function parseRulesFromGuide(markdown: string): NeverRule[];

export function lintCss(
    css: string,
    rules: NeverRule[],
    opts?: { autoFix?: boolean; lintSkip?: string[] }
): {
    violations: any[];
    fixedCss: string;
    fixes: any[];
};
