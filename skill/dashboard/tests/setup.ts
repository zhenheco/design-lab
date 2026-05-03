import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

interface LocationMock {
    href: string;
    search: string;
    assign: ReturnType<typeof vi.fn>;
    replace: ReturnType<typeof vi.fn>;
    reload: ReturnType<typeof vi.fn>;
}

export const locationMock: LocationMock = {
    href: 'http://localhost:4322/',
    search: '',
    assign: vi.fn(),
    replace: vi.fn(),
    reload: vi.fn()
};

beforeEach(() => {
    locationMock.href = 'http://localhost:4322/';
    locationMock.search = '';
    locationMock.assign = vi.fn();
    locationMock.replace = vi.fn();
    locationMock.reload = vi.fn();
    vi.stubGlobal('location', locationMock);
});

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});
