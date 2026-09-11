# FaithTrack on Replit

## Run locally

Install the locked dependencies and start the configured preview workflow:

```bash
bun install --frozen-lockfile
bun run dev --host 0.0.0.0 --port 5000
```

The app uses Supabase for authentication and data. The environment must provide
the existing `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` values (the matching
`VITE_` variables are also supported by the browser client).

## Checks

```bash
bunx tsc --noEmit
bun run build
```

The repository currently contains pre-existing Prettier lint failures outside
the group-management fix, so avoid using the full lint command as the readiness
check until those formatting issues are addressed.