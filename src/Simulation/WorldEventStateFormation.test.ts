import {expect,it,vi,beforeEach} from 'vitest';
import WorldEventSystem from './WorldEventSystem';
import History from '../History/WorldHistory';
import random from './WorldRandom';
import {formFactionState} from './FactionIdentity';
vi.mock("../Components/Team", () => ({ default: class Team {} }));
vi.mock("../Components/City", () => ({ default: class City {}, getFactionDevelopmentLevel: () => 0, getFactionStability: (t:any) => t.stability }));
vi.mock("../Game/Game", () => ({ default: { Core: { map: undefined } } }));
vi.mock("../History/WorldHistory", () => ({ default: {snapshotPoliticalTransaction:()=>({}),rollbackPoliticalTransaction:vi.fn(),addStateFounded:vi.fn(()=>"state-event")} }));
vi.mock("../Live/Danmu", () => ({ default: { Apply: vi.fn() } }));
vi.mock("../Live/LocalDanmaku", () => ({ createLocalDanmu: vi.fn() }));
vi.mock("../store", () => ({ store: { dispatch: vi.fn() } }));
vi.mock("../store/rootSlice", () => ({ setWorldPhase: vi.fn(), setWorldResult: vi.fn() }));
vi.mock("./FactionRegistry", () => ({ default: {} }));
vi.mock("./WorldRemnants", () => ({ default: {} }));
vi.mock("./FactionEffects", () => ({ default: {} }));
vi.mock("./WorldExiles", () => ({ default: {} }));
vi.mock("./ImperialStrain", () => ({ calculateImperialStrain: vi.fn() }));
vi.mock("./WorldPhase", () => ({ getWorldPhase: vi.fn() }));
vi.mock("./CityNameRegistry", () => ({ default: {} }));

vi.mock("../Components/Block", () => ({ default: class Block {} }));
vi.mock("../Politics/Dynasty", () => ({ default: {getCurrentRuler:()=>({id:"ruler",reignOrdinal:1,accessionYear:0}),getRulerDisplay:()=>"首领",snapshotSuccessionTransaction:()=>({}),rollbackSuccessionTransaction:vi.fn(),recordStateFounded:vi.fn()} }));
vi.mock("./SovereigntyModifiers", () => ({ getEffectiveStability: vi.fn(), getRestorationWeightMultiplier: vi.fn() }));
vi.mock("./EmpireSplitRules", () => ({ selectSplitCities: vi.fn(), selectSplitCore: vi.fn(), shouldRestoreBeforeNewRebel: vi.fn() }));
vi.mock("./CityZoneSpatial", () => ({ getCandidateFortifiedGridCells: vi.fn(), hasZoneOverlapOrGapViolation: vi.fn() }));


function fixture(){const t:any={name:'frontier-id',displayName:'边地义军',factionType:'FRONTIER',identityStage:'PROVISIONAL',status:'ACTIVE',currentActiveSinceYear:0,sovereigntyRank:'LEADER',sovereigntyHistory:[{rank:'LEADER',startMonth:0}],nameHistory:[{name:'边地义军',startMonth:0,reason:'initial'}],cities:[{id:'a',name:'无终'},{id:'b',name:'重名'},{id:'c',name:'重名'}],stability:52,blocks:{children:{size:100}},joinCommand:[],capital:'无终'};
 t.formState=vi.fn((name:string,m:number)=>formFactionState(t,name,m));
 const system:any=new WorldEventSystem();system.cycleDiagnostics.fragmentationAge=1200;
 return {t,system,check:(m:number)=>system.checkStateFormation(m,[t],100)};}
beforeEach(()=>{vi.clearAllMocks();random.initialize('de-facto-z37');});
it('the real monthly production evaluator completes the de-facto frontier path only after twenty-four continuous months',()=>{const {t,check}=fixture();const rng=random.exportState();check(1200);expect(t.stateFormationEligibilityKind).toBe('DE_FACTO');check(1223);expect(t.formState).not.toHaveBeenCalled();expect(random.exportState()).toEqual(rng);check(1224);expect(t).toMatchObject({identityStage:'STATE',sovereigntyRank:'KING',name:'frontier-id',stateFoundedMonth:1224});expect(History.addStateFounded).toHaveBeenCalledTimes(1);const formed=random.exportState();check(1225);expect(t.formState).toHaveBeenCalledTimes(1);expect(random.exportState()).toEqual(formed);});
it('the actual production path resets interrupted de-facto eligibility and prioritizes a separate ordinary window',()=>{const {t,check}=fixture();check(1200);t.stability=40;check(1220);expect(t.stateFormationEligibleSinceMonth).toBeUndefined();t.stability=52;check(1230);expect(t.stateFormationEligibilityKind).toBe('DE_FACTO');check(1253);expect(t.formState).not.toHaveBeenCalled();t.stability=60;check(1253);expect(t.stateFormationEligibilityKind).toBe('ORDINARY');check(1264);expect(t.formState).not.toHaveBeenCalled();check(1265);expect(t.identityStage).toBe('STATE');});
it('a rejected formal transaction restores naming RNG and leaves neither a state name nor a historical founding',()=>{const {t,check}=fixture();check(1200);t.formState.mockImplementation(()=>false);const before=random.exportState();check(1224);expect(t.formState).toHaveBeenCalledTimes(1);expect(t.identityStage).toBe('PROVISIONAL');expect(t.displayName).toBe('边地义军');expect(t.nameHistory).toHaveLength(1);expect(random.exportState()).toEqual(before);expect(History.addStateFounded).not.toHaveBeenCalled();});
