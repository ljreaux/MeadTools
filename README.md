# MeadTools

MeadTools is an all-in-one mead, wine, and cider recipe-building calculator. It aims to have everything you need to build a recipe in one place, providing accurate estimates for volumes of fruit so you don't have to do a bunch of extra calculations.

- [MeadTools](#meadtools)
  - [Features](#features)
  - [Installation](#installation)
  - [Prerequisites](#prerequisites)
  - [Quick Start (Recommended)](#quick-start-recommended)
    - [1. Clone the repository](#1-clone-the-repository)
    - [2. Install dependencies](#2-install-dependencies)
    - [3. Run the setup script](#3-run-the-setup-script)
    - [4. Start the dev server](#4-start-the-dev-server)
  - [Manual Setup (Advanced)](#manual-setup-advanced)
  - [Database](#database)
    - [Resetting the Database](#resetting-the-database)
  - [i18n / Translations](#i18n--translations)
    - [Default behavior](#default-behavior)
    - [Optional live translation sync](#optional-live-translation-sync)
  - [Tech Stack](#tech-stack)
  - [Contributing](#contributing)
    - [Contribution Guidelines](#contribution-guidelines)
      - [MDX Content Pages](#mdx-content-pages)
  - [License](#license)
  - [Community \& Support](#community--support)

---

## Features

- Recipe Builder: Create, save, and manage your recipes.
- Extra Calculators: Various tools for calculations related to fermentation.
- User Accounts: Save recipes, manage preferences, and more.
- Public Recipe Sharing: Share recipes with other users.
- Wireless Hydrometer Integration: Connect Wireless Hydrometer devices to track fermentation data.
- API Access: API documentation is available at the /api route.

---

## Installation

MeadTools runs locally using Next.js 16, PostgreSQL, and Docker for a consistent development environment.

The recommended setup uses a Dockerized Postgres database and a one-command bootstrap script so new developers can get up and running quickly.

---

## Prerequisites

- Node.js (latest LTS recommended)
- npm
- Docker Desktop (must be running)

---

## Quick Start (Recommended)

This is the fastest and safest way to get MeadTools running locally.

### 1. Clone the repository

```bash
   git clone https://github.com/ljreaux/meadtools-nextjs-migration
   cd meadtools
```

### 2. Install dependencies

```bash
npm install
```

### 3. Run the setup script

```bash
npm run dev:setup
```

This command will:

- Create .env.local from .env.example if it doesn’t exist
- Start PostgreSQL via Docker
- Wait for the database to become healthy
- Push the Prisma schema
- Seed the database with test data
- Optionally pull translations from i18nexus (if a key is present)

### 4. Start the dev server

```bash
npm run dev
```

- App: http://localhost:3000
- Prisma Studio opens automatically

---

## Manual Setup (Advanced)

If you prefer to run steps individually:

```bash
    npm run db:up
    npx prisma db push
    ALLOW_DB_RESET=true npx prisma db seed
    npm run dev
```

---

## Database

MeadTools uses PostgreSQL locally via Docker.

- The database is fully disposable
- No local PostgreSQL installation is required
- Schema is managed via prisma db push
- Seed data is deterministic and safe-guarded

### Resetting the Database

To completely wipe and reseed the local database:

```bash
npm run db:reset
```

WARNING: This deletes all local data.  
The command is protected by an environment guard and will not run against production databases.

---

## i18n / Translations

MeadTools uses i18nexus for translation management.

### Default behavior

- Translations are loaded from local JSON files under locales/
- No API key is required to run the app

### Optional live translation sync

If you have access to i18nexus:

1. Add your key to .env.local

```bash
I18NEXUS_API_KEY=your_key_here
```

1. Run:

```bash
npm run dev:i18n
```

This will:

- Pull translations
- Listen for updates
- Update local locale files automatically

---

## Tech Stack

- **Next.js 16**
- **React 19**
- **TypeScript**
- **Prisma**
- **PostgreSQL** (Dockerized for local development)
- **NextAuth** (Google auth optional; recommended disabled in dev)
- **Custom Auth** (access + refresh token strategy)
- **ShadCN UI / Radix UI**
- **Tailwind CSS**
- **i18next + react-i18next**
- **i18nexus** (optional for translation sync)
- **MDX** (for lightweight content pages like release notes)

---

## Contributing

Contributions are welcome.

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Open a pull request

### Contribution Guidelines

- Follow existing code style (default Prettier config)
- Document new features
- Test changes locally before submitting

#### MDX Content Pages

This repo supports lightweight content pages written in MDX (Markdown + React components).

- MDX files are used for simple content like release notes.
- Currently, the only MDX page in the app is the **3.5 release notes**, and it is **English-only**.
- MDX supports GitHub-flavored Markdown and can render React components as needed.

Notes:

- Existing routes will not be overwritten
- Be careful about file/route naming to avoid conflicts

---

## License

This project is licensed under the MIT License.

---

## Community & Support

Join the community on [Discord](https://discord.gg/Wbx9DWWqFC) to discuss features, get help, and contribute:

---

MeadTools is also [live here](https://meadtools.com).
