import { useEffect, useState } from 'react';
import { fetchClients, type ClientMeta } from '../lib/api.ts';

const STORAGE_KEY = 'design-lab.selected-client';

export function ClientSwitcher() {
    const [clients, setClients] = useState<ClientMeta[]>([]);
    const [selected, setSelected] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchClients()
            .then((list) => {
                setClients(list);

                const persisted = window.localStorage.getItem(STORAGE_KEY);
                if (persisted && list.find((client) => client.slug === persisted)) {
                    setSelected(persisted);
                    return;
                }

                if (list.length > 0) {
                    setSelected(list[0].slug);
                }
            })
            .catch((cause: unknown) => {
                setError(cause instanceof Error ? cause.message : String(cause));
            })
            .finally(() => {
                setLoading(false);
            });
    }, []);

    const onSelect = (slug: string) => {
        setSelected(slug);
        window.localStorage.setItem(STORAGE_KEY, slug);
        window.dispatchEvent(new CustomEvent('design-lab:client-changed', { detail: { slug } }));
    };

    if (loading) {
        return <div className="text-sm text-[color:var(--color-muted)]">Loading clients...</div>;
    }

    if (error) {
        return <div className="text-sm text-red-600">Error: {error}</div>;
    }

    if (clients.length === 0) {
        return <div className="text-sm text-[color:var(--color-muted)]">No clients yet.</div>;
    }

    return (
        <div className="flex flex-wrap gap-2">
            {clients.map((client) => (
                <button
                    key={client.slug}
                    onClick={() => onSelect(client.slug)}
                    className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                        selected === client.slug
                            ? 'border-[color:var(--color-fg)] bg-[color:var(--color-fg)] text-white'
                            : 'border-[color:var(--color-border)] bg-white text-[color:var(--color-fg)] hover:border-[color:var(--color-fg)]'
                    }`}
                    style={
                        selected === client.slug
                            ? {
                                  backgroundColor: client.theme_color,
                                  borderColor: client.theme_color
                              }
                            : undefined
                    }
                >
                    {client.name}
                    <span className="ml-1.5 text-xs opacity-70">({client.type})</span>
                </button>
            ))}
        </div>
    );
}
