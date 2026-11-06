import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeDisputeCase} from '../dist/index.js';
const caseData={version:'agentpay.dispute-case.v1',orderId:'0x'+'a'.repeat(64),state:'collecting',financialState:'Delivered',confirmed:false,revision:1,schedule:{submissionAtMs:1000,evidenceAtMs:2000,humanAtMs:3000,decisionAtMs:4000,releaseAtMs:5000,refundAvailableAtMs:6000},reason:'Not received',verdict:null,review:null,evidence:[],events:[],canOpen:false,canWithdraw:true,canSubmitEvidence:true};
test('generic case timestamps and rights are validated without hardcoded commercial days',()=>{
 assert.deepEqual(normalizeDisputeCase(caseData),caseData);
 assert.throws(()=>normalizeDisputeCase({...caseData,schedule:{...caseData.schedule,refundAvailableAtMs:4500}}));
 assert.throws(()=>normalizeDisputeCase({...caseData,schedule:{...caseData.schedule,evidenceAtMs:999}}));
 assert.throws(()=>normalizeDisputeCase({...caseData,canWithdraw:'yes'}));
});
test('case financial state, reasons, review and verdict identity/time reject malformed fields',()=>{
 const verdict={outcome:'refund',reason:'No evidence',atMs:4000,actor:'operator'};
 assert.doesNotThrow(()=>normalizeDisputeCase({...caseData,verdict,review:{outcome:'manual',reason:'Needs review'}}));
 for(const patch of [{financialState:undefined},{financialState:{}},{reason:undefined},{reason:3},{review:undefined},{review:{outcome:'release',reason:3}},
  {verdict:undefined},{verdict:{...verdict,atMs:'4000'}},{verdict:{...verdict,actor:null}},{verdict:{...verdict,reason:' '}},{extra:'unsupported'},
  {events:[{type:'decided',atMs:4000,actor:'operator',outcome:'unexpected'}]}])assert.throws(()=>normalizeDisputeCase({...caseData,...patch}));
});
import Ajv2020 from 'ajv/dist/2020.js';import {readFileSync} from 'node:fs';
test('JSON schema rejects malformed nested verdicts, evidence and omitted required fields',()=>{
 const validate=new Ajv2020({strict:true}).compile(JSON.parse(readFileSync(new URL('../schemas/agentpay-dispute-case-v1.schema.json',import.meta.url),'utf8')));
 assert.equal(validate(caseData),true);
 for(const patch of [{review:{outcome:'manual'}},{verdict:{outcome:'refund',reason:'reason',atMs:'1000',actor:'operator'}},{evidence:[{}]},{events:[{type:'decided',atMs:1000}]},{financialState:null}])assert.equal(validate({...caseData,...patch}),false);
});
