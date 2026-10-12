import test from 'node:test';
import assert from 'node:assert/strict';
import { readOperationalRows } from '../lib/admin-operational-data.ts';

function clientFor(pages) {
  const calls = [];
  const client = { from(table) {
    return { select(columns) { return { order(key) { return { async range(from, to) {
      calls.push({ table, columns, key, from, to });
      const result = pages[calls.length - 1];
      if (result instanceof Error) throw result;
      return result;
    } }; } }; } };
  } };
  return { client, calls };
}

test('empty real tables return no fabricated records', async () => {
  const { client } = clientFor([{ data: [], error: null }]);
  assert.deepEqual(await readOperationalRows(client, 'wallet_entries', 'id'), { rows: [], failed: false });
});
test('operational totals include every page with a stable ID order', async () => {
  const first = Array.from({ length: 500 }, (_, id) => ({ id }));
  const { client, calls } = clientFor([{ data: first, error: null }, { data: [{ id: 500 }], error: null }]);
  const result = await readOperationalRows(client, 'wallet_entries', 'id');
  assert.equal(result.failed, false);
  assert.equal(result.rows.length, 501);
  assert.deepEqual(calls.map(({ key, from, to }) => [key, from, to]), [['id', 0, 499], ['id', 500, 999]]);
});
test('a failed later page discards partial finance totals', async () => {
  const { client } = clientFor([{ data: Array.from({ length: 500 }, (_, id) => ({ id })), error: null }, { data: null, error: { message: 'unavailable' } }]);
  assert.deepEqual(await readOperationalRows(client, 'wallet_entries', 'id'), { rows: [], failed: true });
});
test('a transport exception is unavailable, not a zero balance', async () => {
  const { client } = clientFor([new Error('unavailable')]);
  assert.deepEqual(await readOperationalRows(client, 'wallet_entries', 'id'), { rows: [], failed: true });
});
test('null records without an error are still unavailable', async () => {
  const { client } = clientFor([{ data: null, error: null }]);
  assert.deepEqual(await readOperationalRows(client, 'wallet_entries', 'id'), { rows: [], failed: true });
});
