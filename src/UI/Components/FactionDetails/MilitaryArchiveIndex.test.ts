import {it,expect} from 'vitest';
import {createMilitaryArchiveIndex} from './MilitaryArchiveIndex';
import type {WorldEvent} from '../../../History/WorldHistory';
it('shares actor/target/faction evidence once and preserves the source order across service countries',()=>{
 const events=[{id:'new',actorFactionId:'a',targetFactionId:'b',factionIds:['a','b']},{id:'other',actorFactionId:'c'},{id:'old',actorFactionId:'b',factionIds:['a']} ] as WorldEvent[];
 const index=createMilitaryArchiveIndex(events);expect(index.related(new Set(['a','b'])).map(e=>e.id)).toEqual(['new','old']);expect(index.factions.get('a')).toEqual([events[0],events[2]]);
 expect(events.map(e=>e.id)).toEqual(['new','other','old']);
});
it('a new hydrated snapshot retains its own source identities even if all event IDs are reused',()=>{
 const a=[{id:'same',actorFactionId:'a',title:'old'}] as WorldEvent[],b=structuredClone(a);b[0].title='hydrated';
 const old=createMilitaryArchiveIndex(a).related(new Set(['a']))[0],next=createMilitaryArchiveIndex(b).related(new Set(['a']))[0];expect(old).not.toBe(next);expect(next.title).toBe('hydrated');
});
