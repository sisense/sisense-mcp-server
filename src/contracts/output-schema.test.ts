import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { z } from 'zod';
import {
  buildChartOutputSchemaAppMode,
  buildChartOutputSchemaToolMode,
} from '@/tools/build-chart.js';
import { getDataSourcesOutputSchema } from '@/tools/get-data-sources.js';
import { getDataSourceFieldsOutputSchema } from '@/tools/get-data-source-fields.js';

let savedEnv: NodeJS.ProcessEnv;

beforeEach(() => {
  savedEnv = { ...process.env };
});

afterEach(() => {
  process.env = savedEnv;
});

describe('Output Schema Contracts', () => {
  describe('buildChart - App Mode schema', () => {
    it('validates success output', () => {
      const output = {
        success: true,
        chartId: 'chart-123',
        message: 'Chart created successfully',
        insights: 'Revenue is up 15%',
      };

      const result = buildChartOutputSchemaAppMode.safeParse(output);
      expect(result.success).toBe(true);
    });

    it('validates success output without optional fields', () => {
      const output = {
        success: true,
        message: 'Chart created successfully',
      };

      const result = buildChartOutputSchemaAppMode.safeParse(output);
      expect(result.success).toBe(true);
    });

    it('validates error output', () => {
      const output = {
        success: false,
        chartId: undefined,
        message: 'Failed to create chart: AI service unavailable',
        insights: undefined,
      };

      const result = buildChartOutputSchemaAppMode.safeParse(output);
      expect(result.success).toBe(true);
    });

    it('rejects output missing required message field', () => {
      const output = {
        success: true,
        chartId: 'chart-123',
      };

      const result = buildChartOutputSchemaAppMode.safeParse(output);
      expect(result.success).toBe(false);
    });
  });

  describe('buildChart - Tool Mode schema', () => {
    it('validates success output with imageUrl', () => {
      const output = {
        success: true,
        chartId: 'chart-123',
        message: 'Chart created successfully',
        imageUrl: 'http://localhost:3001/screenshots/chart.png',
        insights: 'Revenue is up',
      };

      const result = buildChartOutputSchemaToolMode.safeParse(output);
      expect(result.success).toBe(true);
    });

    it('validates output without imageUrl (render failed)', () => {
      const output = {
        success: true,
        chartId: 'chart-123',
        message: 'Chart created',
        imageUrl: undefined,
      };

      const result = buildChartOutputSchemaToolMode.safeParse(output);
      expect(result.success).toBe(true);
    });

    it('tool mode schema extends app mode (has imageUrl)', () => {
      // Tool mode should accept imageUrl
      const toolShape = buildChartOutputSchemaToolMode.shape;
      expect(toolShape).toHaveProperty('imageUrl');

      // App mode should NOT have imageUrl
      const appShape = buildChartOutputSchemaAppMode.shape;
      expect(appShape).not.toHaveProperty('imageUrl');
    });
  });

  describe('getDataSources schema', () => {
    it('output schema has dataSources field', () => {
      expect(getDataSourcesOutputSchema).toHaveProperty('dataSources');
    });

    it('validates array of data sources', () => {
      const schema = z.object(getDataSourcesOutputSchema);
      const result = schema.safeParse({
        dataSources: [{ title: 'Test' }],
      });
      expect(result.success).toBe(true);
    });

    it('validates empty data sources array', () => {
      const schema = z.object(getDataSourcesOutputSchema);
      const result = schema.safeParse({
        dataSources: [],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('getDataSourceFields schema', () => {
    it('output schema has dataSourceTitle and fields', () => {
      expect(getDataSourceFieldsOutputSchema).toHaveProperty('dataSourceTitle');
      expect(getDataSourceFieldsOutputSchema).toHaveProperty('fields');
    });

    it('validates output with fields', () => {
      const schema = z.object(getDataSourceFieldsOutputSchema);
      const result = schema.safeParse({
        dataSourceTitle: 'Sample ECommerce',
        fields: [{ name: 'Revenue', type: 'numeric' }],
      });
      expect(result.success).toBe(true);
    });

    it('requires dataSourceTitle to be a string', () => {
      const schema = z.object(getDataSourceFieldsOutputSchema);
      const result = schema.safeParse({
        dataSourceTitle: 123,
        fields: [],
      });
      expect(result.success).toBe(false);
    });
  });
});
