import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import {createHash} from 'node:crypto';
import {hashPrivateRequest,hashServiceProfile,normalizeServiceReference,normalizeServiceInvocation,normalizeServiceResult,hashServiceOutput,canonicalizeServiceJson} from '../dist/index.js';
const profile={version:'agentpay.service-profile.v1',providerId:'provider:test',serviceId:'echo',mcpEndpoint:'https://provider.example/services/echo/mcp/invoke',paymentEndpoint:'https://provider.example/services/echo/agentpay/invoke',seller:'0x'+'1'.repeat(40),network:'eip155:31337',asset:'0x'+'2'.repeat(40)};
const ref={version:'agentpay.service-reference.v1',skillId:'0x'+'a'.repeat(64),profileHash:hashServiceProfile(profile),profile,adapter:'agentpay.json.v1'};
test('service reference anchors endpoint to the qualified profile digest without prices',()=>{
 assert.equal(normalizeServiceReference(ref).profile.paymentEndpoint,profile.paymentEndpoint);
 for(const value of [{...ref,amount:'1'},{...ref,profile:{...profile,paymentEndpoint:'https://other.example/services/echo/agentpay/invoke'}},{...ref,profileHash:'0x'+'b'.repeat(64)},{...ref,adapter:'javascript:run'},{...ref,adapter:'agentpay.random.v1'},{...ref,skillId:'short'}])assert.throws(()=>normalizeServiceReference(value));
});
test('output evidence preserves application JSON property order and existing digest',()=>{
 const output={nested:{z:1,a:[true,null,'hello']},answer:'yes'};
 assert.notEqual(hashServiceOutput(output),hashServiceOutput({answer:'yes',nested:{a:[true,null,'hello'],z:1}}));
 assert.equal(hashServiceOutput(output),'0x'+createHash('sha256').update(JSON.stringify(output)).digest('hex')); 
 assert.equal(hashServiceOutput({kind:'random',value:4}),'0x'+createHash('sha256').update('{"kind":"random","value":4}').digest('hex'));
 for(const value of [undefined,{a:undefined},Infinity,new Date(),{a:1n},'x'.repeat(262145)])assert.throws(()=>canonicalizeServiceJson(value));
 let deep={};for(let i=0;i<35;i++)deep={deep};assert.throws(()=>canonicalizeServiceJson(deep));
});
test('versioned invocation/result reject forged hashes, extra authority fields and invalid usage',()=>{
 const input={version:'agentpay.service-invocation.v1',orderId:'0x'+'1'.repeat(64),requestHash:hashPrivateRequest({text:'hello',count:3}),request:{text:'hello',count:3}};
 assert.deepEqual(normalizeServiceInvocation(input).request,input.request);
 const result={version:'agentpay.service-result.v1',orderId:input.orderId,requestHash:input.requestHash,output:{text:'HELLO'},outputHash:hashServiceOutput({text:'HELLO'}),usageUnits:'3'};
 assert.deepEqual(normalizeServiceResult(result),result);
 for(const value of [{...result,outputHash:input.orderId},{...result,usageUnits:'-1'},{...result,usageUnits:3},{...result,price:'1'},{...result,version:'unknown'}])assert.throws(()=>normalizeServiceResult(value));
 assert.throws(()=>normalizeServiceInvocation({...input,price:'1'}));
});

test('published JSON schemas and fixed independent digest fixture agree with helpers',()=>{
 const load=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
 const expected=load('../fixtures/agentpay-service-invocation-v1/expected.json');assert.equal(hashServiceOutput(expected.output),expected.outputHash);assert.equal(JSON.stringify(expected.output),expected.serializedOutput);
 const ajv=new Ajv2020({strict:true});ajv.addSchema(load('../schemas/agentpay-service-profile-v1.schema.json'));
 const validate=ajv.compile(load('../schemas/agentpay-service-reference-v1.schema.json'));assert.equal(validate(ref),true);assert.equal(validate({...ref,price:'1'}),false);
 const resultSchema=ajv.compile(load('../schemas/agentpay-service-result-v1.schema.json'));
 const message={version:'agentpay.service-result.v1',orderId:'0x'+'1'.repeat(64),requestHash:'0x'+'2'.repeat(64),output:expected.output,outputHash:expected.outputHash,usageUnits:'0'};assert.equal(resultSchema(message),true);assert.equal(resultSchema({...message,usageUnits:1}),false);
});
