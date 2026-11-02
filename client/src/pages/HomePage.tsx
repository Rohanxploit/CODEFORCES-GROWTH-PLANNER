import { ServerStatus } from '../components/ServerStatus';

// Temporary home page for the Milestone 1 scaffold. The real landing page
// is built in Milestone 7.
export function HomePage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Codeforces Growth Planner</h1>
      <p className="mt-3 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
        Don't guess what to practice. Know exactly what to solve next.
      </p>
      <div className="mt-8">
        <ServerStatus />
      </div>
    </main>
  );
}
