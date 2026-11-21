import {expect,it} from 'vitest';
import {getRulerUserId,royalPopulationIdentity,isRoyalTitleLabel} from './RoyalPopulationIdentity';
import {civilGovernorCandidates} from './CivilAdministrationRules';
const royal:any={id:'qi-ruler-1',houseName:'田氏',givenName:'绍',bornYear:-600,accessionYear:0,endYear:240,reignOrdinal:1,status:'deposed'};
const dynasties:any=[{factionId:'qi',rulers:[royal]}];
it('resolves a deposed native ruler through permanent population identity independently of title text',()=>{const u={id:getRulerUserId(royal.id),bornMonth:royal.bornYear,name:'别名',player:{}};expect(royalPopulationIdentity(u,dynasties)?.id).toBe(royal.id);expect(royalPopulationIdentity({...u,id:7},dynasties)).toBeUndefined();expect(isRoyalTitleLabel('齐王田绍',dynasties)).toBe(true);expect(isRoyalTitleLabel('田绍',dynasties)).toBe(false);expect(isRoyalTitleLabel('王田绍',dynasties)).toBe(false);expect(isRoyalTitleLabel('欧阳田绍',dynasties)).toBe(false);});
it('excludes ever-enthroned royal bodies but never identifies an unrelated namesake as a monarch',()=>{const u:any={id:getRulerUserId(royal.id),bornMonth:-600,name:'齐王田绍',role:'NORMAL',player:{},isDestroyed:false},v={...u,id:7};const t:any={name:'qi',users:new Set([u,v])};expect(civilGovernorCandidates(240,t,[],[],'epoch',()=>undefined,[],dynasties).map(r=>r.sourceUserId)).toEqual([7]);});
