import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import { normalizeParticipantOrder,participantOrderToLegacy,hashEscrowOrderTerms,hashPrivateRequest } from '../dist/index.js';
const load = path => JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const legacy = load('../fixtures/agentpay-native-service-v1/records.json');
const epoch = load('../fixtures/agentpay-participant-order-v2/records.json');
const schema = load('../schemas/agentpay-participant-order-v2.schema.json');
const ajv = new Ajv2020({strict:true});ajv.addSchema(schema);
const validateBuyer = ajv.compile({$ref:`${schema.$id}#/$defs/BuyerOrderProjection`});
const validateProvider = ajv.compile({$ref:`${schema.$id}#/$defs/ProviderOrderProjection`});

test('v1 and v2 projections have exactly the same instants and immutable identities',()=>{
 for(const key of ['buyerOrder','providerOrder']){
  assert.deepEqual(normalizeParticipantOrder(legacy[key]),epoch[key]);
  assert.deepEqual(normalizeParticipantOrder(epoch[key]),epoch[key]);
  assert.deepEqual(participantOrderToLegacy(epoch[key]),legacy[key]);
  const validate=key==='buyerOrder'?validateBuyer:validateProvider;
  assert.equal(validate(epoch[key]),true,JSON.stringify(validate.errors));
  const offset={...legacy[key],createdAt:new Date(epoch[key].createdAtMs+8*3600000).toISOString().replace('Z','+08:00')};
  assert.deepEqual(normalizeParticipantOrder(offset),epoch[key]);
 }
 const terms=load('../fixtures/x402-escrow-v1/order-terms.json');
 const expected=load('../fixtures/x402-escrow-v1/expected.json');
 assert.equal(hashEscrowOrderTerms(terms),expected.termsHash);
 assert.equal(hashPrivateRequest(legacy.privateRequest),legacy.requestHash);
});

test('malformed times and versions never guess units, timezone or roles',()=>{
 for(const value of [undefined,null,'2026-10-06 00:00:00','2026-10-06T00:00:00','2026-02-30T00:00:00Z',NaN]){
  assert.throws(()=>normalizeParticipantOrder({...legacy.buyerOrder,createdAt:value}));
 }
 for(const value of [undefined,null,'1791020911000','2026-10-03T09:48:31Z',NaN,Infinity,-1,1.2,253402300800000]){
  assert.throws(()=>normalizeParticipantOrder({...epoch.buyerOrder,createdAtMs:value}));
  assert.equal(validateBuyer({...epoch.buyerOrder,createdAtMs:value}),false);
 }
 for(const patch of [{version:'agentpay.participant-order.v3'},{createdAt:legacy.buyerOrder.createdAt},
  {privateRequest:{secret:true}},{authorizationToken:'secret'},{role:'operator'},
  {expiresAt:1791020911},{expiresAt:'1791020911000'}]){
  assert.throws(()=>normalizeParticipantOrder({...epoch.buyerOrder,...patch}));
 }
 assert.throws(()=>normalizeParticipantOrder({...epoch.providerOrder,providerResponseDueAtMs:null}));
 assert.equal(validateProvider({...epoch.providerOrder,providerResponseDueAtMs:null}),false);
 assert.equal(normalizeParticipantOrder({...epoch.buyerOrder,providerResponseDueAtMs:null}).providerResponseDueAtMs,null);
 assert.throws(()=>normalizeParticipantOrder({...legacy.providerOrder,providerResponseDueAt:null}));
 assert.throws(()=>normalizeParticipantOrder({...epoch.buyerOrder,expiresAt:'-1'}));
 assert.throws(()=>normalizeParticipantOrder({...epoch.buyerOrder,refundAvailableAt:'253402300800'}));
});

test('schema and runtime share the year-9999 seconds boundary',()=>{
 for(const seconds of ['0','99999999999','100000000000','199999999999','249999999999','253402300798','253402300799']){
  const row={...epoch.buyerOrder,expiresAt:seconds};assert.equal(validateBuyer(row),true,seconds);assert.equal(normalizeParticipantOrder(row).expiresAt,seconds);
 }
 for(const seconds of ['253402300800','253402300999','999999999999','1791020911000','01','-1']){
  const row={...epoch.buyerOrder,expiresAt:seconds};assert.equal(validateBuyer(row),false,seconds);assert.throws(()=>normalizeParticipantOrder(row));
 }
});
