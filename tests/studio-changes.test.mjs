import { test } from 'node:test';
import assert from 'node:assert/strict';
import { studioChangeList } from '../src/studio-changes.ts';

const state=()=>({launch:{name:'Old',symbol:'TEST',description:'Concept'},lockedFields:['symbol'],files:[{path:'frontend/index.html',content:'old',encoding:'utf8',locked:false},{path:'frontend/locked.css',content:'kept',encoding:'utf8',locked:true},{path:'frontend/remove.js',content:'',encoding:'utf8',locked:false}]});
test('lists effective additions, edits, deletes and fields with human labels',()=>{
  const result={launch:{name:'New',symbol:'CHANGED',description:'Concept'},files:[{path:'frontend/index.html',content:'new',encoding:'utf8'},{path:'frontend/new.css',content:'body{}',encoding:'utf8'},{path:'frontend/locked.css',content:'bad',encoding:'utf8'}],deletePaths:['frontend/remove.js','frontend/locked.css','missing']};
  assert.deepEqual(studioChangeList(state(),result).map(c=>c.label),['Update Coin name','Update file','Add file','Delete file']);
});
test('plain chat, identical files and locked changes do not trigger approval',()=>{
  assert.deepEqual(studioChangeList(state(),{files:[],deletePaths:[]}),[]);
  assert.deepEqual(studioChangeList(state(),{launch:{symbol:'NO'},files:[state().files[0]],deletePaths:['frontend/locked.css']}),[]);
});
test('a replacement is not misleadingly listed as a deletion too',()=>{
  const changes=studioChangeList(state(),{files:[{path:'frontend/remove.js',content:'new',encoding:'utf8'}],deletePaths:['frontend/remove.js']});
  assert.deepEqual(changes.map(c=>c.label),['Update file']);
});
