import { describe, it, expect } from 'bun:test';
import { createMockMcpFixture } from '@/__test-helpers__/mock-mcp-fixture.js';

describe('MCP Server - Prompts via Client', () => {
  it('lists 4 prompts', async () => {
    const { client } = await createMockMcpFixture();

    const result = await client.listPrompts();

    expect(result.prompts).toHaveLength(4);
  });

  it('each prompt has name, description', async () => {
    const { client } = await createMockMcpFixture();

    const result = await client.listPrompts();

    for (const prompt of result.prompts) {
      expect(prompt.name).toBeTruthy();
      expect(prompt.description).toBeTruthy();
    }
  });

  it('getPrompt for analyze-data-source returns structured messages', async () => {
    const { client } = await createMockMcpFixture();

    const result = await client.getPrompt({
      name: 'sisense.analyze-data-source',
      arguments: { dataSourceTitle: 'Test Source' },
    });

    expect(result.messages).toBeArray();
    expect(result.messages.length).toBeGreaterThan(0);

    for (const msg of result.messages) {
      expect(msg.role).toBe('assistant');
      expect(msg.content).toBeDefined();
    }
  });

  it('getPrompt for compare-metrics handles optional groupBy', async () => {
    const { client } = await createMockMcpFixture();

    const result = await client.getPrompt({
      name: 'sisense.compare-metrics',
      arguments: {
        dataSourceTitle: 'Test Source',
        metrics: 'revenue, costs',
        groupBy: 'region',
      },
    });

    expect(result.messages.length).toBeGreaterThan(0);
    const text = result.messages[0].content as { type: string; text: string };
    expect(text.text).toContain('region');
  });
});
