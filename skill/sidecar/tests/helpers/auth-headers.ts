export interface AuthHeadersOptions {
    host?: string;
}

export function authHeaders(options: AuthHeadersOptions = {}): Record<string, string> {
    const token = process.env.DESIGN_LAB_API_TOKEN;
    if (!token) {
        throw new Error('DESIGN_LAB_API_TOKEN must be set for tests using authHeaders()');
    }

    return {
        'X-Design-Lab-Token': token,
        'Host': options.host ?? '127.0.0.1:5174'
    };
}
