import { apiUrl } from '../src/config';
import { orderNumber } from '../src/orders';

it('uses the staging API', () => {
  process.env.API_URL = 'https://api.example.test'; // expect: QCR-C001
  expect(apiUrl()).toBe('https://api.example.test');
});

it('numbers an order by the time', () => {
  Date.now = () => 1767225600000; // expect: QCR-C001
  expect(orderNumber()).toBe('20260101-0000');
});

it('reads the screen width', () => {
  window.innerWidth = 320; // expect: QCR-C001
  expect(apiUrl({ mobile: true })).toContain('m.');
});
