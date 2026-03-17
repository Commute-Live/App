# Commute Live App (Docker)

Run the Expo app in a reproducible containerized environment.

## Requirements

- Docker Desktop (or Docker Engine + Compose)

## Start

From `App/`:

```bash
npm run docker:start
```

Then scan the QR code shown in logs with Expo Go on your phone.

## Stop

```bash
npm run docker:stop
```

## Rebuild cleanly

```bash
npm run docker:reset
```

## Notes

- Dependencies are installed with `npm ci` from `package-lock.json` for consistent installs.
- Source code is bind-mounted for live reload.
- If file change detection is flaky on your machine, polling is already enabled in `docker-compose.yml`.
- If you see orphan warnings, run with `--remove-orphans`.
- The container starts Expo with `--tunnel` so phone access works even when LAN discovery is unreliable.
- If you prefer direct Docker commands, `docker compose up --build` works the same as `npm run docker:start`.

$uncodixfy load frontend skill for model