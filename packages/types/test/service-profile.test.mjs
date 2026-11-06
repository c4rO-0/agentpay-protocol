import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import { canonicalizeServiceProfile, hashServiceProfile, paymentEndpointForService } from "../dist/index.js";

const profile = JSON.parse(readFileSync(new URL("../fixtures/agentpay-service-profile-v1/records.json", import.meta.url))).profile;
const expected = JSON.parse(readFileSync(new URL("../fixtures/agentpay-service-profile-v1/expected.json", import.meta.url)));
const schema = JSON.parse(readFileSync(new URL("../schemas/agentpay-service-profile-v1.schema.json", import.meta.url)));

test("v1 profile Schema rejects extra and missing fields", () => {
  const validate = new Ajv2020({ strict: true }).compile(schema);
  assert.equal(validate(profile), true, JSON.stringify(validate.errors));
  assert.equal(validate({ ...profile, author: "publisher" }), false);
  const withoutSeller = { ...profile }; delete withoutSeller.seller;
  assert.equal(validate(withoutSeller), false);
});

test("v1 service identity has fixed canonical bytes and hash", () => {
  assert.equal(canonicalizeServiceProfile(profile), expected.canonicalProfile);
  assert.equal(hashServiceProfile(profile), expected.profileHash);
  assert.equal(paymentEndpointForService(profile.mcpEndpoint, profile.serviceId), profile.paymentEndpoint);
  assert.equal(hashServiceProfile(Object.fromEntries(Object.entries(profile).reverse())), expected.profileHash);
  assert.equal(hashServiceProfile({ ...profile, seller: profile.seller.toUpperCase().replace(/^0X/, "0x") }), expected.profileHash);
});

test("identity change needs another hash; mutable offer and package cannot enter profile", () => {
  for (const change of [{ providerId: "provider:market:other" }, { seller: "0x3000000000000000000000000000000000000003" },
    { asset: "0x4000000000000000000000000000000000000004" }, { network: "eip155:8453" },
    { mcpEndpoint: "http://127.0.0.1:6572/services/service.agentpay.random/mcp/invoke",
      paymentEndpoint: "http://127.0.0.1:6572/services/service.agentpay.random/agentpay/invoke" }]) {
    assert.notEqual(hashServiceProfile({ ...profile, ...change }), expected.profileHash);
  }
  for (const change of [{ price: "1" }, { offerId: "0x1" }, { packageDigest: "abc" },
    { author: "third-party" }]) {
    assert.throws(() => hashServiceProfile({ ...profile, ...change }), /fields/);
  }
});

test("canonical service URL and exact v1 fields fail closed", () => {
  for (const change of [
    { mcpEndpoint: "https://example.com/services/other/mcp/invoke" },
    { mcpEndpoint: "http://127.0.0.1:6571/services/service.agentpay.random/mcp/invoke?key=1" },
    { mcpEndpoint: "http://127.0.0.1:6571/services/service.agentpay.random/agentpay/invoke" },
    { paymentEndpoint: "http://127.0.0.1:6571/foreign" },
    { network: "eip155:031337" }, { seller: "not-an-address" },
    { version: "agentpay.service-profile.v2" }, { serviceId: "../other" }
  ]) assert.throws(() => hashServiceProfile({ ...profile, ...change }));
});

test('prefix profiles keep controlled suffixes and a distinct identity',()=>{
 const prefixed={...profile,
  mcpEndpoint:profile.mcpEndpoint.replace('/services/','/provider/services/'),
  paymentEndpoint:profile.paymentEndpoint.replace('/services/','/provider/services/')};
 assert.equal(paymentEndpointForService(prefixed.mcpEndpoint,prefixed.serviceId),prefixed.paymentEndpoint);
 assert.notEqual(hashServiceProfile(prefixed),expected.profileHash);
 const vector=JSON.parse(readFileSync(new URL('../fixtures/agentpay-service-profile-v1/prefixed.json',import.meta.url)));
 assert.equal(canonicalizeServiceProfile(vector.profile),vector.canonicalProfile);
 assert.equal(hashServiceProfile(vector.profile),vector.profileHash);
 assert.throws(()=>hashServiceProfile({...prefixed,paymentEndpoint:profile.paymentEndpoint}));
 for(const base of ['https://example.com/a/../provider','https://example.com/provider%2Fhidden',
  'https://example.com/provider//hidden','https://example.com/./provider','https://user:password@example.com/provider']){
  assert.throws(()=>paymentEndpointForService(`${base}/services/${profile.serviceId}/mcp/invoke`,profile.serviceId));
 }
 for(const suffix of ['?','#','?key=1','/extra'])assert.throws(()=>paymentEndpointForService(prefixed.mcpEndpoint+suffix,profile.serviceId));
 assert.equal(paymentEndpointForService('https://other-provider.example/region-a/paid/services/random/mcp/invoke','random'),
  'https://other-provider.example/region-a/paid/services/random/agentpay/invoke');
});

test('public HTTP and HTTPS Provider profiles share canonical identity rules',()=>{
 for(const scheme of ['http','https'])for(const id of ['echo','document-render']){
  const mcpEndpoint=`${scheme}://provider.example/region/services/${id}/mcp/invoke`;
  const paymentEndpoint=`${scheme}://provider.example/region/services/${id}/agentpay/invoke`;
  const current={...profile,serviceId:id,mcpEndpoint,paymentEndpoint};
  assert.equal(paymentEndpointForService(mcpEndpoint,id),paymentEndpoint);
  assert.match(hashServiceProfile(current),/^0x[0-9a-f]{64}$/);
  assert.notEqual(hashServiceProfile(current),hashServiceProfile({...current,providerId:'provider:other'}));
 }
 for(const prefix of ['ftp://provider.example','file://provider.example','http://user:pass@provider.example'])assert.throws(()=>paymentEndpointForService(prefix+'/services/echo/mcp/invoke','echo'));
});
