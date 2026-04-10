# FlowGamma — Institutional Options Flow Analyzer

FlowGamma is a real-time NSE/BSE options flow dashboard that tracks index and F&O instruments and computes five institutional flow views: Net Delta, OI Buildup, IV Skew, GEX, and Unusual Activity. This public repository showcases the product interface, API contracts, and ingestion workflow while intentionally omitting proprietary signal computation internals.

## Live Demo

https://flowgamma.vercel.app

## System Architecture

FlowGamma follows a service-oriented pipeline:

React frontend -> FastAPI backend -> PostgreSQL -> FYERS data ingestion -> Signal Engine (black box)

- React frontend renders dashboards, charts, watchlists, and history panels.
- FastAPI backend exposes API routes and response contracts consumed by the UI.
- PostgreSQL stores snapshots, candles, and historical records.
- FYERS ingestion scripts collect and refresh market data.
- Signal Engine runs proprietary computation and ranking logic (not included here).

## Tech Stack

- FastAPI
- React
- PostgreSQL
- Python
- FYERS API
- Vercel

## Repository Scope

- Included:
  - Full frontend source from the production dashboard.
  - Public backend API route definitions and Pydantic schemas.
  - Public ingestion and scheduler scripts.
- Excluded:
  - Proprietary signal computation, analytics engines, model logic, and inference code.

## Screenshot

<!-- Add dashboard screenshot here -->

## Contributing

Please review CONTRIBUTING.md before opening a pull request.

## License

This project is licensed under the MIT License. See LICENSE for details.

## Proprietary Notice

The signal computation layer is proprietary and is not included in this repository. Any routes that depend on internal analytics engines are intentionally represented as public API contracts only.
