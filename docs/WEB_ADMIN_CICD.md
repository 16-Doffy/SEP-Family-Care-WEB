# Web Admin CI/CD

The Web Admin project uses a dual-deployment strategy:
1. **GitHub Actions (`.github/workflows/web-admin.yml`)**: Runs type-checking, Next.js production builds, and Dockerfile validation to ensure code quality on Pull Requests and pushes to `main`.
2. **Vercel**: Handles the actual Preview and Production deployments automatically via Vercel Git Integration.

## GitHub Repository variables

Create these GitHub Actions variables to allow the CI to build successfully:

- `NEXT_PUBLIC_API_URL`: browser-facing API URL.
- `NEXT_PUBLIC_SOCKET_URL`: browser-facing Socket.IO URL.
- `BACKEND_API_ORIGIN`: server-side API origin used by the Next.js rewrite.

Values prefixed with `NEXT_PUBLIC_` are compiled into the browser bundle and must never contain secrets.

## Vercel Deployment

Vercel automatically detects the Next.js project inside the monorepo (`apps/web`).
Make sure to configure the same environment variables (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SOCKET_URL`, `BACKEND_API_ORIGIN`) in your Vercel Project settings.

## Triggers

- Pull requests that affect the web/shared workspace run validation (GitHub Actions) and trigger a Preview deployment (Vercel).
- Pushes to `main` run validation (GitHub Actions) and trigger a Production deployment (Vercel).
