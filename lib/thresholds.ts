// Shared pass/fail criteria so every test type fails on the same signals.
interface Limits {
  maxErrorRate: number;
  p95Ms: number;
}

export function thresholds({ maxErrorRate, p95Ms }: Limits): Record<string, string[]> {
  return {
    http_req_failed: [`rate<${maxErrorRate}`],
    http_req_duration: [`p(95)<${p95Ms}`],
    checks: ['rate>0.99'],
  };
}
