import test from 'node:test';
import assert from 'node:assert/strict';
import {validateOrderClosure} from '../dist/index.js';
const input={version:'agentpay.order-closure.v1',state:'requested',reason:'user_cancel',requestedAtMs:1792650000000,completedAtMs:null,transactionHash:null,errorCode:null};
test('closure projection distinguishes intent from confirmed cancellation and refund',()=>{
 assert.deepEqual(validateOrderClosure(input),input);
 assert.equal(validateOrderClosure({...input,state:'cancelled',completedAtMs:input.requestedAtMs}).state,'cancelled');
 assert.equal(validateOrderClosure({...input,state:'refunded',completedAtMs:input.requestedAtMs,transactionHash:'0x'+'1'.repeat(64)}).state,'refunded');
});
test('closure rejects incomplete terminal proof, unknown fields, malformed timestamps and private details',()=>{
 for(const patch of [{state:'refunded'},{state:'refunded',completedAtMs:input.requestedAtMs},{completedAtMs:input.requestedAtMs},{state:'cancelled',completedAtMs:input.requestedAtMs-1},{requestedAtMs:'2026-10-22'}, {state:'anything'},{reason:'unknown'},{rawTransaction:'secret'},{errorCode:'SQL: private'}])assert.throws(()=>validateOrderClosure({...input,...patch}));
});
