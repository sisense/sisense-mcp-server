import {
  ChartWidget,
  SisenseContextProvider,
  SisenseContextProviderProps,
  type ChartWidgetProps,
} from '@sisense/sdk-ui';
import { CustomSuperJSON } from '@sisense/sdk-ui/analytics-composer';

export interface WidgetStoryProps {
  serializedConfig: string;
}

/**
 * Widget wrapper component for browser-based rendering
 * This file only runs in browser context via Playwright CT, so CustomSuperJSON import is safe
 */
export const WidgetStory = ({ serializedConfig }: WidgetStoryProps) => {
  // Deserialize in the browser where SDK can properly restore object prototypes
  const config = CustomSuperJSON.parse(serializedConfig) as {
    widgetProps: ChartWidgetProps;
    sisenseContextProviderProps: SisenseContextProviderProps;
    width?: number;
    height?: number;
  };
  const widgetProps: ChartWidgetProps = config.widgetProps;
  const width = config.width || 1000;
  const height = config.height || 600;

  return (
    <SisenseContextProvider {...config.sisenseContextProviderProps}>
      <div
        data-test-id="widget-container"
        style={{
          width: `${width}px`,
          height: `${height}px`,
          backgroundColor: '#ffffff',
        }}
      >
        <ChartWidget
          {...widgetProps}
          onBeforeRender={(highchartsOptions: any) => {
            // Safely disable animations for faster rendering
            if (highchartsOptions?.chart) {
              highchartsOptions.chart.animation = false;
            }

            // Disable animations for all series types (column, line, pie, etc.)
            if (highchartsOptions?.plotOptions) {
              Object.keys(highchartsOptions.plotOptions).forEach((seriesType) => {
                if (highchartsOptions.plotOptions[seriesType]) {
                  highchartsOptions.plotOptions[seriesType].animation = false;
                }
              });
            }

            return highchartsOptions;
          }}
        />
      </div>
    </SisenseContextProvider>
  );
};
