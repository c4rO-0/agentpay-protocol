import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import {normalizeWalletNotice,normalizeDeliveryResult} from '../dist/index.js';
const load=p=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));
const notice=load('../fixtures/agentpay-wallet-notice-v2/records.json');
const delivery=load('../fixtures/agentpay-delivery-result-v2/records.json');
const validateNotice=new Ajv2020({strict:true}).compile(load('../schemas/agentpay-wallet-notice-v2.schema.json'));
const validateDelivery=new Ajv2020({strict:true}).compile(load('../schemas/agentpay-delivery-result-v2.schema.json'));
test('reminder keeps stored release instant and order binding across legacy/new formats',()=>{
 for(const v of [notice.legacy,notice.v2])assert.deepEqual(normalizeWalletNotice(v),notice.v2);
 assert.equal(validateNotice(notice.v2),true,JSON.stringify(validateNotice.errors));
 assert.deepEqual(normalizeWalletNotice({...notice.legacy,payload:{...notice.legacy.payload,releaseScheduledAt:'2026-09-27T17:10:00+08:00'}}),notice.v2);
 for(const v of [{...notice.legacy,state:['delivered']},{...notice.legacy,privateOutput:'secret'},
  {...notice.legacy,payload:{...notice.legacy.payload,orderId:`0x${'9'.repeat(64)}`}},
  {...notice.legacy,payload:{...notice.legacy.payload,releaseScheduledAt:'2026-09-27T09:10:00'}},
  {...notice.v2,payload:{...notice.v2.payload,releaseScheduledAtMs:'1790000000000'}},
  {...notice.v2,payload:{...notice.v2.payload,actions:['open_dispute','open_dispute']}}])assert.throws(()=>normalizeWalletNotice(v));
 assert.equal(validateNotice({...notice.v2,payload:{...notice.v2.payload,releaseScheduledAtMs:null}}),false);
});
test('receipt/confirmation return persisted deadlines without requiring fabricated retry times',()=>{
 for(const name of ['confirmation','receipt']){
  const v2=delivery[name+'V2'];assert.deepEqual(normalizeDeliveryResult(delivery[name+'Legacy']),v2);
  assert.deepEqual(normalizeDeliveryResult(v2),v2);assert.equal(validateDelivery(v2),true,JSON.stringify(validateDelivery.errors));
 }
 const duplicate={orderId:delivery.receiptLegacy.orderId,receiptId:delivery.receiptLegacy.receiptId,duplicate:true,billing:delivery.receiptLegacy.billing};
 const value=normalizeDeliveryResult(duplicate);assert.equal('releaseDueAtMs'in value,false);assert.equal(validateDelivery(value),true);
 const late=normalizeDeliveryResult({...delivery.confirmationLegacy,confirmedAt:'2026-09-27T09:04:00Z'});
 assert.ok(late.confirmedAtMs>late.releaseDueAtMs);
});
test('delivery codec and schema reject malformed/mixed times and private or invalid billing',()=>{
 for(const v of [{...delivery.receiptLegacy,releaseDueAt:'2026-09-27T09:10:00'},
  {...delivery.confirmationV2,confirmedAtMs:'1790000000000'},
  {...delivery.receiptV2,reminderDueAtMs:null},
  {...delivery.receiptV2,releaseDueAtMs:253402300800000},
  {...delivery.receiptV2,confirmedAtMs:1},{...delivery.confirmationV2,receiptId:'receipt'},
  {...delivery.receiptV2,billing:{...delivery.receiptV2.billing,privateOutput:'secret'}},
  {...delivery.receiptV2,privateOutput:'secret'},
  {orderId:delivery.receiptLegacy.orderId,receiptId:'r',duplicate:false,billing:delivery.receiptLegacy.billing}]){
  assert.throws(()=>normalizeDeliveryResult(v));
  if(v.version)assert.equal(validateDelivery(v),false);
 }
});
