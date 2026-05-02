import { useEffect, useState } from 'react';
import { fetchStyleGuide, saveStyleGuide } from '../lib/api.ts';

interface Props {
    initialContent: string;
    initialHash: string;
}

export function StyleGuideEditor({ initialContent, initialHash }: Props) {
    const [content, setContent] = useState(initialContent);
    const [baselineContent, setBaselineContent] = useState(initialContent);
    const [hash, setHash] = useState(initialHash);
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [conflict, setConflict] = useState(false);
    const [savedAt, setSavedAt] = useState<string | null>(null);

    useEffect(() => {
        setContent(initialContent);
        setBaselineContent(initialContent);
        setHash(initialHash);
        setDirty(false);
        setSavedAt(null);
    }, [initialContent, initialHash]);

    useEffect(() => {
        setDirty(content !== baselineContent);
    }, [baselineContent, content]);

    const onSave = async () => {
        setSaving(true);
        setError('');
        setConflict(false);

        try {
            const result = await saveStyleGuide(content, hash);
            setBaselineContent(content);
            setHash(result.contentHash);
            setDirty(false);
            setSavedAt(new Date().toLocaleTimeString());
        } catch (cause: unknown) {
            const error = cause instanceof Error ? cause : new Error(String(cause));
            if ((error as Error & { code?: string }).code === 'CONFLICT') {
                setConflict(true);
            } else {
                setError(error.message);
            }
        } finally {
            setSaving(false);
        }
    };

    const onReload = async () => {
        try {
            const fresh = await fetchStyleGuide();
            setContent(fresh.content);
            setBaselineContent(fresh.content);
            setHash(fresh.contentHash);
            setConflict(false);
            setDirty(false);
            setError('');
            setSavedAt(null);
        } catch (cause: unknown) {
            const error = cause instanceof Error ? cause : new Error(String(cause));
            setError(error.message);
        }
    };

    return (
        <div className="mt-6">
            {conflict ? (
                <div className="mb-3 rounded border border-amber-400 bg-amber-50 p-3 text-sm">
                    <strong>Conflict detected.</strong> Vault style-guide changed since you loaded.
                    <button
                        type="button"
                        onClick={onReload}
                        className="ml-2 underline text-amber-700 hover:text-amber-900"
                    >
                        Reload latest version
                    </button>
                    <span className="ml-2 text-xs text-amber-700">(your changes will be lost)</span>
                </div>
            ) : null}

            {error ? (
                <div className="mb-3 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>
            ) : null}

            <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                rows={24}
                className="w-full rounded border border-[color:var(--color-border)] p-4 font-mono text-sm leading-relaxed focus:border-[color:var(--color-fg)] focus:outline-none"
            />

            <div className="mt-3 flex items-center justify-between gap-4">
                <div className="text-xs text-[color:var(--color-muted)]">
                    {dirty ? 'Unsaved changes' : savedAt ? `Saved at ${savedAt}` : 'Loaded'}
                    {' · hash '}
                    <code className="text-[10px]">{hash ? `${hash.slice(0, 8)}…` : 'missing'}</code>
                </div>
                <button
                    type="button"
                    onClick={onSave}
                    disabled={!dirty || saving}
                    className="rounded bg-[color:var(--color-fg)] px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
                >
                    {saving ? 'Saving…' : 'Save'}
                </button>
            </div>
        </div>
    );
}
