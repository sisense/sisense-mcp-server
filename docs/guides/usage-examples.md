---
title: Sisense MCP Server Usage Examples
---

# Sisense MCP Server Usage Examples

This document provides practical examples of using the Sisense MCP Server tools.

> **Note:** The prompt examples below are suggested phrasings — you can word requests naturally and your AI client will invoke the right tool. The data source names (e.g., `"Sample ECommerce"`, `"StarWars_Analytics"`) come from Sisense demo instances; replace them with names from your own instance (`get my Sisense data sources`).

## Basic Examples

### List All Data Sources

**Request:**

```text
sisense: get data sources
```

**Expected response:**

```text
Available data sources: [
  "Sample ECommerce",
  "RetailDataModel",
  "StarWars_Analytics",
  ...
]
```

**Use case:** Discover what data sources are available in your Sisense instance.

### Get Fields for a Data Source

**Request:**

```text
sisense: get fields for "Sample ECommerce"
```

**Expected response:**

```text
Available data source fields: [
  {
    "id": "[Commerce.Date (Calendar)]",
    "type": "dimension",
    "title": "Date",
    "table": "Commerce",
    ...
  },
  {
    "id": "[Commerce.Revenue]",
    "type": "measure",
    "title": "Revenue",
    ...
  },
  ...
]
```

**Use case:** Understand the structure and available fields before creating charts.

## Chart Creation Examples

### Time Series Chart

**Request:**

```text
sisense: build chart for "Sample ECommerce" showing revenue over time by month
```

**Output:**

- Line or area chart with:
  - X-axis: Time (month)
  - Y-axis: Revenue
- Automatically detects trend

**Use case:** Track revenue trends, sales over time, or any time-based metrics.

### Top N Analysis

**Request:**

```text
sisense: build chart for "Sample ECommerce" showing top 10 products by sales
```

**What it creates:** A bar chart (horizontal or vertical) of the top 10 products sorted by sales revenue.

**Use case:** Identify best-performing products, customers, regions, etc.

### Comparison Chart

**Request:**

```text
sisense: build chart for "RetailDataModel" comparing sales by region
```

**What it creates:** A bar or column chart in which each bar represents a region and values represent sales.

**Use case:** Compare performance across categories, regions, segments, etc.

### Distribution Chart

**Request:**

```text
sisense: build chart for "Sample Healthcare" showing patient distribution by age group
```

**What it creates:** A pie chart or bar chart in which the segments/bars represent age groups and the values represent distribution.

**Use case:** Understand distribution, demographics, or categorical breakdowns.

### Aggregated Metrics

**Request:**

```text
sisense: build chart for "Sample ECommerce" showing total revenue by category
```

**What it creates:** A bar or column chart with a clear comparison of totals per category.

**Use case:** View totals, sums, or aggregated values by dimension.

### Trend Analysis

**Request:**

```text
sisense: build chart for "StarWars_Analytics" showing box office revenue trend over time
```

**What it creates:**

- Line chart with trend
- Time on X-axis
- Revenue on Y-axis
- May include trend line

**Use case:** Analyze trends, growth patterns, or changes over time.

## Workflow Examples

### Exploratory Data Analysis

1. Discover available data sources

   ```text
   sisense: get data sources
   ```

2. Explore a data source structure

   ```text
   sisense: get fields for "Sample ECommerce"
   ```

3. Create an initial overview chart

   ```text
   sisense: build chart for "Sample ECommerce" showing total revenue by month
   ```

4. Drill down into specific areas

   ```text
   sisense: build chart for "Sample ECommerce" showing top 10 products by revenue
   ```

5. Compare different dimensions

   ```text
   sisense: build chart for "Sample ECommerce" comparing revenue by region and category
   ```

### Performance Monitoring

1. Set up baseline metrics

   ```text
   sisense: build chart for "Sample ECommerce" showing revenue over time
   ```

2. Identify top performers

   ```text
   sisense: build chart for "Sample ECommerce" showing top 10 customers by revenue
   ```

3. Analyze trends

   ```text
   sisense: build chart for "Sample ECommerce" showing revenue trend by product category
   ```

### Business Intelligence Dashboard

1. Revenue overview

   ```text
   sisense: build chart for "Sample ECommerce" showing total revenue by month
   ```

2. Product performance

   ```text
   sisense: build chart for "Sample ECommerce" showing top products by sales
   ```

3. Customer analysis

   ```text
   sisense: build chart for "Sample ECommerce" showing customer distribution by segment
   ```

4. Regional comparison

   ```text
   sisense: build chart for "Sample ECommerce" comparing sales by region
   ```

## Advanced Examples

### Multi-Dimensional Analysis

**Request:**

```text
sisense: build chart for "Sample ECommerce" showing revenue by category and region
```

**What it creates:**

- Grouped or stacked bar chart
- Multiple dimensions
- Complex comparison

**Use case:** Analyze relationships between multiple dimensions.

### Percentage Analysis

**Request:**

```text
sisense: build chart for "Sample ECommerce" showing percentage of revenue by category
```

**What it creates:**

- Pie chart or 100% stacked bar
- Percentages instead of absolute values
- Proportional view

**Use case:** Understand proportions, market share, or relative distribution.

### Year-over-Year Comparison

**Request:**

```text
sisense: build chart for "Sample ECommerce" showing revenue comparison year over year
```

**What it creates:**

- Multi-line chart or grouped bars
- Current year vs previous year
- Time-based comparison

**Use case:** Compare performance across time periods.

### Filtered Analysis

**Request:**

```text
sisense: build chart for "Sample ECommerce" showing top products by sales in the last quarter
```

**What it creates:**

- Chart with time filter applied
- Focused on specific time period
- Top items within that period

**Use case:** Focused analysis on specific subsets of data.

## Real-World Scenarios

### E-Commerce Analytics

**Goal:** Understand sales performance

- List data sources: `sisense: get data sources`
- Get fields: `sisense: get fields for "Sample ECommerce"`
- Revenue trend: `sisense: build chart for "Sample ECommerce" showing revenue over time`
- Top products: `sisense: build chart for "Sample ECommerce" showing top 10 products by sales`
- Category breakdown: `sisense: build chart for "Sample ECommerce" showing revenue by category`

### Healthcare Analytics

**Goal:** Analyze patient data

- Get fields: `sisense: get fields for "Sample Healthcare"`
- Patient distribution: `sisense: build chart for "Sample Healthcare" showing patient distribution by age group`
- Visit trends: `sisense: build chart for "Sample Healthcare" showing hospital visits over time`
- Department comparison: `sisense: build chart for "Sample Healthcare" comparing visits by department`

### Star Wars Analytics

**Goal:** Analyze movie performance

- Get fields: `sisense: get fields for "StarWars_Analytics"`
- Box office revenue: `sisense: build chart for "StarWars_Analytics" showing top box office revenue by movie`
- Revenue over time: `sisense: build chart for "StarWars_Analytics" showing box office revenue trend`
- Character analysis: `sisense: build chart for "StarWars_Analytics" showing character appearances by movie`

## Tips for Better Results

### Be Specific in Prompts

- **Good:** `"Show me total revenue by month as a line chart"`
- **Better:** `"Show me total revenue by month with trend line, sorted chronologically"`

### Use Exact Data Source Names

Always use the exact name from `getDataSources`:

- ✅ `"Sample ECommerce"` (correct)
- ❌ `"sample ecommerce"` (wrong — case sensitive)
- ❌ `"ECommerce"` (wrong — incomplete name)

### Start Simple, Then Expand

Start with:

```text
"Show me revenue by month"
```

Then refine:

```text
"Show me revenue by month with trend"
```

Then add details:

```text
"Show me revenue by month with trend, grouped by category"
```

### Leverage Field Information

Before creating charts, check available fields:

```text
sisense: get fields for "Sample ECommerce"
```

This helps you:

- Know what dimensions are available
- Understand field names
- Plan your chart prompts

### Use Natural Language

The AI understands natural language, so be conversational.

**Good prompts:** "Show me...", "Compare...", "Display...", "What is...", "Analyze..."

### Common Patterns

**Time series**

```text
"[data source] showing [metric] over time"
"[data source] showing [metric] by [time period]"
"[data source] showing [metric] trend"
```

**Top N**

```text
"[data source] showing top [N] [items] by [metric]"
"[data source] showing best [items] by [metric]"
```

**Comparison**

```text
"[data source] comparing [metric] by [dimension]"
"[data source] showing [metric] across [dimension]"
```

**Distribution**

```text
"[data source] showing [metric] distribution by [dimension]"
"[data source] showing breakdown of [metric] by [dimension]"
```

## Error Handling Examples

### Handling Missing Data Source

**Error:** Failed to get data source fields: Data source not found

**Solution:**

1. List data sources: `sisense: get data sources`
2. Use exact name from the list
3. Retry with correct name

### Handling Invalid Prompts

**Error:** Failed to create chart: Cannot determine chart type

**Solution:**

1. Be more specific about what you want
2. Mention chart type: "as a bar chart", "as a line chart"
3. Specify dimensions and metrics clearly

## Next Steps

- Try these examples with your own data sources
- Experiment with different prompt styles
- Combine multiple charts for comprehensive analysis
- Review generated charts and refine prompts

For more information, see the [Quick start](./quickstart.md), [Configuration](./configuration.md) (server URL and flags only — not chart prompts), the [FAQ](./faq.md), and the [repository README](../../README.md).

---

Copyright © 2026 Sisense Inc. All rights reserved.
