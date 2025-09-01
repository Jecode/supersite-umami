# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Umami is a privacy-focused web analytics platform that serves as an alternative to Google Analytics. It's built with Next.js 15, React 19, and supports multiple databases (PostgreSQL, MySQL, MariaDB, ClickHouse).

## Development Commands

### Essential Commands
- `pnpm dev` - Start development server
- `pnpm build` - Full production build (includes env checks, database setup, tracker build)
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint
- `pnpm test` - Run Jest tests

### Database Commands
- `pnpm run build-db` - Build database schema and client
- `pnpm run build-db-client` - Generate Prisma client
- `pnpm run update-db` - Run Prisma migrations
- `pnpm run check-db` - Verify database connection

### Build Components
- `pnpm run build-tracker` - Build tracking script (rollup)
- `pnpm run build-components` - Build component library
- `pnpm run build-geo` - Build geolocation data
- `pnpm run build-lang` - Build internationalization files

### Testing
- `pnpm run cypress-open` - Open Cypress GUI
- `pnpm run cypress-run` - Run Cypress tests headlessly

## Architecture Overview

### Database Layer
- **Multi-database support**: PostgreSQL, MySQL, MariaDB, ClickHouse
- **Database detection**: Automatic database type detection via `getDatabaseType()` in `src/lib/db.ts`
- **Query abstraction**: `runQuery()` function routes to appropriate database implementation
- **Prisma ORM**: Used for PostgreSQL/MySQL, with schemas in `db/postgresql/` and `db/mysql/`
- **ClickHouse**: Direct SQL queries for high-volume analytics in `src/queries/sql/`

### Application Structure
- **Next.js App Router**: Modern file-based routing in `src/app/`
- **API Routes**: RESTful endpoints in `src/app/api/`
- **Components**: Reusable UI components in `src/components/`
- **Query Layer**: Database queries abstracted in `src/queries/`
- **Tracker**: Privacy-focused tracking script in `src/tracker/`

### Key Directories
- `src/app/` - Next.js app router pages and layouts
- `src/components/` - Reusable React components
- `src/lib/` - Utility functions and shared logic
- `src/queries/` - Database query abstractions
- `src/store/` - Zustand state management
- `db/` - Database schemas and migrations

### Data Flow
1. **Tracking**: Client-side tracking script (`src/tracker/`) sends events
2. **Collection**: API routes (`src/app/api/`) receive and validate data
3. **Storage**: Queries (`src/queries/`) handle database operations
4. **Analysis**: Reports and dashboards display analytics data

### Multi-Database Strategy
The codebase supports multiple databases through query abstraction:
- Prisma queries in `src/queries/prisma/` for PostgreSQL/MySQL
- Raw SQL queries in `src/queries/sql/` for ClickHouse
- Database type detection automatically routes to correct implementation

## Configuration

### Environment Variables
- `DATABASE_URL` - Database connection string (required)
- `CLICKHOUSE_URL` - ClickHouse connection for analytics (optional)
- `BASE_PATH` - Application base path for reverse proxies
- `TRACKER_SCRIPT_NAME` - Custom tracker script names
- `CLOUD_MODE` - Enable cloud mode features

### Database Setup
1. Set `DATABASE_URL` in `.env`
2. Run `pnpm run build-db` to generate client and run migrations
3. For ClickHouse analytics, also set `CLICKHOUSE_URL`

## Development Patterns

### Component Structure
- CSS Modules for styling (`.module.css`)
- TypeScript throughout with strict mode enabled
- React Basics UI library for common components
- Internationalization with React Intl

### Database Queries
- Use `runQuery()` wrapper for database abstraction
- Implement both Prisma and raw SQL versions when supporting multiple databases
- Queries in `src/queries/` organized by feature (events, sessions, reports)

### API Development
- API routes in `src/app/api/` follow Next.js 15 conventions
- Request/response utilities in `src/lib/`
- Authentication handled via JWT tokens

### Testing Strategy
- Jest for unit tests in `src/lib/__tests__/`
- Cypress for E2E testing
- Test configuration in `jest.config.ts` and `cypress.config.ts`

## Deployment

### Production Build
The full build process includes:
1. Environment validation
2. Database setup and migrations
3. Tracker script compilation
4. Geolocation data preparation
5. Next.js application build

### Docker Support
- `Dockerfile` available for containerization
- Database-specific Docker images (PostgreSQL, MySQL variants)
- `docker-compose.yml` for local development

## Important Files
- `next.config.mjs` - Next.js configuration with custom headers and routing
- `src/lib/db.ts` - Database abstraction and type detection
- `src/tracker/index.js` - Privacy-focused tracking script
- `db/*/schema.prisma` - Database schemas for different engines