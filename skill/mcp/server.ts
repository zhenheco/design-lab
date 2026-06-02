import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { callSidecar, SidecarNetworkError } from './sidecar-client.ts';
import {
    addCaseInputSchema,
    addFeedbackInputSchema,
    buildAddCaseRequest,
    buildAddFeedbackRequest,
    buildCaptureUrlRequest,
    buildDistillTasteRequest,
    buildEditStyleGuideRequest,
    buildGetContextRequest,
    buildListClientsRequest,
    captureUrlInputSchema,
    distillTasteInputSchema,
    editStyleGuideInputSchema,
    getContextInputSchema,
    listClientsInputSchema,
    type AddCaseArgs,
    type AddFeedbackArgs,
    type CaptureUrlArgs,
    type DistillTasteArgs,
    type EditStyleGuideArgs,
    type GetContextArgs,
    type SidecarRequest
} from './tools.ts';

type ToolContent = { type: 'text'; text: string };
type ToolResult = { content: ToolContent[]; isError?: boolean };

function textResult(text: string, isError = false): ToolResult {
    return {
        content: [{ type: 'text', text }],
        ...(isError ? { isError: true } : {})
    };
}

function formatSidecarError(json: unknown): string {
    if (json && typeof json === 'object' && !Array.isArray(json) && 'error' in json) {
        const error = (json as { error: unknown }).error;
        if (typeof error === 'string') {
            return error;
        }
    }

    return JSON.stringify(json);
}

async function handleSidecarRequest(request: SidecarRequest): Promise<ToolResult> {
    try {
        const response = await callSidecar(request);
        if (response.status >= 400) {
            return textResult(formatSidecarError(response.json), true);
        }

        return textResult(JSON.stringify(response.json));
    } catch (error) {
        if (error instanceof SidecarNetworkError) {
            return textResult('design-lab sidecar unavailable', true);
        }

        return textResult(error instanceof Error ? error.message : String(error), true);
    }
}

export async function handleGetContextTool(args: GetContextArgs): Promise<ToolResult> {
    return handleSidecarRequest(buildGetContextRequest(args));
}

export async function handleListClientsTool(): Promise<ToolResult> {
    return handleSidecarRequest(buildListClientsRequest());
}

export async function handleAddCaseTool(args: AddCaseArgs): Promise<ToolResult> {
    return handleSidecarRequest(buildAddCaseRequest(args));
}

export async function handleCaptureUrlTool(args: CaptureUrlArgs): Promise<ToolResult> {
    return handleSidecarRequest(buildCaptureUrlRequest(args));
}

export async function handleDistillTasteTool(args: DistillTasteArgs): Promise<ToolResult> {
    return handleSidecarRequest(buildDistillTasteRequest(args));
}

export async function handleAddFeedbackTool(args: AddFeedbackArgs): Promise<ToolResult> {
    return handleSidecarRequest(buildAddFeedbackRequest(args));
}

export async function handleEditStyleGuideTool(args: EditStyleGuideArgs): Promise<ToolResult> {
    return handleSidecarRequest(buildEditStyleGuideRequest(args));
}

export function createMcpServer(): McpServer {
    const server = new McpServer({ name: 'design-lab', version: '0.4.0' });

    server.registerTool(
        'get_context',
        {
            description: 'Read retrieval-scoped design-lab context from the local sidecar.',
            inputSchema: getContextInputSchema
        },
        (args) => handleGetContextTool(args)
    );

    server.registerTool(
        'list_clients',
        {
            description: 'List design-lab clients from the local sidecar.',
            inputSchema: listClientsInputSchema
        },
        () => handleListClientsTool()
    );

    server.registerTool(
        'add_case',
        {
            description: 'Capture a positive or negative design case by forwarding a source image path to the sidecar.',
            inputSchema: addCaseInputSchema
        },
        (args) => handleAddCaseTool(args)
    );

    server.registerTool(
        'add_feedback',
        {
            description: 'Append design feedback to the sidecar feedback log.',
            inputSchema: addFeedbackInputSchema
        },
        (args) => handleAddFeedbackTool(args)
    );

    server.registerTool(
        'edit_style_guide',
        {
            description: 'Edit the global or brand-specific design-lab style guide.',
            inputSchema: editStyleGuideInputSchema
        },
        (args) => handleEditStyleGuideTool(args)
    );

    server.registerTool(
        'capture_url',
        {
            description: 'Paste a URL to screenshot it, extract live computed design tokens, and save it as a design-lab case for the selected brand.',
            inputSchema: captureUrlInputSchema
        },
        (args) => handleCaptureUrlTool(args)
    );

    server.registerTool(
        'distill_taste',
        {
            description: 'Cluster a brand\'s accumulated like/dislike aspects + feedback into NEVER-rule / style-note candidates (deterministic; does not write). Hermes drafts the rule text and the user approves before edit_style_guide persists it.',
            inputSchema: distillTasteInputSchema
        },
        (args) => handleDistillTasteTool(args)
    );

    return server;
}

export async function main(): Promise<void> {
    const server = createMcpServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
}

const isDirectRun = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;

if (isDirectRun) {
    main().catch((error) => {
        console.error(error);
        process.exit(1);
    });
}
