import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authFetch } from '../../src/lib/api';
import { locationMock } from '../setup';

describe('authFetch', () => {
    beforeEach(() => {
        document.head.innerHTML = '';
        sessionStorage.clear();
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
    });

    it('read-token-from-meta', async () => {
        const meta = document.createElement('meta');
        meta.name = 'design-lab-token';
        meta.content = 'test-token';
        document.head.appendChild(meta);

        await authFetch('/api/clients');

        const fetchMock = vi.mocked(fetch);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const init = fetchMock.mock.calls[0]?.[1];
        const headers = new Headers(init?.headers);
        expect(headers.get('X-Design-Lab-Token')).toBe('test-token');
    });

    it('fallback-when-no-meta', async () => {
        await authFetch('/api/clients');

        const fetchMock = vi.mocked(fetch);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const init = fetchMock.mock.calls[0]?.[1];
        const headers = new Headers(init?.headers);
        expect(headers.has('X-Design-Lab-Token')).toBe(false);
    });

    it('empty-meta-no-header', async () => {
        const meta = document.createElement('meta');
        meta.name = 'design-lab-token';
        meta.content = '';
        document.head.appendChild(meta);

        await authFetch('/api/clients');

        const fetchMock = vi.mocked(fetch);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const init = fetchMock.mock.calls[0]?.[1];
        const headers = new Headers(init?.headers);
        expect(headers.has('X-Design-Lab-Token')).toBe(false);
    });

    it('401-reload-once', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })));

        await authFetch('/api/clients');

        expect(sessionStorage.getItem('design-lab-reloaded')).toBe('1');
        expect(locationMock.reload).toHaveBeenCalledTimes(1);
    });

    it('401-no-reload-loop', async () => {
        sessionStorage.setItem('design-lab-reloaded', '1');
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })));

        await authFetch('/api/clients');

        expect(locationMock.reload).not.toHaveBeenCalled();
    });
});
