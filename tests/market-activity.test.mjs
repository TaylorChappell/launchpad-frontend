import test from 'node:test';
import assert from 'node:assert/strict';
import { recentProjectUpdate, newerComment } from '../src/market-activity.ts';
test('the announcement bell is shown only during its first hour',()=>{
 const now=2_000_000_000_000;
 assert.equal(recentProjectUpdate(now,now),true);
 assert.equal(recentProjectUpdate(now-3_599_999,now),true);
 for(const at of [null,undefined,NaN,now+1,now-3_600_000]) assert.equal(recentProjectUpdate(at,now),false);
});
test('unread comments compare timestamp and id and tolerate older snapshots',()=>{
 const read={createdAt:100,id:'b'};
 assert.equal(newerComment({createdAt:100,id:'c'},read),true);
 assert.equal(newerComment({createdAt:101,id:'a'},read),true);
 assert.equal(newerComment(read,read),false);
 assert.equal(newerComment({createdAt:100,id:'a'},read),false);
 assert.equal(newerComment({createdAt:99,id:'z'},read),false);
 assert.equal(newerComment(read,null),true);
 assert.equal(newerComment(null,read),false);
});
