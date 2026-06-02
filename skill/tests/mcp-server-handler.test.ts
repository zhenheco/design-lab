import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleGetContextTool } from '../mcp/server.ts';

async function withEnv<T>(overrides: Record<string, string>, run: () => Promise<T>): Promise<T> {
    const previous = new Map<string, string | undefined>();
    for (const [key, value] of Object.entries(overrides)) {
        previous.set(key, process.env[key]);
        process.env[key] = value;
    }

    try {
        return await run();
    } finally {
        for (const [key, value] of previous.entries()) {
            if (value === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = value;
            }
        }
    }
}

test('MCP get_context tool handler returns fail-soft error when sidecar is unavailable', async () => {
    const result = await withEnv(
        { DESIGN_LAB_SIDECAR_URL: 'http://127.0.0.1:1' },
        () => handleGetContextTool({})
    );

    assert.deepEqual(result, {
        content: [{ type: 'text', text: 'design-lab sidecar unavailable' }],
        isError: true
    });
});
