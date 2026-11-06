import test from 'node:test';
import assert from 'node:assert/strict';
import {describeArtifact,verifyArtifact,artifactSha256,verifyAbiSubset,deployedVaultCloneCodeHash} from '../../../contracts/scripts/deployment-artifact-integrity.mjs';
const abi=[{type:'function',name:'state',stateMutability:'view',inputs:[],outputs:[{name:'',type:'uint8',internalType:'enum Vault.State'}]}];
const item={abi,evm:{bytecode:{object:'6001'},deployedBytecode:{object:'60026003',immutableReferences:{}}}};
test('source-bound artifact hashes validate complete bytecode and detect tampering',()=>{
 const bytes=JSON.stringify(item),description=describeArtifact(item);
 assert.equal(description.runtimeHasImmutables,false);
 assert.deepEqual(verifyArtifact(bytes,artifactSha256(bytes),description),item);
 assert.throws(()=>verifyArtifact(bytes+' ',artifactSha256(bytes),description),/SHA mismatch/);
 assert.throws(()=>verifyArtifact(bytes,artifactSha256(bytes),{...description,runtimeTemplateKeccak256:'0x'+'0'.repeat(64)}),/metadata mismatch/);
 for(const object of ['', '0x1234', 'xyz', '__unresolved__'])assert.throws(()=>describeArtifact({...item,evm:{...item.evm,bytecode:{object}}}),/Incomplete/);
});
test('runtime templates with immutable slots cannot be represented as final deployed hashes',()=>{
 const templated={...item,evm:{...item.evm,deployedBytecode:{object:'60026003',immutableReferences:{'1':[{start:0,length:2}]}}}};
 assert.equal(describeArtifact(templated).runtimeHasImmutables,true);
 assert.throws(()=>describeArtifact({...item,evm:{...item.evm,deployedBytecode:{object:'6002',immutableReferences:{'1':[{start:1,length:32}]}}}}),/immutable reference/);
});
test('required ABI entries match independently of metadata/key order, but changed arguments fail',()=>{
 const published=[{name:'state',type:'function',inputs:[],outputs:[{type:'uint8',name:''}],stateMutability:'view'}];verifyAbiSubset(abi,published);
 assert.throws(()=>verifyAbiSubset(abi,[{...published[0],outputs:[{type:'uint256',name:''}]}]),/ABI differs/);
});
test('clone runtime hash depends on reviewed implementation address and rejects placeholders',()=>{
 const first=deployedVaultCloneCodeHash('0x'+'1'.repeat(40));assert.match(first,/^0x[0-9a-f]{64}$/);
 assert.notEqual(first,deployedVaultCloneCodeHash('0x'+'2'.repeat(40)));
 for(const x of ['',null,'0x'+'0'.repeat(40),'template'])assert.throws(()=>deployedVaultCloneCodeHash(x),/address required/);
});
