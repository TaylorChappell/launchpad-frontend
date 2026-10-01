import test from 'node:test';
import assert from 'node:assert/strict';
import {cardAmount,cardRawAmount,cardTrend} from '../src/market-card.ts';

test('card amounts distinguish zero, unavailable and tiny rewards across asset decimals',()=>{
  assert.equal(cardAmount(1800000,true),'$1.8M');
  assert.equal(cardAmount(0,true),'$0');
  for(const value of [undefined,null,NaN,Infinity,-1])assert.equal(cardAmount(value,true),'-');
  assert.equal(cardRawAmount('1',9),'<0.01');
  assert.equal(cardRawAmount('12000000',9),'0.01');
  assert.equal(cardRawAmount('1500000',6),'1.5');
  for(const [raw,decimals] of [['bad',9],['-1',9],['1',-1],['1',2.5],['1',255],[undefined,9]])assert.equal(cardRawAmount(raw,decimals),'-');
});

test('mini-chart uses ordered real observations and handles flat, sparse and invalid data',()=>{
  const p=(sampledAt,priceUsd)=>({sampledAt,priceUsd});
  assert.equal(cardTrend([]),null);
  assert.equal(cardTrend([p(1,10),p(1,11)]),null);
  assert.equal(cardTrend([p(1,NaN),p(2,-1),p(3,1)]),null);
  const flat=cardTrend([p(2,10),p(1,10)]);
  assert.equal(flat.path,'M2.00,36.00 L178.00,36.00');
  const down=cardTrend([p(30,1),p(10,3),p(20,2),p(20,2.5)]);
  assert.equal(down.falling,true);
  assert.equal(down.path,'M2.00,10.00 L90.00,23.50 L178.00,64.00');
  const many=cardTrend(Array.from({length:1000},(_,i)=>p(i+1,i+1)));
  assert.equal(many.path.split(' ').length,48);
  assert.ok(many.path.startsWith('M2.00,64.00'));
  assert.ok(many.path.endsWith('L178.00,10.00'));
});
