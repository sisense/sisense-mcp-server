import { describe, it, expect } from 'bun:test';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { DEFAULT_TOOL_FAILURE_FALLBACK, deriveToolFailureMessage } from './tool-result-message.js';

describe('deriveToolFailureMessage', () => {
  it('returns MCP error text unchanged when there is no parseable issue list', () => {
    const validationText =
      'MCP error -32602: Input validation error: Invalid arguments for tool buildChart';
    const toolResult = {
      content: [{ type: 'text' as const, text: validationText }],
      isError: true,
    } satisfies CallToolResult;

    expect(deriveToolFailureMessage(toolResult)).toBe(validationText);
  });

  it('formats issue paths with numeric Zod segments joined with dots', () => {
    const validationText = `MCP error -32602: Input validation error: Invalid arguments for tool buildChart: [
  {
    "code": "too_small",
    "minimum": 1,
    "type": "array",
    "inclusive": true,
    "exact": false,
    "message": "Array must contain at least 1 element(s)",
    "path": [
      "measures",
      0
    ]
  }
]`;
    const toolResult = {
      content: [{ type: 'text' as const, text: validationText }],
      isError: true,
    } satisfies CallToolResult;

    expect(deriveToolFailureMessage(toolResult)).toBe(
      [
        'Invalid arguments for buildChart:',
        '',
        '• measures.0: Array must contain at least 1 element(s)',
      ].join('\n'),
    );
  });

  it('formats MCP input validation issue list into a short readable message', () => {
    const validationText = `MCP error -32602: Input validation error: Invalid arguments for tool buildChart: [
  {
    "code": "invalid_type",
    "expected": "string",
    "received": "undefined",
    "path": [
      "dataSourceTitle"
    ],
    "message": "Required"
  },
  {
    "code": "invalid_type",
    "expected": "string",
    "received": "undefined",
    "path": [
      "userPrompt"
    ],
    "message": "Required"
  }
]`;
    const toolResult = {
      content: [{ type: 'text' as const, text: validationText }],
      isError: true,
    } satisfies CallToolResult;

    expect(deriveToolFailureMessage(toolResult)).toBe(
      [
        'Invalid arguments for buildChart:',
        '',
        '• dataSourceTitle: Required',
        '• userPrompt: Required',
      ].join('\n'),
    );
  });

  it('prefers structuredContent.message for tool errors', () => {
    const toolResult = {
      content: [{ type: 'text' as const, text: JSON.stringify({ success: false }) }],
      structuredContent: {
        success: false,
        chartId: undefined,
        message: 'Failed to create chart: engine timeout',
      },
      isError: true,
    } satisfies CallToolResult;

    expect(deriveToolFailureMessage(toolResult)).toBe('Failed to create chart: engine timeout');
  });

  it('extracts message from a single JSON text block when structuredContent has no message', () => {
    const body = JSON.stringify({
      success: false,
      message: 'Failed to create chart: no data',
    });
    const toolResult = {
      content: [{ type: 'text' as const, text: body }],
      isError: true,
    } satisfies CallToolResult;

    expect(deriveToolFailureMessage(toolResult)).toBe('Failed to create chart: no data');
  });

  it('uses default fallback when there is no usable message or text', () => {
    const toolResult = {
      content: [],
      structuredContent: { chartId: undefined },
    } satisfies CallToolResult;

    expect(deriveToolFailureMessage(toolResult)).toBe(DEFAULT_TOOL_FAILURE_FALLBACK);
  });

  it('uses custom fallback when provided', () => {
    const toolResult = {
      content: [],
      structuredContent: {},
    } satisfies CallToolResult;

    expect(
      deriveToolFailureMessage(toolResult, {
        fallback: 'No dashboard id was returned.',
      }),
    ).toBe('No dashboard id was returned.');
  });

  it('joins multiple text content blocks with newlines', () => {
    const toolResult = {
      content: [
        { type: 'text' as const, text: 'First line' },
        { type: 'text' as const, text: 'Second line' },
      ],
      isError: true,
    } satisfies CallToolResult;

    expect(deriveToolFailureMessage(toolResult)).toBe('First line\nSecond line');
  });
});
