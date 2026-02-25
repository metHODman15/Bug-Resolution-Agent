/**
 * Unified LLM client — routes to Anthropic or Grok based on the API key prefix.
 *
 * Anthropic keys  → sk-ant-…   → claude-sonnet-4-20250514 (vision via base64 image blocks)
 * Grok / xAI keys → xai-…      → grok-2-vision-1212 (images) / grok-3 (text-only)
 *                                 OpenAI-compatible endpoint at https://api.x.ai/v1
 *
 * Grok vision confirmed at docs.x.ai:
 *   - Supported formats: jpg/jpeg, png  (max 20 MiB each)
 *   - image_url content block with base64 data URL, detail: "high"
 *   - Model grok-2-vision-1212 for image requests, grok-3 for text-only
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI    from 'openai';

// ─── public types ─────────────────────────────────────────────────────────────

export type LlmProvider = 'anthropic' | 'grok';

export interface LlmMessage {
    role: 'user' | 'assistant';
    content: string;
}

export interface LlmStreamParams {
    system:    string;
    messages:  LlmMessage[];
    /** Base64 data-URLs (e.g. `data:image/jpeg;base64,…`) attached to the last user message. */
    images?:   string[];
    maxTokens?: number;
}

// ─── public API ───────────────────────────────────────────────────────────────

/** Returns 'grok' for xai- keys, 'anthropic' for everything else. */
export function detectProvider(key: string): LlmProvider {
    return key.startsWith('xai-') ? 'grok' : 'anthropic';
}

/**
 * Stream a completion from the appropriate provider.
 * `onChunk` is called for every incremental text delta.
 * Returns the full accumulated text.
 */
export async function streamText(
    key: string,
    params: LlmStreamParams,
    onChunk: (text: string) => void,
): Promise<string> {
    return detectProvider(key) === 'grok'
        ? _streamGrok(key, params, onChunk)
        : _streamAnthropic(key, params, onChunk);
}

// ─── Anthropic ────────────────────────────────────────────────────────────────

function _buildAnthropicContent(
    text: string,
    images: string[],
): Anthropic.MessageParam['content'] {
    if (!images.length) { return text; }

    type ImgBlock  = { type: 'image'; source: { type: 'base64'; media_type: string; data: string } };
    type TextBlock = { type: 'text';  text: string };
    const blocks: Array<ImgBlock | TextBlock> = images.map(dataUrl => {
        const [meta, data] = dataUrl.split(',');
        const mediaType = meta.match(/image\/(jpeg|png|gif|webp)/)?.[0] ?? 'image/jpeg';
        return { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType, data } };
    });
    if (text) { blocks.push({ type: 'text', text }); }
    return blocks as Anthropic.MessageParam['content'];
}

async function _streamAnthropic(
    key: string,
    params: LlmStreamParams,
    onChunk: (text: string) => void,
): Promise<string> {
    const client  = new Anthropic({ apiKey: key });
    const lastIdx = params.messages.length - 1;

    const msgs: Anthropic.MessageParam[] = params.messages.map((m, i) => {
        const imgs = (i === lastIdx && m.role === 'user') ? (params.images ?? []) : [];
        return { role: m.role, content: _buildAnthropicContent(m.content, imgs) };
    });

    let full = '';
    const stream = client.messages.stream({
        model:      'claude-sonnet-4-20250514',
        max_tokens: params.maxTokens ?? 4096,
        system:     params.system,
        messages:   msgs,
    });
    for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            full += event.delta.text;
            onChunk(event.delta.text);
        }
    }
    return full;
}

// ─── Grok (xAI — OpenAI-compatible) ──────────────────────────────────────────

type _ImagePart = { type: 'image_url'; image_url: { url: string; detail: 'high' } };
type _TextPart  = { type: 'text'; text: string };
type _GrokContent = Array<_ImagePart | _TextPart>;

function _buildGrokContent(text: string, images: string[]): string | _GrokContent {
    if (!images.length) { return text; }
    const parts: _GrokContent = images.map(dataUrl => ({
        type: 'image_url' as const,
        image_url: { url: dataUrl, detail: 'high' as const },
    }));
    if (text) { parts.push({ type: 'text' as const, text }); }
    return parts;
}

async function _streamGrok(
    key: string,
    params: LlmStreamParams,
    onChunk: (text: string) => void,
): Promise<string> {
    const client    = new OpenAI({ apiKey: key, baseURL: 'https://api.x.ai/v1' });
    const hasImages = !!(params.images?.length);
    const lastIdx   = params.messages.length - 1;

    type GrokMsg =
        | { role: 'system';    content: string }
        | { role: 'user';      content: string | _GrokContent }
        | { role: 'assistant'; content: string };

    const msgs: GrokMsg[] = [
        { role: 'system', content: params.system },
        ...params.messages.map((m, i): GrokMsg => {
            const imgs = (i === lastIdx && m.role === 'user') ? (params.images ?? []) : [];
            if (m.role === 'user') {
                return { role: 'user', content: _buildGrokContent(m.content, imgs) };
            }
            return { role: 'assistant', content: m.content };
        }),
    ];

    let full = '';
    // grok-2-vision-1212 for image requests, grok-3 for text-only
    const stream = await client.chat.completions.create({
        model:      hasImages ? 'grok-2-vision-1212' : 'grok-3',
        max_tokens: params.maxTokens ?? 4096,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        messages:   msgs as any,
        stream:     true,
    });
    for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content ?? '';
        if (text) { full += text; onChunk(text); }
    }
    return full;
}
