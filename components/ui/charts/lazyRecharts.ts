// Recharts enters the app only through lazy-loaded reporting dashboards.
// Keeping a single entrypoint here makes it easier for Rollup to isolate
// a dedicated vendor chunk for charting code.
export * from 'recharts';
