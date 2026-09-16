import test from 'node:test'
import assert from 'node:assert/strict'
import {galleryKeyIndex,gallerySwipe} from '../lib/gallery-interactions.ts'
const start={id:1,x:200,y:200,at:100}
const end=(patch={})=>({id:1,x:100,y:205,at:400,...patch})
test('gallery arrows wrap to the first and last photo',()=>{assert.equal(galleryKeyIndex('ArrowLeft',0,3),2);assert.equal(galleryKeyIndex('ArrowRight',2,3),0)})
test('Home and End select exact gallery boundaries',()=>{assert.equal(galleryKeyIndex('Home',2,3),0);assert.equal(galleryKeyIndex('End',0,3),2)})
test('non-navigation keys remain native',()=>{for(const key of ['Tab','Escape','Enter',' ','ArrowDown'])assert.equal(galleryKeyIndex(key,1,3),null)})
test('zero/one-image and malformed counts do not navigate',()=>{for(const count of [0,1,-1,NaN,Infinity,1.5])assert.equal(galleryKeyIndex('ArrowRight',0,count),null)})
test('a stale gallery index is clamped before navigation',()=>{assert.equal(galleryKeyIndex('ArrowRight',99,3),0);assert.equal(galleryKeyIndex('ArrowLeft',-3,3),2)})
test('horizontal swipes select the next or previous photo',()=>{assert.equal(gallerySwipe(start,end()),1);assert.equal(gallerySwipe(start,end({x:300})),-1)})
test('vertical page scroll must not change the image',()=>assert.equal(gallerySwipe(start,end({x:110,y:410})),0))
test('diagonal gestures are not treated as intentional horizontal swipes',()=>assert.equal(gallerySwipe(start,end({x:100,y:290})),0))
test('taps and tiny movements do not advance',()=>{assert.equal(gallerySwipe(start,end({x:200})),0);assert.equal(gallerySwipe(start,end({x:151})),0)})
test('cancelled and multi-touch state cannot finish a stale swipe',()=>{assert.equal(gallerySwipe(null,end()),0);assert.equal(gallerySwipe(start,null),0);assert.equal(gallerySwipe(start,end({id:2})),0)})
test('long presses and invalid timestamps do not trigger navigation',()=>{assert.equal(gallerySwipe(start,end({at:1401})),0);assert.equal(gallerySwipe(start,end({at:99})),0);assert.equal(gallerySwipe(start,end({at:Infinity})),0)})
test('non-finite positions cannot change gallery state',()=>{assert.equal(gallerySwipe(start,end({x:NaN})),0);assert.equal(gallerySwipe({...start,y:Infinity},end()),0)})
