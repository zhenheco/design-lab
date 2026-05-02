export const THEME_COLOR_PALETTE = [
    '#1F2937',
    '#0F766E',
    '#1E40AF',
    '#7C3AED',
    '#BE185D',
    '#B91C1C',
    '#A16207',
    '#15803D',
    '#0E7490',
    '#6D28D9',
    '#9333EA',
    '#374151'
] as const;

export type ThemeColor = (typeof THEME_COLOR_PALETTE)[number];

export function isValidThemeColor(value: string): boolean {
    const upper = value.toUpperCase();
    return (THEME_COLOR_PALETTE as readonly string[]).includes(upper);
}

export function normalizeThemeColor(value: string): ThemeColor | null {
    const upper = value.toUpperCase();
    return (THEME_COLOR_PALETTE as readonly string[]).includes(upper) ? (upper as ThemeColor) : null;
}
