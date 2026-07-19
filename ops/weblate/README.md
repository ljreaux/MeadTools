# MeadTools Weblate operations

Weblate has two Compose configurations:

- `compose.yml` is a local, disposable pilot. It listens only on
  `http://localhost:8088` and mounts this checkout read-only for its initial
  import.
- `compose.production.yml` is the permanent Ubuntu-host deployment. Caddy is
  its only public entry point and provides HTTPS for
  `https://translations.meadtools.com`.

The local pilot's `settings-override.py` enables the `file://` VCS scheme
solely for its read-only checkout. Do not use that override in production.

## Start

```bash
docker compose -f ops/weblate/compose.yml up -d
```

Open `http://localhost:8088` and sign in with the admin email and password in
the untracked `ops/weblate/.env.local` file. The initial administrator username
is `admin`.

## Permanent deployment

The permanent host uses the same ignored `.env.local` file shape as the pilot,
but it must contain production-specific passwords, `WEBLATE_SITE_DOMAIN`, and
the optional `OPENAI_API_KEY`. Keep that file mode `0600`; it is intentionally
ignored by Git.

On the Ubuntu host, store the deployment under `/srv/meadtools-weblate` and
use the production configuration as its `compose.yml`:

```bash
docker compose up -d
docker compose ps
```

The host must forward TCP ports 80 and 443 to Caddy. Caddy manages the TLS
certificate automatically; Weblate itself stays bound to `127.0.0.1:8088` for
SSH-tunnel troubleshooting.

Production components use `git@github.com:ljreaux/MeadTools.git` on the
`preview` branch. Weblate's own Ed25519 public key is installed as
a write-enabled GitHub deploy key; do not copy a personal SSH key into the
container.

## Backups

`backup.sh` creates a consistent PostgreSQL dump and backs it up together with
the persistent Weblate and Caddy volumes. It uses a locally cached, encrypted
restic repository which is mirrored to the offsite backup host over a dedicated
SSH account. Caches are intentionally excluded because Weblate rebuilds them.

The protected host-only `backup.env` file supplies the backup destination. It
must never be committed. Install the supplied systemd unit and timer after a
successful manual backup:

```bash
sudo install -m 0755 backup.sh /srv/meadtools-weblate/backup.sh
sudo install -m 0644 systemd/meadtools-weblate-backup.service /etc/systemd/system/
sudo install -m 0644 systemd/meadtools-weblate-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now meadtools-weblate-backup.timer
```

The timer runs daily around 03:15 local time and retains 14 daily, 8 weekly,
and 12 monthly restic snapshots. Test restoration before relying on backups.

## Pilot import

The initialized local volumes include the `MeadTools pilot` project and the two
components below. If you discard the volumes and recreate the pilot, use these
settings to add them again:

- Source repository: `file:///workspace/meadtools`
- Branch: `362-update-translation-provider`
- Source language: English
- File format: `i18next JSON file v4`

Use these component settings:

| Component | File mask | Base language file |
| --- | --- | --- |
| Default | `packages/i18n/locales/*/default.json` | `packages/i18n/locales/en/default.json` |
| Yeast table | `packages/i18n/locales/*/YeastTable.json` | `packages/i18n/locales/en/YeastTable.json` |

Do not configure a push URL or machine translation provider during a fresh
pilot import. Verify that the files are parsed and the expected English and
German strings appear before enabling write access or adding an API key.

## Operations

```bash
# Follow startup logs
docker compose -f ops/weblate/compose.yml logs -f weblate

# Stop without deleting pilot data
docker compose -f ops/weblate/compose.yml stop

# Start again
docker compose -f ops/weblate/compose.yml start
```

To discard the pilot and all of its local Weblate data, first stop the stack,
then run `docker compose -f ops/weblate/compose.yml down -v`.
