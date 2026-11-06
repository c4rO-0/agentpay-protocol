import test from 'node:test';
import assert from 'node:assert/strict';
import { assertUnixMilliseconds,assertUnixSeconds,unixSecondsToMilliseconds,
 millisecondsToUnixSeconds,parseLegacyIsoMilliseconds,MAX_UNIX_MILLISECONDS,MAX_UNIX_SECONDS } from '../dist/time.js';

test('epoch units are explicit; integer/range validation and rounding fail closed',()=>{
 assert.equal(unixSecondsToMilliseconds('1791020911'),1791020911000);
 assert.equal(millisecondsToUnixSeconds(1791020911000),1791020911n);
 assert.equal(millisecondsToUnixSeconds(1791020911001,'floor'),1791020911n);
 assert.equal(millisecondsToUnixSeconds(1791020911001,'ceil'),1791020912n);
 assert.throws(()=>millisecondsToUnixSeconds(1791020911001),/PRECISION_LOSS/);
 assert.throws(()=>millisecondsToUnixSeconds(0,'guess'),/ROUNDING/);
 for(const value of [null,undefined,NaN,Infinity,-1,1.2,'1791020911000',{},true,MAX_UNIX_MILLISECONDS+1])assert.throws(()=>assertUnixMilliseconds(value));
 for(const value of [null,undefined,NaN,Infinity,-1,1.2,'01',' 1','+1','1.0',{},true,MAX_UNIX_SECONDS+1n])assert.throws(()=>assertUnixSeconds(value));
 assert.equal(assertUnixMilliseconds(0),0);assert.equal(assertUnixMilliseconds(MAX_UNIX_MILLISECONDS),MAX_UNIX_MILLISECONDS);
 assert.equal(assertUnixSeconds(MAX_UNIX_SECONDS),MAX_UNIX_SECONDS);
 assert.throws(()=>millisecondsToUnixSeconds(MAX_UNIX_MILLISECONDS,'ceil'));
});
test('legacy ISO requires a timezone and a real calendar date; offsets preserve the same instant',()=>{
 const expected=1791020911000;
 for(const value of ['2026-10-03T09:48:31Z','2026-10-03T17:48:31+08:00','2026-10-03T02:48:31-07:00'])assert.equal(parseLegacyIsoMilliseconds(value),expected);
 assert.equal(parseLegacyIsoMilliseconds('2024-02-29T00:00:00.001Z'),Date.UTC(2024,1,29)+1);
 for(const value of [null,1791020911000,'2026-10-03 09:48:31','2026-10-03T09:48:31','2026-10-03',
  '2026-02-29T00:00:00Z','2026-04-31T00:00:00Z','2026-10-03T24:00:00Z','2026-10-03T09:48:60Z',
  '2026-10-03T09:48:31.0001Z','2026-10-03T09:48:31+24:00','2026-10-03T09:48:31+08:60',
  '2026-10-03T09:48:31-00:00','1969-12-31T23:59:59Z'])assert.throws(()=>parseLegacyIsoMilliseconds(value));
});
