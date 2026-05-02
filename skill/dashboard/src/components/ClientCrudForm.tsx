import { useEffect, useState } from 'react';
import { archiveClient, createClient, fetchClients, updateClient } from '../lib/api.ts';

const PALETTE = [
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

type ClientType = 'self' | 'client';
type Mode = 'closed' | 'create' | 'edit';
type ClientFormState = {
    slug: string;
    name: string;
    type: ClientType;
    theme_color: string;
    notes: string;
};

const EMPTY_FORM: ClientFormState = {
    slug: '',
    name: '',
    type: 'client',
    theme_color: PALETTE[0],
    notes: ''
};

function toFormState(input?: Partial<ClientFormState>): ClientFormState {
    return {
        slug: input?.slug ?? EMPTY_FORM.slug,
        name: input?.name ?? EMPTY_FORM.name,
        type: input?.type ?? EMPTY_FORM.type,
        theme_color: input?.theme_color ?? EMPTY_FORM.theme_color,
        notes: input?.notes ?? EMPTY_FORM.notes
    };
}

export function ClientCrudForm() {
    const [mode, setMode] = useState<Mode>('closed');
    const [form, setForm] = useState<ClientFormState>(EMPTY_FORM);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const onEdit = async (event: Event) => {
            const detail = (event as CustomEvent<{ slug?: string }>).detail;
            if (!detail?.slug) {
                return;
            }

            try {
                const clients = await fetchClients();
                const target = clients.find((client) => client.slug === detail.slug);
                if (!target) {
                    throw new Error(`client not found: ${detail.slug}`);
                }

                setForm(toFormState({
                    slug: target.slug,
                    name: target.name,
                    type: target.type,
                    theme_color: target.theme_color,
                    notes: target.notes
                }));
                setError('');
                setMode('edit');
            } catch (cause: unknown) {
                const message = cause instanceof Error ? cause.message : String(cause);
                window.alert(`Load client failed: ${message}`);
            }
        };

        const onArchive = async (event: Event) => {
            const detail = (event as CustomEvent<{ slug?: string }>).detail;
            if (!detail?.slug) {
                return;
            }

            if (!window.confirm(`Archive client "${detail.slug}"? Data preserved in clients/.archived/`)) {
                return;
            }

            try {
                await archiveClient(detail.slug);
                window.location.reload();
            } catch (cause: unknown) {
                const message = cause instanceof Error ? cause.message : String(cause);
                window.alert(`Archive failed: ${message}`);
            }
        };

        window.addEventListener('design-lab:edit-client', onEdit as EventListener);
        window.addEventListener('design-lab:archive-client', onArchive as EventListener);

        return () => {
            window.removeEventListener('design-lab:edit-client', onEdit as EventListener);
            window.removeEventListener('design-lab:archive-client', onArchive as EventListener);
        };
    }, []);

    const openCreate = () => {
        setForm(EMPTY_FORM);
        setError('');
        setMode('create');
    };

    const close = () => {
        if (submitting) {
            return;
        }

        setMode('closed');
        setError('');
    };

    const submit = async () => {
        setSubmitting(true);
        setError('');

        try {
            if (mode === 'create') {
                await createClient(form);
            } else if (mode === 'edit') {
                await updateClient(form.slug, {
                    name: form.name,
                    type: form.type,
                    theme_color: form.theme_color,
                    notes: form.notes
                });
            }

            setMode('closed');
            window.location.reload();
        } catch (cause: unknown) {
            setError(cause instanceof Error ? cause.message : String(cause));
        } finally {
            setSubmitting(false);
        }
    };

    if (mode === 'closed') {
        return (
            <button
                type="button"
                onClick={openCreate}
                className="rounded bg-[color:var(--color-fg)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
                + Add Client
            </button>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4" onClick={close}>
            <div
                className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
                onClick={(event) => event.stopPropagation()}
            >
                <h3 className="mb-4 text-lg font-semibold">{mode === 'create' ? 'New Client' : `Edit ${form.slug}`}</h3>

                {error ? <div className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</div> : null}

                <label htmlFor="client-slug" className="mb-3 block">
                    <span className="text-xs text-[color:var(--color-muted)]">Slug</span>
                    <input
                        id="client-slug"
                        name="slug"
                        value={form.slug}
                        onChange={(event) => setForm({ ...form, slug: event.target.value })}
                        disabled={mode === 'edit'}
                        className="mt-1 w-full rounded border border-[color:var(--color-border)] px-3 py-2 text-sm disabled:bg-gray-50"
                    />
                </label>

                <label htmlFor="client-name" className="mb-3 block">
                    <span className="text-xs text-[color:var(--color-muted)]">Name</span>
                    <input
                        id="client-name"
                        name="name"
                        value={form.name}
                        onChange={(event) => setForm({ ...form, name: event.target.value })}
                        className="mt-1 w-full rounded border border-[color:var(--color-border)] px-3 py-2 text-sm"
                    />
                </label>

                <label htmlFor="client-type" className="mb-3 block">
                    <span className="text-xs text-[color:var(--color-muted)]">Type</span>
                    <select
                        id="client-type"
                        name="type"
                        value={form.type}
                        onChange={(event) => setForm({ ...form, type: event.target.value as ClientType })}
                        className="mt-1 w-full rounded border border-[color:var(--color-border)] px-3 py-2 text-sm"
                    >
                        <option value="self">Self</option>
                        <option value="client">Client</option>
                    </select>
                </label>

                <fieldset className="mb-3">
                    <legend className="text-xs text-[color:var(--color-muted)]">Theme color</legend>
                    <div className="mt-2 flex flex-wrap gap-2">
                        {PALETTE.map((color) => (
                            <button
                                key={color}
                                type="button"
                                aria-label={color}
                                aria-pressed={form.theme_color === color}
                                onClick={() => setForm({ ...form, theme_color: color })}
                                className={`h-8 w-8 rounded-full border-2 ${
                                    form.theme_color === color ? 'border-black' : 'border-transparent'
                                }`}
                                style={{ backgroundColor: color }}
                            />
                        ))}
                    </div>
                </fieldset>

                <label htmlFor="client-notes" className="mb-4 block">
                    <span className="text-xs text-[color:var(--color-muted)]">Notes</span>
                    <textarea
                        id="client-notes"
                        name="notes"
                        rows={3}
                        value={form.notes}
                        onChange={(event) => setForm({ ...form, notes: event.target.value })}
                        className="mt-1 w-full rounded border border-[color:var(--color-border)] px-3 py-2 text-sm"
                    />
                </label>

                <div className="flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={close}
                        disabled={submitting}
                        className="rounded border border-[color:var(--color-border)] px-4 py-2 text-sm hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={submit}
                        disabled={submitting || !form.slug.trim() || !form.name.trim()}
                        className="rounded bg-[color:var(--color-fg)] px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
                    >
                        {submitting ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
}
