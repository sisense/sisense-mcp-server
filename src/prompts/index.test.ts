import { describe, it, expect } from 'bun:test';
import { createMockMcpFixture } from '@/__test-helpers__/mock-mcp-fixture.js';

describe('registerPrompts', () => {
  it('registers 4 prompts', async () => {
    const { client } = await createMockMcpFixture();

    const result = await client.listPrompts();

    expect(result.prompts).toHaveLength(4);
  });

  it('registers expected prompt names', async () => {
    const { client } = await createMockMcpFixture();

    const result = await client.listPrompts();
    const names = result.prompts.map((p) => p.name).sort();

    expect(names).toEqual([
      'sisense.analyze-data-source',
      'sisense.compare-metrics',
      'sisense.create-dashboard-report',
      'sisense.executive-kpi-inquiry',
    ]);
  });

  it('analyze-data-source prompt returns messages', async () => {
    const { client } = await createMockMcpFixture();

    const result = await client.getPrompt({
      name: 'sisense.analyze-data-source',
      arguments: { dataSourceTitle: 'Sample ECommerce' },
    });

    expect(result.messages).toBeDefined();
    expect(result.messages.length).toBeGreaterThan(0);
    expect(result.description).toContain('Sample ECommerce');
  });

  it('executive-kpi-inquiry prompt extracts intent', async () => {
    const { client } = await createMockMcpFixture();

    const result = await client.getPrompt({
      name: 'sisense.executive-kpi-inquiry',
      arguments: {
        query: 'How is revenue trending this quarter?',
        dataSourceTitle: 'Sample ECommerce',
      },
    });

    expect(result.messages.length).toBeGreaterThan(0);
    const text = result.messages[0].content as { type: string; text: string };
    expect(text.text).toContain('revenue');
  });

  it('create-dashboard-report prompt returns messages', async () => {
    const { client } = await createMockMcpFixture();

    const result = await client.getPrompt({
      name: 'sisense.create-dashboard-report',
      arguments: {
        dataSourceTitle: 'Sample ECommerce',
        reportTopic: 'Sales Performance',
      },
    });

    expect(result.messages.length).toBeGreaterThan(0);
    const text = result.messages[0].content as { type: string; text: string };
    expect(text.text).toContain('Sales Performance');
    expect(text.text).toContain('Sample ECommerce');
  });

  it('compare-metrics prompt lists metrics', async () => {
    const { client } = await createMockMcpFixture();

    const result = await client.getPrompt({
      name: 'sisense.compare-metrics',
      arguments: {
        dataSourceTitle: 'Sample ECommerce',
        metrics: 'revenue, costs, profit',
      },
    });

    expect(result.messages.length).toBeGreaterThan(0);
    const text = result.messages[0].content as { type: string; text: string };
    expect(text.text).toContain('revenue');
    expect(text.text).toContain('costs');
    expect(text.text).toContain('profit');
  });

  it('sanitizes control characters in prompt arguments', async () => {
    const { client } = await createMockMcpFixture();

    const result = await client.getPrompt({
      name: 'sisense.analyze-data-source',
      arguments: {
        dataSourceTitle: 'Test Source',
        topic: 'revenue\x00attempt',
      },
    });

    expect(result.messages).toBeDefined();
    const text = result.messages[0].content as { type: string; text: string };
    // Control chars should be stripped by sanitizeForText
    expect(text.text).not.toContain('\x00');
    expect(text.text).toContain('revenueattempt');
  });
});
