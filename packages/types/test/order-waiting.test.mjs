import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import {validateOrderWaiting} from '../dist/index.js';
const waiting={version:'agentpay.order-waiting.v1',paymentDueAtMs:1792650300000,providerResponseWindowMs:300000,fundingConfirmedAtMs:null,providerResponseDueAtMs:null};
test('waiting snapshot explicitly represents an unpaid Order and a fixed funded deadline',()=>{
 assert.deepEqual(validateOrderWaiting(waiting),waiting);
 const funded={...waiting,fundingConfirmedAtMs:1792650200000,providerResponseDueAtMs:1792650500000};
 assert.deepEqual(validateOrderWaiting(funded),funded);
 assert.deepEqual(validateOrderWaiting({...funded,providerResponseDueAtMs:1792650199999}),{...funded,providerResponseDueAtMs:1792650199999});
});
test('waiting wire rejects mixed clocks, fabricated fields and deadline extensions',()=>{
 for(const update of [{version:'other'},{paymentDueAtMs:'2026-10-22T00:00:00Z'},{paymentDueAtMs:'1792650300000'},{providerResponseWindowMs:0},{fundingConfirmedAtMs:1792650200000},{providerResponseDueAtMs:1792650300000},{extra:true},{fundingConfirmedAtMs:1792650200000,providerResponseDueAtMs:1792650500001}])assert.throws(()=>validateOrderWaiting({...waiting,...update}));
 const schema=JSON.parse(readFileSync(new URL('../schemas/agentpay-order-waiting-v1.schema.json',import.meta.url),'utf8'));
 assert.deepEqual([...schema.required].sort(),Object.keys(waiting).sort());assert.equal(schema.additionalProperties,false);
});

test('published JSON schema accepts the same clock shapes and rejects missing/mixed fields',()=>{
 const schema=JSON.parse(readFileSync(new URL('../schemas/agentpay-order-waiting-v1.schema.json',import.meta.url),'utf8'));
 const validate=new Ajv2020({strict:true}).compile(schema);
 assert.equal(validate(waiting),true);
 assert.equal(validate({...waiting,fundingConfirmedAtMs:1792650200000,providerResponseDueAtMs:1792650500000}),true);
 for(const change of [{paymentDueAtMs:'1792650300000'},{providerResponseWindowMs:0},{fundingConfirmedAtMs:1792650200000},{providerResponseDueAtMs:1792650300000},{extra:true}])assert.equal(validate({...waiting,...change}),false);
});
