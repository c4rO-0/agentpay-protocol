import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import {normalizeServiceAuthorization} from '../dist/index.js';
const load=p=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));
const {legacy,v2}=load('../fixtures/agentpay-service-authorization-v2/records.json');
const validate=new Ajv2020({strict:true}).compile(load('../schemas/agentpay-service-authorization-v2.schema.json'));
test('authorization times preserve token/identity and do not equate claim expiry to response cutoff',()=>{
 assert.deepEqual(normalizeServiceAuthorization(legacy),v2);assert.deepEqual(normalizeServiceAuthorization(v2),v2);
 assert.equal(validate(v2),true,JSON.stringify(validate.errors));
 const ready={...legacy,state:'ready',authorization:'opaque-fixture'};delete ready.respondedAt;delete ready.responseDueAt;
 const result=normalizeServiceAuthorization(ready);assert.equal(result.authorization,'opaque-fixture');assert.equal('respondedAtMs'in result,false);assert.equal(validate(result),true);
 assert.equal(normalizeServiceAuthorization({...legacy,expiresAt:'2026-09-27T17:05:00+08:00'}).expiresAtMs,v2.expiresAtMs);
 const longResponse=normalizeServiceAuthorization({...legacy,responseDueAt:'2026-09-28T09:02:00Z'});
 assert.ok(longResponse.responseDueAtMs>longResponse.expiresAtMs);
});
test('authorization disclosure rejects mixed units, ambiguity, malformed identity and private fields',()=>{
 for(const value of [null,{},[],{...legacy,expiresAt:'2026-09-27T09:05:00'},
  {...legacy,expiresAt:'2026-02-30T09:05:00Z'},{...legacy,respondedAt:null},
  {...legacy,claimed:'true'},{...legacy,maxUsageUnits:1},{...legacy,orderId:'short'},
  {...legacy,privateOutput:'secret'},{...legacy,authorization:''},
  {...legacy,version:'agentpay.participant-order.v2'},{...v2,expiresAtMs:'1790000000000'},
  {...v2,responseDueAtMs:Infinity},{...v2,respondedAtMs:-1},{...v2,expiresAt:legacy.expiresAt},
  {...legacy,deadlines:[]},{...legacy,finalizationPolicy:'invalid'}])assert.throws(()=>normalizeServiceAuthorization(value));
 for(const patch of [{expiresAtMs:0.5},{respondedAtMs:null},{expiresAtMs:253402300800000},
  {duplicate:'false'},{maxUsageUnits:1}])assert.equal(validate({...v2,...patch}),false);
});
