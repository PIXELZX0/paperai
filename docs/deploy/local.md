# Local Deploy

## Quick start

1. Run `paperai onboard --yes`
2. If you want to inspect the generated operating config, open `~/.paperai/config.json`
3. Run `paperai update` after pulling a newer PaperAI version
4. Run `paperai doctor`

`paperai onboard --yes` writes the local operating config, starts embedded Postgres by default, pushes the schema, and launches the server with the current web build.

## Commands

- `paperai onboard`
- `paperai configure database`
- `paperai configure server`
- `paperai configure auth`
- `paperai update`
- `paperai doctor`
- `paperai run`
- `paperai db:backup`
- `papercli company org`
- `papercli company cost-overview`
- `papercli workspace create-project`
- `papercli workspace create-execution`
- `papercli skill scan`
- `papercli secret create`
- `papercli plugin health`

## Embedded Postgres

- Default mode is `embedded-postgres`
- Data directory defaults to `~/.paperai/data/postgres`
- Backups default to `~/.paperai/backups`

If your package manager blocks native postinstall scripts, the embedded Postgres binary may not be available yet. In that case, approve the build for `@embedded-postgres/*` and re-run install.

## External Postgres

To switch to an external database:

```bash
paperai configure database --mode postgres --database-url postgres://user:pass@host:5432/paperai
```

## Smoke

Run a lightweight release smoke against a running instance:

```bash
pnpm smoke:release:local
```

If you also provide `PAPERAI_TOKEN` and `PAPERAI_COMPANY_ID`, the smoke run will additionally probe org, cost, skill, plugin, and workspace endpoints.
