// Minimal structured logger. Render captures stdout/stderr, so plain console
// output is enough for v1; swap this module out if a log service is added.

type Level = 'info' | 'warn' | 'error';

function write(level: Level, message: string, meta?: unknown): void {
  if (process.env.NODE_ENV === 'test') return;
  const line = { level, time: new Date().toISOString(), message, ...(meta ? { meta: serialize(meta) } : {}) };
  const output = JSON.stringify(line);
  if (level === 'error') console.error(output);
  else if (level === 'warn') console.warn(output);
  else console.log(output);
}

function serialize(meta: unknown): unknown {
  if (meta instanceof Error) return { name: meta.name, message: meta.message, stack: meta.stack };
  return meta;
}

export const logger = {
  info: (message: string, meta?: unknown) => write('info', message, meta),
  warn: (message: string, meta?: unknown) => write('warn', message, meta),
  error: (message: string, meta?: unknown) => write('error', message, meta),
};
