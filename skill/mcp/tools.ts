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

export const captureUrlInputSchema = {
    url: z.string(),
    client: z.string(),
    scenario: z.enum(['landing', 'saas-ui', 'brand', 'content']),
    quote: z.string(),
    sentiment: z.enum(['positive', 'negative']).optional(),
    slug: z.string().optional()
};

export type CaptureUrlArgs = z.infer<z.ZodObject<typeof captureUrlInputSchema>>;

export const listClientsInputSchema = {};

export const getContextInputSchema = {
    client: z.string().optional(),
    scenario: z.string().optional()
};

export type GetContextArgs = z.infer<z.ZodObject<typeof getContextInputSchema>>;

export const addFeedbackInputSchema = {
    signal: z.string(),
    user_quote: z.string(),
    client: z.string().optional(),
    case_slug: z.string().optional(),
    dimension: z.string().optional(),
    derived_rule: z.string().optional()
};

export type AddFeedbackArgs = z.infer<z.ZodObject<typeof addFeedbackInputSchema>>;

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

export function buildCaptureUrlRequest(args: CaptureUrlArgs): SidecarRequest {
    return {
        method: 'POST',
        path: '/api/capture/url',
        body: args
    };
}

export function buildListClientsRequest(): SidecarRequest {
    return {
        method: 'GET',
        path: '/api/clients'
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

export function buildAddFeedbackRequest(args: AddFeedbackArgs): SidecarRequest {
    return {
        method: 'POST',
        path: '/api/feedback',
        body: {
            signal: args.signal,
            user_quote: args.user_quote,
            client: args.client,
            case_slug: args.case_slug,
            dimension: args.dimension,
            derived_rule: args.derived_rule
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
