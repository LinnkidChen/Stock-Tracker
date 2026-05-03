# Documentation Index

This directory is the contributor and agent system of record for Stock Tracker.
Keep the README product-facing and put durable development guidance here.

## Core Documents

- [Architecture](ARCHITECTURE.md): current app layout, runtime boundaries, data
  flow, and integration points.
- [Development](DEVELOPMENT.md): setup, environment variables, package scripts,
  and planning workflow.
- [Reliability](RELIABILITY.md): validation, logging, tracing, error handling,
  and external dependency expectations.
- [Quality](QUALITY.md): verification gates, current strengths, known gaps, and
  follow-up debt.
- [Plans](plans/README.md): how active and completed implementation plans are
  stored.

## Existing References

- [Spec Kit constitution](../.specify/memory/constitution.md): repository-level
  delivery principles.
- [Longbridge OpenAPI notes](../Documents/Longbridge_OpenAPI_Doc.md): local
  reference material for the market data provider.
- [Watchlist schema](../database_schema/watchlist.sql): Supabase table and RLS
  setup.

## Operating Model

The project follows the harness-engineering idea that repository context should
be local, concise, and mechanically checked. `AGENTS.md` gives fast orientation,
these docs hold detail, and `pnpm docs:check` prevents the map from rotting.
