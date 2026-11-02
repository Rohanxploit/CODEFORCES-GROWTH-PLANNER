# Codeforces Growth Planner

**Don't guess what to practice. Know exactly what to solve next.**

A personalized 90-day Codeforces training planner. It builds a roadmap from
your current rating and target rating: what concept to study each day, which
real Codeforces problems to solve, and how to revise and prepare for contests.

> **Status: in development (Milestone 1 of 9: project setup).** The roadmap
> engine, Codeforces integration and product UI are not built yet. This
> README will be completed as features land.

## Tech stack

* **Client:** React, Vite, TypeScript, Tailwind CSS, React Router, TanStack Query, Recharts, Lucide
* **Server:** Node.js, Express, TypeScript, Zod, JWT, bcrypt, Mongoose
* **Database:** MongoDB Atlas
* **External API:** [Codeforces API](https://codeforces.com/apiHelp)

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full design.

## Local setup

Requires Node.js 20+ and a MongoDB connection string (local MongoDB or a free
Atlas cluster).

```bash
npm install
cp .env.example server/.env   # then fill in MONGODB_URI and JWT_SECRET
npm run dev:server            # http://localhost:5000
npm run dev:client            # http://localhost:5173 (proxies /api to the server)
```

## Scripts

| Command | What it does |
|---------|--------------|
| `npm run build` | Builds shared types, server and client |
| `npm run typecheck` | Type-checks all workspaces |
| `npm test` | Runs the server test suite (Vitest) |

## License

[MIT](LICENSE)
