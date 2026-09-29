import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rippleCheckLabel, rippleSol } from '../src/ripple-admin.ts';
const check={auditCandidate:false,reason:null,claimedSignature:null,amountLamports:'0',epochStatus:null,outcome:null,effectiveScore:300,expiresAt:200,pendingReason:'awaiting_funding'};
test('admin distinguishes unfunded, expired, historical and funded checks',()=>{
  assert.equal(rippleCheckLabel(check,100),'Awaiting funding');
  assert.equal(rippleCheckLabel(check,200),'Catch-up expired');
  assert.equal(rippleCheckLabel({...check,auditCandidate:true},100),'Historical $0 · review');
  assert.equal(rippleCheckLabel({...check,amountLamports:'1000',outcome:'allocated',epochStatus:'planned'},300),'Awaiting settlement');
  assert.equal(rippleCheckLabel({...check,amountLamports:'1000',epochStatus:'claimable'},300),'Claimable');
  assert.equal(rippleCheckLabel({...check,amountLamports:'1000',claimedSignature:'tx'},300),'Claimed');
  assert.equal(rippleCheckLabel({...check,effectiveScore:0},100),'No new engagement');
  assert.equal(rippleCheckLabel({...check,reason:'Repeated content'},100),'Excluded');
  assert.notEqual(rippleSol('1'),rippleSol('0'));
});
