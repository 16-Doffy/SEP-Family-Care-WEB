# Web admin CI/CD

Workflow `.github/workflows/web-admin.yml` validates the pnpm workspace, publishes
an immutable web image to GitHub Container Registry (GHCR), and deploys that exact
image to the production VPS.

## Repository variables

Create these GitHub Actions variables:

- `NEXT_PUBLIC_API_URL`: browser-facing API URL.
- `NEXT_PUBLIC_SOCKET_URL`: browser-facing Socket.IO URL.
- `BACKEND_API_ORIGIN`: server-side API origin used by the Next.js rewrite.

Values prefixed with `NEXT_PUBLIC_` are compiled into the browser bundle and must
never contain secrets.

## Production environment secrets

Create a GitHub Environment named `production`, optionally require a reviewer,
and add:

- `VPS_HOST`
- `VPS_PORT` (normally `22`)
- `VPS_USER`
- `VPS_SSH_KEY`
- `VPS_APP_DIR`: absolute directory on the VPS containing `docker-compose.prod.yml`
- `GHCR_READ_TOKEN`: fine-grained token that can read this repository's packages

The VPS must already have Docker Compose, `docker-compose.prod.yml`, and its
production `.env.prod`. The deploy job changes only the `web` service and leaves
the API, PostgreSQL, and Redis services untouched.

## Triggers

- Pull requests that affect the web/shared workspace run validation only.
- Pushes to `main` run validation, publish the image, and deploy production.
- Manual dispatch performs the same release pipeline.

Production secrets should be protected with GitHub Environment approvals. Do not
put passwords, tokens, private keys, or `.env.prod` in the repository.
