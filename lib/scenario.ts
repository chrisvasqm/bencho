// What one virtual user does. Shared by every test type; tests only differ in load shape (options).
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3333';

export default function (): void {
  const response = http.get(BASE_URL);
  check(response, { 'status 200': (checkedResponse) => checkedResponse.status === 200 });
  sleep(1);
}
