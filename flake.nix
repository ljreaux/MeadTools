{
  description = "MeadTools dev environment (Next.js web app + local Postgres)";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };

        # Prisma ships its own prebuilt, dynamically-linked query/schema engine
        # binaries (downloaded by `prisma generate`/`npm install`). Those
        # binaries assume a standard FHS layout (/lib64/ld-linux*, glibc at
        # the usual paths), which NixOS does not provide outside a sandbox.
        # Rather than chase nixpkgs' `prisma-engines` version against this
        # repo's Prisma client version (they are not guaranteed to match —
        # nixpkgs currently ships 7.x engines while this repo pins Prisma
        # 6.19.3), we run the whole toolchain inside an FHS environment and
        # let Prisma fetch binaries that match its own version exactly.
        fhs = pkgs.buildFHSEnv {
          name = "meadtools";

          targetPkgs = pkgs: with pkgs; [
            nodejs_22
            python3
            gcc
            gnumake
            pkg-config
            openssl
            postgresql_16
            cacert
            git
            which
            jq
          ];

          # Prisma's engine downloader specifically detects NixOS (via
          # /etc/os-release) and switches to a "linux-nixos" build target
          # that isn't published for every engine version, which 404s. We're
          # inside a full FHS sandbox where ordinary dynamically-linked glibc
          # binaries run fine, so present as a generic Linux distro and let
          # Prisma fetch its normal binaries instead.
          extraBuildCommands = ''
            cat > $out/etc/os-release <<'EOF'
            NAME="Ubuntu"
            ID=ubuntu
            ID_LIKE=debian
            PRETTY_NAME="Ubuntu 24.04 LTS"
            VERSION_ID="24.04"
            EOF
          '';

          profile = ''
            export SSL_CERT_FILE="${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt"
            export NODE_EXTRA_CA_CERTS="$SSL_CERT_FILE"

            # Local, project-scoped Postgres cluster. Mirrors the
            # credentials/port in docker-compose.yml and .env.example so
            # DATABASE_URL works unmodified, but needs no Docker daemon.
            export PGDATA="$PWD/.devdb"
            export PGHOST="$PGDATA"
            export PGPORT=54329
            export PGUSER=meadtools
            export PGDATABASE=meadtools_dev
            export DATABASE_URL="postgresql://meadtools:meadtools@localhost:$PGPORT/meadtools_dev"
            export DATABASE_DIRECT_URL="$DATABASE_URL"

            db-up() {
              if [ ! -d "$PGDATA" ]; then
                echo "==> Initializing local Postgres cluster in $PGDATA"
                initdb --auth=trust --auth-host=trust --username=meadtools --pgdata="$PGDATA" >/dev/null
                {
                  echo "listen_addresses = '127.0.0.1'"
                  echo "port = $PGPORT"
                  echo "unix_socket_directories = '$PGDATA'"
                } >> "$PGDATA/postgresql.conf"
              fi

              if ! pg_ctl status -D "$PGDATA" >/dev/null 2>&1; then
                echo "==> Starting Postgres on 127.0.0.1:$PGPORT"
                pg_ctl start -D "$PGDATA" -l "$PGDATA/postgres.log" -o "-k $PGDATA"
                for _ in $(seq 1 30); do
                  pg_isready -h 127.0.0.1 -p "$PGPORT" >/dev/null 2>&1 && break
                  sleep 0.5
                done
              fi

              if ! psql -h "$PGDATA" -p "$PGPORT" -U meadtools -d postgres -tAc \
                  "SELECT 1 FROM pg_database WHERE datname = 'meadtools_dev'" | grep -q 1; then
                echo "==> Creating meadtools_dev database"
                createdb -h "$PGDATA" -p "$PGPORT" -U meadtools meadtools_dev
              fi

              echo "==> Postgres is up (db: meadtools_dev, port: $PGPORT)"
            }

            db-down() {
              pg_ctl stop -D "$PGDATA" -m fast
            }

            db-status() {
              pg_ctl status -D "$PGDATA"
            }

            db-reset() {
              db-down 2>/dev/null || true
              rm -rf "$PGDATA"
              db-up
              npm run db:push --workspace @meadtools/web
              ALLOW_DB_RESET=true npm run db:seed --workspace @meadtools/web
            }

            project-setup() {
              set -e
              [ -d node_modules ] || npm install
              [ -f .env.local ] || cp .env.example .env.local
              [ -f apps/web/.env.local ] || cp .env.local apps/web/.env.local
              db-up
              npm run db:push --workspace @meadtools/web
              ALLOW_DB_RESET=true npm run db:seed --workspace @meadtools/web
              echo ""
              echo "==> Setup complete. Run: npm run dev"
            }

            export -f db-up db-down db-status db-reset project-setup

            cat <<'EOF'

MeadTools dev shell (Node 22, Postgres 16, no Docker required)

  project-setup   install deps, start Postgres, push schema, seed data
  db-up           start the local Postgres cluster (created on first run)
  db-down         stop it
  db-status       check if it's running
  db-reset        wipe and recreate the local database

Then: npm run dev    (http://localhost:3000)

Note: the npm scripts dev:setup / db:up / db:down / db:reset / dev:setup:reset
shell out to `docker compose` and are for the Docker-based workflow in
README.md. In this shell, use the commands above instead.

Mobile app (apps/mobile): `npm run dev:mobile` works for the Expo dev server;
native Android/iOS builds need the Android/Xcode toolchains, which this flake
does not provide.

EOF
          '';

          runScript = "bash";
        };
      in
      {
        devShells.default = fhs.env;

        apps.default = {
          type = "app";
          program = "${fhs}/bin/meadtools";
        };
      });
}
