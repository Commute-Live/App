# Project notes for Claude

## Do not spend time on writing or changing or adding new test cases

## Datadog logs via curl

When Nikul says **"curl datadog"** (or "curl dd", "check dd logs", etc.), use this section verbatim — don't re-derive the command or re-ask for service names.
His Device ID is = esp32-B44AC2F16E20

### DD services in this project

| Service | What it is |
| --- | --- |
| `device-controller` | Backend → ESP push service. What gets sent to hardware displays. |
| `commutelive-api` | Backend API serving the mobile app. |
| `commutelive-mobile` | Mobile app client-side telemetry (set via `lib/datadog.ts`). |
| `commutelive-nginx` | Ingress. Highest volume — usually not what you want. |
| `commutelive-redis` | Redis instance logs. |
| `commutelive-postgres` | Postgres instance logs. |

DD site is `us5.datadoghq.com` (US5 region — not the default `datadoghq.com`).

### Keys

Keys live in `.env` (gitignored) as `DD_API_KEY` and `DD_APP_KEY`. Load both into the shell with:

```bash
export $(grep -E '^DD_(API|APP)_KEY=' .env | xargs)
```

### Ready-to-run curl

Default shape: last **2 minutes**, 3 most recent logs, `jq`-trimmed to the fields that matter. Keeps token cost ~1–2k per call.

```bash
cd /Users/nikul/Desktop/commute-live/App && \
  export $(grep -E '^DD_(API|APP)_KEY=' .env | xargs) && \
  curl -s -X POST 'https://api.us5.datadoghq.com/api/v2/logs/events/search' \
    -H "DD-API-KEY: $DD_API_KEY" \
    -H "DD-APPLICATION-KEY: $DD_APP_KEY" \
    -H "Content-Type: application/json" \
    -d '{"filter":{"query":"service:device-controller","from":"now-2m","to":"now"},"sort":"-timestamp","page":{"limit":3}}' \
  | jq '.data[].attributes | {ts:.timestamp, msg:(.message|tostring)[:400], attrs:.attributes}'
```

Swap `service:device-controller` for whichever service is relevant.

### Common query variants

- **Errors only**: `"query":"service:device-controller status:error"`
- **Specific device**: `"query":"service:device-controller @device_id:<mac-or-id>"`
- **Wider window**: `"from":"now-15m"` (or `now-1h`, `now-24h`)
- **More logs**: `"page":{"limit":10}` — but bump only when needed; 3 is usually enough to diagnose.
- **Side-by-side comparison** (ESP payload vs app): run once with `service:device-controller`, again with `service:commutelive-api`, diff the `msg`/`attrs` fields.

### Token-saving conventions

- Always include a `service:` filter. Never query without one.
- Keep `page.limit` at 1 unless you specifically need more.
- Always pipe through `jq` — never dump raw DD response. Raw response per log is ~1–2k tokens of mostly noise.
- Trim `message` to `[:400]` unless the full body is critical.
- Prefer short time windows (`now-2m`, `now-15m`). Wider windows = more logs = more tokens.
