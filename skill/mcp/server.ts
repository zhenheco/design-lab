import { callSidecar, SidecarNetworkError } from './sidecar-client.ts';
import { buildGetContextRequest, type GetContextArgs } from './tools.ts';

type ToolContent = { type: 'text'; text: string };
type ToolResult = { content: ToolContent[]; isError?: boolean };

function textResult(text: string, isError = false): ToolResult {
    return {
        content: [{ type: 'text', text }],
        ...(isError ? { isError: true } : {})
    };
}

export async function handleGetContextTool(args: GetContextArgs): Promise<ToolResult> {
    try {
        const response = await callSidecar(buildGetContextRequest(args));
        if (response.status >= 400) {
            return textResult(JSON.stringify(response.json), true);
        }

        return textResult(JSON.stringify(response.json));
    } catch (error) {
        if (error instanceof SidecarNetworkError) {
            return textResult('design-lab sidecar unavailable', true);
        }

        return textResult(error instanceof Error ? error.message : String(error), true);
    }
}
