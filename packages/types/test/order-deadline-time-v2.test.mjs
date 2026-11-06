import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import {normalizeOrderDeadlines} from '../dist/index.js';
const load=p=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));
const {legacy,v2}=load('../fixtures/agentpay-order-deadlines-v2/records.json');
const validate=new Ajv2020({strict:true}).compile(load('../schemas/agentpay-order-deadlines-v2.schema.json'));
test('deadline disclosure retains persisted instants and separate policy version across offsets',()=>{
 assert.deepEqual(normalizeOrderDeadlines(legacy),v2);assert.deepEqual(normalizeOrderDeadlines(v2),v2);
 assert.equal(validate(v2),true,JSON.stringify(validate.errors));
 assert.deepEqual(normalizeOrderDeadlines({...legacy,deliveryDueAt:'2026-09-27T17:10:00+08:00',chainDeliveryDueAt:'2026-09-27T02:11:00-07:00'}),v2);
 const oldOrder={...legacy,deliveryDueAt:null,chainMarginMs:null,deadlinePolicyVersion:null,providerResponseDueAt:null};
 const result=normalizeOrderDeadlines(oldOrder);assert.equal(result.deliveryDueAtMs,null);assert.equal(result.deadlinePolicyVersion,null);assert.equal(validate(result),true);
});
test('deadline disclosure rejects ambiguous, mixed-unit and inconsistent snapshots',()=>{
 for(const value of [null,{},[],{...legacy,deliveryDueAt:'2026-09-27T09:10:00'},
  {...legacy,chainDeliveryDueAt:'2026-02-30T09:11:00Z'},
  {...legacy,refundAvailableAt:legacy.chainDeliveryDueAt},
  {...legacy,deliveryDueAt:legacy.chainDeliveryDueAt},
  {...legacy,deadlinePolicyVersion:null}, {...legacy,chainMarginMs:'60000'},
  {...legacy,chainMarginMs:60001},{...legacy,deadlinePolicyVersion:'unknown'},
  {...legacy,privateRequest:'secret'}, {...v2,chainDeliveryDueAtMs:'1790000000000'},
  {...v2,refundAvailableAtMs:Infinity},{...v2,providerResponseDueAtMs:-1},
  {...v2,deliveryDueAt:legacy.deliveryDueAt},{...v2,version:'unknown'}]){
  assert.throws(()=>normalizeOrderDeadlines(value));
 }
 for(const patch of [{chainDeliveryDueAtMs:'1790000000000'},{refundAvailableAtMs:253402300800000},
  {deliveryDueAtMs:null},{chainMarginMs:0},{providerResponseDueAtMs:0.5}])assert.equal(validate({...v2,...patch}),false);
});
