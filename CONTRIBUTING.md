# Contributing to FlowGamma (Public Mirror)

Thanks for your interest in contributing.

## Scope of this repository

This is a public mirror of non-sensitive components.

Included:
- Frontend application code.
- Public backend route contracts and request/response schemas.
- Data ingestion and operational scripts that do not contain proprietary analytics logic.

Not included:
- Signal computation internals.
- Strategy/model logic.
- Proprietary analytics/engine code.

## How to contribute

1. Open an issue describing the bug, enhancement, or documentation improvement.
2. Create a feature branch from main.
3. Keep changes focused and include clear commit messages.
4. Add or update docs when behavior changes.
5. Submit a pull request with:
   - Summary of change
   - Testing notes
   - Any screenshots (for UI work)

## Development notes

- Use environment variables for credentials.
- Do not commit secrets, tokens, private keys, or local .env files.
- Keep proprietary logic out of this repository.

## Pull request checklist

- Code builds and runs locally.
- No sensitive data is introduced.
- Changes stay within public-mirror scope.
- Documentation is updated where relevant.
