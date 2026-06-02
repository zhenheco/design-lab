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
