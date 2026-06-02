import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const SIDECAR_URL = process.env.DESIGN_LAB_SIDECAR_URL ?? 'http://127.0.0.1:5174';
export const TOKEN_PATH =
    process.env.DESIGN_LAB_TOKEN_PATH ?? join(homedir(), '.claude/state/design-lab/api-token');

type SidecarMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type CallSidecarInput = {
    method: SidecarMethod;
    path: string;
    query?: Record<string, string | undefined>;
    body?: unknown;
    auth?: boolean;
};

export type CallSidecarResult = {
    status: number;
    json: unknown;
};

export class SidecarNetworkError extends Error {
    constructor(message: string, options?: { cause?: unknown }) {
        super(message, options);
        this.name = 'SidecarNetworkError';
    }
}

export function readToken(): string | null {
    const tokenPath = process.env.DESIGN_LAB_TOKEN_PATH ?? TOKEN_PATH;
    try {
        const token = readFileSync(tokenPath, 'utf8').trim();
        return token.length > 0 ? token : null;
    } catch {
        return null;
    }
}

function resolveBaseUrl(): string {
    return process.env.DESIGN_LAB_SIDECAR_URL ?? SIDECAR_URL;
}

function isWriteMethod(method: SidecarMethod): boolean {
    return method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';
}

function buildUrl(input: CallSidecarInput): URL {
    const url = new URL(input.path, resolveBaseUrl());
    for (const [key, value] of Object.entries(input.query ?? {})) {
        if (value !== undefined) {
            url.searchParams.set(key, value);
        }
    }
    return url;
}

function buildHeaders(input: CallSidecarInput, token: string | null): HeadersInit {
    const headers: Record<string, string> = {
        Accept: 'application/json',
        Host: new URL(resolveBaseUrl()).host
    };

    if (input.body !== undefined) {
        headers['Content-Type'] = 'application/json';
    }

    if ((input.auth ?? isWriteMethod(input.method)) && token) {
        headers['X-Design-Lab-Token'] = token;
    }

    return headers;
}

async function parseJson(response: Response): Promise<unknown> {
    const text = await response.text();
    if (!text) {
        return null;
    }

    try {
        return JSON.parse(text);
    } catch {
        return { error: text };
    }
}

async function doFetch(input: CallSidecarInput, token: string | null): Promise<CallSidecarResult> {
    const response = await fetch(buildUrl(input), {
        method: input.method,
        headers: buildHeaders(input, token),
        body: input.body === undefined ? undefined : JSON.stringify(input.body)
    });

    return {
        status: response.status,
        json: await parseJson(response)
    };
}

export async function callSidecar(input: CallSidecarInput): Promise<CallSidecarResult> {
    try {
        const first = await doFetch(input, readToken());
        if (first.status !== 401) {
            return first;
        }

        return await doFetch(input, readToken());
    } catch (error) {
        throw new SidecarNetworkError('design-lab sidecar unavailable', { cause: error });
    }
}
