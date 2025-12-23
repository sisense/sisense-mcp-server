import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { type ChartWidgetProps, type SisenseContextProviderProps } from '@sisense/sdk-ui';
import { renderChartWidgetWithPlaywrightCT } from './widget-ct-runner.js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// S3 client for uploading screenshots (shared across instances)
const s3Client = process.env.SCREENSHOTS_BUCKET
  ? new S3Client({ region: process.env.AWS_REGION || 'us-east-1' })
  : null;

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
  sisenseUrl: string;
  sisenseToken: string;
  baseUrl: string;
}) {
  const {
    widgetProps,
    width = 800,
    height = 500,
    outputName,
    maxRetries = 2,
    sisenseUrl,
    sisenseToken,
    baseUrl,
  } = args;

  const sisenseContextProviderProps: SisenseContextProviderProps = {
    url: sisenseUrl,
    token: sisenseToken,
    showRuntimeErrors: true,
  };

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

      if (!result.pngPath) {
        throw new Error('Widget rendering succeeded but no output path was returned');
      }

      const imageBuffer = readFileSync(result.pngPath);

      // Extract filename using path.basename for cross-platform compatibility
      const filename = basename(result.pngPath);
      if (!filename) {
        throw new Error(`Invalid screenshot path: ${result.pngPath}`);
      }

      // Upload to S3 if configured (for multi-instance support)
      if (s3Client && process.env.SCREENSHOTS_BUCKET) {
        const bucket = process.env.SCREENSHOTS_BUCKET;
        try {
          await s3Client.send(
            new PutObjectCommand({
              Bucket: bucket,
              Key: filename,
              Body: imageBuffer,
              ContentType: 'image/png',
            }),
          );
          console.info('Screenshot uploaded to S3', { bucket, filename });
        } catch (s3Error) {
          console.error('Failed to upload screenshot to S3', {
            bucket,
            filename,
            error: s3Error instanceof Error ? s3Error.message : String(s3Error),
          });
          throw new Error(
            `S3 upload failed: ${s3Error instanceof Error ? s3Error.message : String(s3Error)}`,
          );
        }
      }

      // Always return the proxy URL - server handles S3 or local fallback
      const publicUrl = `${baseUrl.replace(/\/$/, '')}/screenshots/${filename}`;

      console.info('Widget rendered successfully', {
        outputPath: result.pngPath,
        imageSize: imageBuffer.length,
        publicUrl,
        timings: result.timings,
      });

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
        publicUrl,
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
