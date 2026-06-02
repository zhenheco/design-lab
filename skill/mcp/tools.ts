import { z } from 'zod';

export type SidecarRequest = {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    path: string;
    query?: Record<string, string | undefined>;
    body?: unknown;
};

export const addCaseInputSchema = {
    client: z.string(),
    slug: z.string(),
    sentiment: z.enum(['positive', 'negative']),
    scenario: z.enum(['landing', 'saas-ui', 'brand', 'content']),
    quote: z.string(),
    sourceImagePath: z.string(),
    tokens: z.unknown().optional()
};

export type AddCaseArgs = z.infer<z.ZodObject<typeof addCaseInputSchema>>;

export const getContextInputSchema = {
    client: z.string().optional(),
    scenario: z.string().optional()
};

export type GetContextArgs = z.infer<z.ZodObject<typeof getContextInputSchema>>;

export const editStyleGuideInputSchema = {
    brand: z.string().optional(),
    content: z.string(),
    expectedHash: z.string().optional()
};

export type EditStyleGuideArgs = z.infer<z.ZodObject<typeof editStyleGuideInputSchema>>;

export function buildAddCaseRequest(args: AddCaseArgs): SidecarRequest {
    return {
        method: 'POST',
        path: '/api/cases',
        body: {
            client: args.client,
            slug: args.slug,
            sentiment: args.sentiment,
            scenario: args.scenario,
            quote: args.quote,
            sourceImagePath: args.sourceImagePath,
            tokens: args.tokens
        }
    };
}

export function buildGetContextRequest(args: GetContextArgs): SidecarRequest {
    return {
        method: 'GET',
        path: '/api/context',
        query: {
            client: args.client,
            scenario: args.scenario
        }
    };
}

export function buildEditStyleGuideRequest(args: EditStyleGuideArgs): SidecarRequest {
    return {
        method: 'POST',
        path: args.brand
            ? `/api/clients/${encodeURIComponent(args.brand)}/style-guide`
            : '/api/style-guide',
        body: {
            content: args.content,
            expectedHash: args.expectedHash
        }
    };
}
