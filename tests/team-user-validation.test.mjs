import assert from 'node:assert/strict'
import test from 'node:test'
import {staffRoles,validateManualTeamUser} from '../lib/teamUser.ts'

const valid={full_name:'Nensy Patel',email:'NENSY@EXAMPLE.COM',phone:'+919876543210',admin_role:'sales',job_title:'Sales Executive',temporary_password:'Solar#Team2026'}

test('accepts and normalizes a valid manual team user',()=>{const result=validateManualTeamUser(valid);assert.equal(result.error,undefined);assert.deepEqual(result.data,{...valid,email:'nensy@example.com',admin_role:'sales'})})
test('allows every supported specialist role',()=>{for(const role of staffRoles)assert.equal(validateManualTeamUser({...valid,admin_role:role}).data?.admin_role,role)})
test('rejects authority escalation and weak credentials',()=>{assert.match(validateManualTeamUser({...valid,admin_role:'admin'}).error,/valid department role/i);assert.match(validateManualTeamUser({...valid,temporary_password:'password1234'}).error,/uppercase, lowercase, number and symbol/i)})
test('requires an international-format mobile number when supplied',()=>{assert.match(validateManualTeamUser({...valid,phone:'9876543210'}).error,/country code/i);assert.equal(validateManualTeamUser({...valid,phone:''}).data?.phone,null)})
