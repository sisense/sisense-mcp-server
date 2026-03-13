// IMPORTANT: Import test-setup FIRST to ensure browser mock is initialized
// before any SDK imports happen. The module-level initialization in test-setup.ts
// will run automatically when this module is imported.
import '../helpers/test-setup.js';
import { describe, it, expect, beforeAll } from 'bun:test';
import { createMcpTestFixture } from '../helpers/mcp-fixtures.js';
import { assertNoError } from '../helpers/test-utils.js';
import { setupE2ETests } from '../helpers/test-setup.js';

describe('Get Data Sources Tool E2E', () => {
  beforeAll(async () => {
    await setupE2ETests();
  });

  it(
    'should call get-data-sources tool via MCP client',
    async () => {
      // Dynamically import tool name after browser mock is initialized
      const { TOOL_NAME_GET_DATA_SOURCES } = await import('@sisense/sdk-ai-core');
      const { client } = await createMcpTestFixture();

      // Call get-data-sources tool via client.callTool()
      const result = await client.callTool({
        name: TOOL_NAME_GET_DATA_SOURCES,
        arguments: {},
      });

      // Assert: Verify call succeeds and returns content
      expect(result).toBeDefined();
      assertNoError(result);

      // Verify successful response has content
      if ('content' in result && Array.isArray(result.content)) {
        expect(result.content.length).toBeGreaterThan(0);
      } else {
        // If structured content is returned instead
        expect(result).toBeTruthy();
      }
    },
    { timeout: 60000 },
  );
});
