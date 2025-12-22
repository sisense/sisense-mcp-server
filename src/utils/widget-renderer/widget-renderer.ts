import { readFileSync } from 'node:fs';
import { type ChartWidgetProps } from '@sisense/sdk-ui';
import { getSisenseContextProviderProps } from '@/initialize-sisense-clients.js';
import { normalizeUrl } from '@sisense/sdk-ai-core';
import { renderChartWidgetWithPlaywrightCT } from './widget-ct-runner.js';

/**
 * Render a chart from WidgetProps using Playwright Component Testing
 * This method properly handles CSDK objects with CustomSuperJSON serialization
 */
export async function renderChartWidget(args: {
  widgetProps: ChartWidgetProps;
  width?: number;
  height?: number;
  outputName?: string;
  maxRetries?: number;
}) {
  const { widgetProps, width = 800, height = 500, outputName, maxRetries = 2 } = args;

  const sisenseContextProviderProps = getSisenseContextProviderProps();

  console.info('Rendering chart from WidgetProps', {
    chartType: widgetProps.chartType,
    title: widgetProps.title,
    width,
    height,
  });

  let lastError: Error | null = null;

  // Retry logic
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        console.info(`Retry attempt ${attempt}/${maxRetries}`);
      }

      const result = await renderChartWidgetWithPlaywrightCT({
        widgetProps,
        sisenseContextProviderProps,
        width,
        height,
        outputName: outputName || widgetProps.title || 'widget',
      });

      if (!result.success) {
        throw new Error(result.error || 'Widget rendering failed');
      }

      console.info('Reading generated widget image', {
        path: result.pngPath,
      });

      const imageBuffer = readFileSync(result.pngPath);
      const base64Image = imageBuffer.toString('base64');

      console.info('Widget rendered successfully', {
        outputPath: result.pngPath,
        imageSize: imageBuffer.length,
        timings: result.timings,
      });

      // Extract filename from path for public URL
      const filename = result.pngPath.split('/').pop();
      const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
      const publicUrl = normalizeUrl(`${baseUrl}/screenshots/${filename}`);
      const resourceUri = `sisense://charts/${filename}`;

      const toolResult = {
        content: [
          {
            type: 'text' as const,
            text: publicUrl,
          },
        ],
      };

      console.info('>>> CHART TOOL RESULT', {
        contentCount: toolResult.content.length,
        contentTypes: toolResult.content.map((c) => c.type),
        resourceUri: resourceUri,
        publicUrl: publicUrl,
        base64Length: base64Image.length,
        resultJson: JSON.stringify(toolResult).substring(0, 500),
      });

      return toolResult;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        console.warn(`Render attempt ${attempt + 1} failed, retrying...`, {
          error: lastError.message,
        });
        // Wait before retry (exponential backoff)
        await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
      }
    }
  }

  // All retries exhausted
  console.error('Failed to render widget after retries', {
    attempts: maxRetries + 1,
    error: lastError?.message,
    stack: lastError?.stack,
  });

  throw lastError || new Error('Widget rendering failed');
}
