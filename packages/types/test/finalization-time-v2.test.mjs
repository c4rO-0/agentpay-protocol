import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import {normalizeFinalizationDisclosure,acceptsAgentPayMediaType,AGENTPAY_FINALIZATION_V2_MEDIA_TYPE as media} from '../dist/index.js';
const load=p=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));
const {legacy,v2}=load('../fixtures/agentpay-finalization-disclosure-v2/records.json');
const schema=load('../schemas/agentpay-finalization-disclosure-v2.schema.json');
const validate=new Ajv2020({strict:true}).compile(schema);
test('persisted instants survive version and offset adaptation without local scheduling',()=>{
 assert.deepEqual(normalizeFinalizationDisclosure(legacy),v2);
 assert.deepEqual(normalizeFinalizationDisclosure(v2),v2);
 assert.equal(validate(v2),true,JSON.stringify(validate.errors));
 const offset={...legacy,deliveryAcceptedAt:'2026-09-27T17:00:50.209+08:00',releaseScheduledAt:'2026-09-27T02:10:50.209-07:00'};
 assert.deepEqual(normalizeFinalizationDisclosure(offset),v2);
 for(const patch of [{state:'disputed',automaticReleaseBlocked:true},{state:'finalized'},{state:'queued',resolution:'refund'}]){
  const value=normalizeFinalizationDisclosure({...legacy,...patch,releaseScheduledAt:null});
  assert.equal(value.releaseScheduledAtMs,null);assert.equal(validate(value),true);
 }
});
test('ambiguous, missing, mistyped or contradictory schedules fail closed',()=>{
 for(const patch of [{deliveryAcceptedAt:'2026-09-27 09:00:50'},
  {deliveryAcceptedAt:'2026-09-27T09:00:50'},{deliveryAcceptedAt:'2026-02-30T00:00:00Z'},
  {releaseScheduledAt:null},{confirmedAt:'2026-09-27T00:00:00Z'},
  {releaseScheduledAt:'2026-09-27T00:00:00Z'},{state:'future'},{resolution:'unknown'},
  {automaticReleaseRequiresConfirmation:true},{authorization:'secret'},
  {version:'agentpay.finalization-disclosure.v3'}])assert.throws(()=>normalizeFinalizationDisclosure({...legacy,...patch}));
 for(const value of [null,undefined,NaN,Infinity,-1,0.5,'1791020911000',253402300800000]){
  const bad={...v2,deliveryAcceptedAtMs:value};assert.throws(()=>normalizeFinalizationDisclosure(bad));assert.equal(validate(bad),false);
 }
 assert.throws(()=>normalizeFinalizationDisclosure({...v2,state:'finalized'}));
 assert.equal(validate({...v2,state:'finalized'}),false);
 assert.throws(()=>normalizeFinalizationDisclosure({...v2,deliveryAcceptedAt:legacy.deliveryAcceptedAt}));
});
test('HTTP negotiation supports multiple media types and never treats q=0 as acceptance',()=>{
 for(const header of [media,`application/json, ${media}`,`${media};q=0.5`,`${media.toUpperCase()} ; q=1`])assert.equal(acceptsAgentPayMediaType(header,media),true,header);
 for(const header of [null,[],{},'application/json','*/*',`${media};q=0`,`${media};q=0.000`,`${media};q=2`,`${media};q=no`,`${media};q=1;q=0`])assert.equal(acceptsAgentPayMediaType(header,media),false);
});
