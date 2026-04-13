# Changelog

## [0.3.0] - 2026-04-13

### Added

- Add tool `buildQuery`, which is toggled by env variable, `TOOL_BUILD_QUERY_ENABLED`. Tool is turned off by default.

### Changed

- **Breaking:** Rename env variable `TOOL_CHART_BUILDER_NARRATIVE_ENABLED` to `TOOL_BUILD_CHART_NARRATIVE_ENABLED`
- **Breaking:** Rename env variable `TOOL_CHART_BUILDER_MCP_APP_ENABLED` to `MCP_APP_ENABLED`, which toggles MCP APP for all tools that support it (e.g, `buildChart` and soon `buildDashboard`)

## [0.2.9] - 2026-04-09

### Changed

- Remove credentials from `buildChart` tool response `_meta`; chart payload is now stored server-side and fetched by the analytics app via MCP resource

## [0.2.7] - 2026-03-19

### Changed

- Upgrade `@sisense/sdk-ai-core` to v0.6.2
- Restore telemetry headers

## [0.2.6] - 2026-03-12

### Changed

- Update dependencies and improve build scripts for production (SNS-0)

## [0.2.5] - 2026-03-12

### Changed

- Update end-to-end tests and add visual test case for analytics app rendering

## [0.2.4] - 2026-03-12

### Changed

- Extend `buildChart` to support narrative disabling

## [0.2.3] - 2026-03-12

### Changed

- Roll back telemetry headers due to issue with `@sisense/sdk-ai-core` v0.6.1

## [0.2.2] - 2026-03-04

### Changed

- Add `server.json` for MCP Registry

## [0.2.1] - 2026-03-04

### Changed

- Adjust `package.json` to register to MCP Registry

## [0.2.0] - 2026-02-24

### Added

- Extend `buildChart` tool to support MCP Apps

## [0.1.0] - 2025-12-23

_Initial release._
