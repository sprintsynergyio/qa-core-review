import { apiUrl } from '../src/config';
import { orderNumber } from '../src/orders';

const originalUrl = process.env.API_URL;
const originalNow = Date.now;
const originalWidth = window.innerWidth;

afterEach(() => {
  process.env.API_URL = originalUrl;
  Date.now = originalNow;
  window.innerWidth = originalWidth;
});

it('uses the staging API', () => {
  process.env.API_URL = 'https://staging.example.test';
  expect(apiUrl()).toBe('https://staging.example.test');
});

it('numbers an order by the time', () => {
  Date.now = () => 1773532800000;
  expect(orderNumber()).toBe('20260315-0000');
});

it('reads the screen width', () => {
  window.innerWidth = 360;
  expect(apiUrl({ mobile: true })).toContain('m.');
});
