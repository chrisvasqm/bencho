// What one virtual user does. Shared by every test type; tests only differ in load shape (options).
import http from 'k6/http';
import { check, sleep } from 'k6';
import { config } from './config.ts';

export default function (): void {
  const response = http.get(config.baseUrl);
  check(response, { 'status 200': (checkedResponse) => checkedResponse.status === 200 });
  sleep(config.thinkTimeSeconds);
}
