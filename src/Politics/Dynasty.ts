import {planRoyalHonor,royalHonorText,royalHonorCandidateClaims,type RoyalHonor} from './RoyalHonors';
import {beginPoliticalMutation} from '../Simulation/PoliticalMutationScope';
import {validateMilitaryUsurpers} from "../Persistence/MilitaryUsurperValidation";
import {exportRulerSave} from "../Persistence/RulerSaveProjection";
import {selectMilitaryUsurper,auditMilitaryUsurpers,militaryUsurperIdentity,type MilitaryUsurperIdentity} from "./MilitaryUsurpation";
import {politicalEffect} from "../Simulation/PoliticalMutationScope";
import {successionTransaction} from "./SuccessionTransaction";
import {capturePoliticalCrisis,politicalCapital} from "./PoliticalEventNarrative";
import {verifiedPoliticalOffice} from "./MilitaryPoliticalInfluence";
import {splitEstablishedPersonalName} from "./NameCulture";
import {deriveMilitaryLifeSchedule} from "./MilitaryLifeRules";
import type {MilitarySecessionEvidence} from "../Simulation/MilitarySecession";
import { derivePoliticalSuccessionShocks } from "./PoliticalSuccessionCrisis";
import { planInitialRoyalHousehold } from "./InitialRoyalHousehold";
import { hasRecordedRulerDeath, type RulerDeathReason } from "./RulerLifeState";
import { CurrentRulerLookup } from "./CurrentRulerLookup";
import {nobleEpochForRuler} from "./MilitaryNobility";
import { beginHouseEpoch, evaluateDynasticRevolution, getRevolutionEligibility, type DynastyHouseEpoch, type RevolutionContext } from "./DynasticRevolution";
import { RevolutionGateDiagnostics } from "./RevolutionGateDiagnostics";
import { createStateName } from "../Simulation/StateNameGenerator";
import { getFactionDisplayNameAtMonth,renameFactionDisplayName } from "../Simulation/FactionIdentity";
import Team from "../Components/Team";
import { getFactionStability } from "../Components/City";
import Game from "../Game/Game";
import { getPopulationCapacity } from "../Simulation/PopulationSystem";
import FactionEffects from "../Simulation/FactionEffects";
import {
  HEIR_PARENT_MAX_AGE_AT_BIRTH,
  HEIR_PARENT_MIN_AGE_AT_BIRTH,
  RULER_COMBAT_MIN_AGE,
  RULER_MAX_AGE_AT_ACCESSION,
  RULER_MIN_AGE_AT_ACCESSION,
} from "../config/simulation";
import WorldHistory from "../History/WorldHistory";
import MilitaryCommandRegistry from "./MilitaryCommandRegistry";
import { militaryParticipationMetadata } from "./MilitaryPoliticalInfluence";
import { captureAccessionCapital } from "../History/AccessionCapitalContext";
import {
  calculateSuccessionEffect,
  pickRulerGivenName,
} from "./SuccessionRules";
import { shouldDynastyContinue } from "../Simulation/FactionLifecycle";
import { monthsToYears, yearsToMonths } from "../Simulation/WorldTime";
import WorldRemnants from "../Simulation/WorldRemnants";
import { shouldCreateActiveHeir } from "./ExileRules";
import {
  createRulerChronicle,
  finishRulerChronicle,
  observeRulerPeak,
  recordPersonalCityCapture,
  RulerChronicle,
  RulerReignSnapshot,
} from "./RulerChronicle";
import { ProvisionalRulerDiagnosticsSession, type ProvisionalFactionRecord } from "./ProvisionalRulerDiagnostics";
import { checkRulerBattleHazard, hasRecentPersonalSiegeContact } from "./RulerBattleRules";
import { createTerminalRulerSnapshot } from "./RulerTerminalSnapshot";
import { getNextRulerReignOrdinal } from "./RulerOrdinalRules";
import {
  formatRulerTitleAtMonth,
  getRulerTitleAtMonth,
  getNaturalDeathVerbForTitle,
  getSuccessionVerbForTitle,
} from "./RulerTitleRules";
import { getSuccessionShockMultiplier } from "../Simulation/SovereigntyModifiers";
import { finalizeRulerPosthumousNames } from "./PosthumousRules";
import worldRandom from "../Simulation/WorldRandom";
import { createSuccessorDynastyHouseName } from "./DynastySurnameGenerator";
import { getUnrelatedSuccessorRelation } from "./DynastySuccessionIdentity";
import { cultureGivenNamePools, deriveNameCulture, hanGivenNamePool } from "./NameCulture";
import {
  createNaturalDeathMonth,
  createSurvivingResidentDeathMonth,
  deriveHeirBirthMonth,
  isNaturallyDeadByMonth,
} from "./RulerLifespanRules";
import { predeceasedParentByMonth } from "./RulerPresentationRules";
import {
  getCandidateParentsToReplenish,
  getDynasticCandidateCap,
  selectActiveDynasticCandidateIds,
  selectRecordedDynasticSuccessor,
} from "./DynasticCandidateRules";
import { chooseDepositionClaimant, evaluateDepositionOpportunity, InReignDepositionDiagnostics, type DepositionEvaluation, type DepositionRiskGroup } from "./InReignDeposition";
import {getRecordedKinRelation} from "./DynasticCandidateRules";
import type { RecordedKinRelation } from "./DynasticCandidateRules";

export type RulerStatus = "ruling" | "exiled" | "heir" | "kin" | "dead" | "abdicated" | "politically-ended" | "deposed";
export type RulerRelationType =
  | "FOUNDER"
  | "DIRECT_CHILD"
  | "GRANDCHILD"
  | "SIBLING"
  | "NEPHEW"
  | "UNCLE"
  | "COUSIN"
  | "COLLATERAL_KIN"
  | "USURPER"
  | "NEW_HOUSE"
  | "LEADER_SUCCESSOR";

export interface ResidentFounderIdentity {
  military?:MilitarySecessionEvidence;
  personId: string; sourceUserId: number; sourceUserLabel: string; bornMonth: number;
  sourceFactionId: string; sourceFactionName: string; foundedMonth: number; cityId: string; cityName: string;
}

export interface RoyalMilitaryIdentity {
  personId: string; sourceUserId: number; sourceUserLabel: string; enteredMonth: number;
}
export interface Ruler {
  royalHonors?:RoyalHonor[];
  militaryUsurperIdentity?:MilitaryUsurperIdentity;
  militaryIdentity?: RoyalMilitaryIdentity;
  /** Permanent resident identity; this record owns its life even when no map entity exists. */
  residentIdentity?: ResidentFounderIdentity;
  regimeNameAtEnd?: string;
  id: string;
  houseName: string;
  givenName: string;
  bornYear: number;
  /** Scheduled lifespan, not an observed death. */
  naturalDeathYear?: number;
  deathMonth?: number;
  deathReason?: RulerDeathReason;
  lastBattleHazardCheckMonth?: number;
  lastPersonalSiegeContactMonth?: number;
  displacedByUsurpationMonth?: number;
  accessionYear?: number;
  plannedEndYear?: number;
  endYear?: number;
  politicalStartYear?: number;
  politicalEndYear?: number;
  parentId?: string;
  predecessorId?: string;
  relationType?: RulerRelationType;
  reignOrdinal?: number;
  accessionCause?: "SUCCESSION" | "DEPOSITION";
  endReason?: string;
  status: RulerStatus;
  chronicle?: RulerChronicle;
  posthumousEpithet?: string;
  posthumousEpithetReasons?: string[];
  templeName?: string;
  templeNameReasons?: string[];
}

export interface Dynasty {
  houseEpochs?: DynastyHouseEpoch[];
  factionId: string;
  houseName: string;
  rulers: Ruler[];
  currentRulerId: string | null;
  heirIds: string[];
  designatedHeirId?: string;
  designatedSinceMonth?: number;
  lastRulerBattleDeathYear?: number;
  lastDepositionAttemptMonth?: number;
}

const rulerGivenNamePool = hanGivenNamePool;

function getRulerGivenNamePool(houseName: string) {
  const culture = deriveNameCulture(houseName);
  return culture === "HAN" ? rulerGivenNamePool : { ...cultureGivenNamePools[culture], singleNames: [], doubleNamePrefixes: [], doubleNameSuffixes: [], doubleNameChancePercent: 0 };
}

class DynastyRegistryStore {
  private dynasties = new Map<string, Dynasty>();
  private currentRulerLookup = new CurrentRulerLookup();
  private sequence = 0;
  private revolutionChecks: Array<{ factionId: string; worldMonth: number; blockers: string[] }> = [];
  private revolutionGateDiagnostics = new RevolutionGateDiagnostics();
  private depositionDiagnostics = new InReignDepositionDiagnostics();
  private depositionRiskGroup: DepositionRiskGroup = "CONSERVATIVE";
  private provisionalDiagnosticsSession = new ProvisionalRulerDiagnosticsSession();

  reset() {
    this.dynasties.clear();
    this.currentRulerLookup.reset();
    this.sequence = 0;
    this.revolutionChecks = [];
    this.revolutionGateDiagnostics.reset();
    this.depositionDiagnostics.reset();
    this.depositionRiskGroup = "CONSERVATIVE";
    this.provisionalDiagnosticsSession.reset([]);
  }

  exportState(): {dynasties:Dynasty[];sequence:number} {
    return {
      dynasties: [...this.dynasties.values()].map((dynasty) => ({
        ...dynasty,
        houseEpochs: dynasty.houseEpochs?.map((epoch) => ({ ...epoch })),
        rulers: dynasty.rulers.map((ruler) => ({ ...ruler, royalHonors:ruler.royalHonors?structuredClone(ruler.royalHonors):undefined,militaryIdentity:ruler.militaryIdentity?{...ruler.militaryIdentity}:undefined, militaryUsurperIdentity:ruler.militaryUsurperIdentity?structuredClone(ruler.militaryUsurperIdentity):undefined,residentIdentity:ruler.residentIdentity?structuredClone(ruler.residentIdentity):undefined, chronicle: ruler.chronicle ? structuredClone(ruler.chronicle) : undefined })),
        heirIds: [...dynasty.heirIds],
      })),
      sequence: this.sequence,
    };
  }

  listForDiagnostics() {
    return [...this.dynasties.values()];
  }

  getProvisionalSessionDiagnostics(factions: Map<string, ProvisionalFactionRecord>) {
    return this.provisionalDiagnosticsSession.summarize(this.listForDiagnostics(), factions);
  }

  snapshotSuccessionTransaction(){return {state:structuredClone(this.exportState()),owners:new Map([...this.dynasties].map(([id,d])=>[id,{d,rulers:new Map(d.rulers.map(r=>[r.id,r]))}])),checks:this.revolutionChecks};}
  rollbackSuccessionTransaction(s:ReturnType<DynastyRegistryStore['snapshotSuccessionTransaction']>){
    this.dynasties.clear();for(const old of s.state.dynasties){const owner=s.owners.get(old.factionId)!;for(const key of Object.keys(owner.d))delete (owner.d as any)[key];Object.assign(owner.d,structuredClone(old),{rulers:old.rulers.map(data=>{const r=owner.rulers.get(data.id)!;for(const key of Object.keys(r))delete (r as any)[key];Object.assign(r,structuredClone(data));return r;})});this.dynasties.set(old.factionId,owner.d);}
    this.sequence=s.state.sequence;this.revolutionChecks=s.checks;this.currentRulerLookup.reset();
  }

  importState(state: ReturnType<DynastyRegistryStore["exportState"]>, diagnosticsStartMonth = 0) {
    this.currentRulerLookup.reset();
    this.dynasties = new Map(state.dynasties.map((dynasty) => [dynasty.factionId, {
      ...dynasty,
      houseEpochs: dynasty.houseEpochs?.map((epoch) => ({ ...epoch })),
      rulers: dynasty.rulers.map((ruler) => ({ ...ruler, royalHonors:ruler.royalHonors?structuredClone(ruler.royalHonors):undefined,militaryIdentity:ruler.militaryIdentity?{...ruler.militaryIdentity}:undefined, militaryUsurperIdentity:ruler.militaryUsurperIdentity?structuredClone(ruler.militaryUsurperIdentity):undefined,residentIdentity:ruler.residentIdentity?structuredClone(ruler.residentIdentity):undefined, chronicle: ruler.chronicle ? structuredClone(ruler.chronicle) : undefined })),
      heirIds: [...dynasty.heirIds],
    }]));
    this.sequence = state.sequence;
    this.revolutionChecks = [];
    this.revolutionGateDiagnostics.reset(diagnosticsStartMonth);
    this.depositionDiagnostics.reset(diagnosticsStartMonth);
    this.provisionalDiagnosticsSession.reset(this.listForDiagnostics());
  }

  initializeFaction(team: Team, year: number, initialRoyalHousehold = false, resident?: {user: import("../Components/User").default; origin: ResidentFounderIdentity}) {
    if (this.dynasties.has(team.name)) {
      return this.dynasties.get(team.name);
    }
    if (team.status === "EXTINCT") return undefined;
    const military=resident?.origin.military;
    const sourcePerson=military?MilitaryCommandRegistry.getPerson(military.personId):undefined;
    const established=sourcePerson?splitEstablishedPersonalName(sourcePerson.personalName):undefined;
    if(military&&(!sourcePerson||sourcePerson.status!=="RETIRED"||sourcePerson.politicalRulerId||sourcePerson.sourceUserId!==resident?.user.id||sourcePerson.bornMonth!==resident.user.bornMonth||!established))throw new Error("Invalid military founder");
    const houseName = established?.houseName??team.houseName ?? `${team.name}氏`;
    if(established)team.houseName=established.houseName;
    const ruler = this.createFormalRuler(team, houseName, year, undefined, undefined, resident?.user.bornMonth,sourcePerson&&established?{givenName:established.givenName,naturalDeathMonth:deriveMilitaryLifeSchedule(sourcePerson).naturalDeathMonth}:undefined);
    if (resident) {
      const u=resident.user;
      if(u.isDestroyed||u.team!==team||!team.users.has(u)||u.role!=="NORMAL"||(u.militaryPersonId&&!sourcePerson)||u.historicalPersonId)throw new Error("Invalid resident founder");
      ruler.residentIdentity=structuredClone(resident.origin);
      if(sourcePerson)sourcePerson.politicalRulerId=ruler.id;
      u.historicalPersonId=resident.origin.personId;u.role="RULER";u.rulerId=ruler.id;u.player.setRole("RULER",ruler.id,true);
      Game.Core?.logicalUnitRegistry.updateRole(u.player.logicalUnitId,"RULER",ruler.id);team.rulerUser=u;
    }
    ruler.reignOrdinal = 1;
    ruler.relationType = "FOUNDER";
    const dynasty: Dynasty = {
      factionId: team.name,
      houseName,
      houseEpochs: [{ houseName, startMonth: year, foundingRulerId: ruler.id, startReason: "FOUNDING" }],
      rulers: [ruler],
      currentRulerId: ruler.id,
      heirIds: [],
    };
    this.dynasties.set(team.name, dynasty);
    if (initialRoyalHousehold && year === 0 && team.origin?.type === "INITIAL") {
      this.initializeRoyalHousehold(team, dynasty, ruler, year);
    } else {
      this.ensureActiveHeir(team, dynasty, year, true);
    }
    if (!resident) WorldHistory.addRulerAcceded(year, team.name, this.getRulerTitle(team, ruler, year), ruler.id, captureAccessionCapital(team, year, ruler.id));
    this.ensureRulerUnit(team);
    return dynasty;
  }

  completeResidentFounding(team: Team, month: number) {
    const r=this.getCurrentRuler(team.name);
    if(!r?.residentIdentity)return;
    r.chronicle=createRulerChronicle(createRulerSnapshot(team,month));
    WorldHistory.addRulerAcceded(month,team.name,this.getRulerTitle(team,r,month),r.id,{
      ...captureAccessionCapital(team,month,r.id),residentPersonId:r.residentIdentity.personId,
      sourceUserId:r.residentIdentity.sourceUserId,sourceFactionId:r.residentIdentity.sourceFactionId,foundingCityId:r.residentIdentity.cityId,
    });
  }

  /** Permanent identity lookup is independent of present office, faction and map entity. */
  findResidentPerson(personId: string) {
    for(const d of this.dynasties.values())for(const r of d.rulers)if(r.residentIdentity?.personId===personId)return r;
    return undefined;
  }

  recordResidentEntityDeath(personId: string, month: number) {
    const r=this.findResidentPerson(personId);
    if(!r||hasRecordedRulerDeath(r))return;
    // Current rulers must go through the existing protected royal death/succession transaction.
    if(r.status==="ruling"||r.status==="exiled"){
      const team=Game.Core?.teams.find(t=>this.get(t.name)?.currentRulerId===r.id),d=team?this.get(team.name):undefined;
      if(team&&d){if(team.rulerUser?.historicalPersonId===personId)team.rulerUser=undefined;this.succeedRuler(team,d,r,month,"combat");return;}
    }
    r.status="dead";r.deathMonth=month;r.deathReason="战死";
    if(r.residentIdentity?.military)MilitaryCommandRegistry.mirrorPoliticalDeath(r.residentIdentity.military.personId,r.id,month,"BATTLE_DEATH");
    const team=Game.Core?.teams.find(t=>this.get(t.name)?.rulers.includes(r));
    if(team)WorldHistory.addRulerDied(month,team.name,this.getRulerTitle(team,r,month),{rulerId:r.id,deathReason:r.deathReason,age:Math.floor((month-r.bornYear)/12)});
  }

  getRoyalMilitaryCandidates(team: Team, month: number) {
    const dynasty = this.get(team.name), current = this.getCurrentRuler(team.name);
    if (!dynasty || !current || team.status !== "ACTIVE" || team.identityStage !== "STATE" || !team.spawnBlock) return [];
    return dynasty.rulers.filter(r => !r.militaryIdentity && !r.residentIdentity && r.reignOrdinal === undefined &&
      (r.status === "heir" || r.status === "kin") && r.bornYear <= month - 18*12 && r.naturalDeathYear !== undefined && r.naturalDeathYear > month &&
      month < deriveMilitaryLifeSchedule({personId:MilitaryCommandRegistry.nextPersonId(),bornMonth:r.bornYear}).retirementMonth &&
      Boolean(getRecordedKinRelation(r,current,dynasty.rulers)) && !Team.GetUserById(getRulerUserId(r.id)))
      .map(r => ({rulerId:r.id,factionId:team.name}));
  }

  isRoyalMilitaryEligible(user: import("../Components/User").default, month: number) {
    const ruler = user.historicalPersonId ? this.findRoyalMilitaryPerson(user.historicalPersonId) : undefined;
    const d = this.get(user.team.name), current = this.getCurrentRuler(user.team.name);
    return Boolean(ruler && d && current && d.rulers.includes(ruler) && ruler.reignOrdinal === undefined &&
      (ruler.status === "heir" || ruler.status === "kin") && ruler.militaryIdentity?.sourceUserId === user.id &&
      ruler.militaryIdentity.sourceUserLabel === user.name && ruler.bornYear === user.bornMonth &&
      ruler.naturalDeathYear !== undefined && month < ruler.naturalDeathYear && getRecordedKinRelation(ruler,current,d.rulers));
  }

  enlistRoyalMilitary(candidate: {rulerId:string;factionId:string}, team: Team, month: number, members: import("../Components/User").default[]) {
    if (candidate.factionId !== team.name || !this.getRoyalMilitaryCandidates(team,month).some(c => c.rulerId === candidate.rulerId) ||
      MilitaryCommandRegistry.getPeople().filter(p=>p.factionId===team.name&&p.status==="ACTIVE").length >= 2 ||
      MilitaryCommandRegistry.getFormations().filter(f=>f.factionId===team.name&&f.status==="ACTIVE").length >= 2 ||
      members.length !== 0 || new Set(members).size !== members.length ||
      members.some(u=>!team.users.has(u)||u.team!==team||u.isDestroyed||u.role!=="NORMAL"||u.rulerId||u.player.rulerId||!u.player.logicalUnitId||MilitaryCommandRegistry.isAssigned(u.player.logicalUnitId))) return false;
    const ruler = this.get(team.name)!.rulers.find(r=>r.id===candidate.rulerId)!;
    const personId = MilitaryCommandRegistry.nextPersonId(), sourceUserId = getRulerUserId(ruler.id), sourceUserLabel = this.getRulerPersonalName(ruler);
    const militaryBefore=MilitaryCommandRegistry.snapshotTransaction(), historyBefore=WorldHistory.exportState();
    const registry=Game.Core?.logicalUnitRegistry, entries=registry?.getEntries().map(e=>({...e,state:{...e.state}})), sequence=registry?.exportState().nextUnitSequence;
    const before=team.users.size, randomBefore=worldRandom.exportState();
    let user: import("../Components/User").default | false | undefined;
    try {
      ruler.militaryIdentity={personId,sourceUserId,sourceUserLabel,enteredMonth:month};
      user=team.makeUser(sourceUserId,sourceUserLabel,undefined,70,"NORMAL",undefined,
        {cause:"RULER_LIFECYCLE",month,deferPopulationAudit:true,context:"宗室首次从军，建立其唯一真实人口单位"},
        {bornMonth:ruler.bornYear,historicalPersonId:personId});
      if (!user || !user.player.logicalUnitId || !MilitaryCommandRegistry.appointRoyal(user,{rulerId:ruler.id,factionId:team.name,naturalDeathMonth:ruler.naturalDeathYear!},month,[user.player.logicalUnitId,...members.map(u=>u.player.logicalUnitId!)])) throw new Error("Royal enlistment refused");
      Game.Core?.simulator?.recordPopulationMutation(team,before,team.users.size,{cause:"RULER_LIFECYCLE",month,context:`宗室${ruler.id}首次从军：唯一User ${sourceUserId}，已有${members.length}名部众编组，不补兵`});
      return true;
    } catch {
      const created=user || Team.GetUserById(sourceUserId);
      if(created?.historicalPersonId===personId) created.destroyUser(true,{cause:"RULER_LIFECYCLE",month,deferPopulationAudit:true});
      delete ruler.militaryIdentity;
      MilitaryCommandRegistry.rollbackTransaction(militaryBefore); WorldHistory.importState(historyBefore); worldRandom.restore(randomBefore);
      if(registry&&entries&&sequence!==undefined)registry.importState(sequence,entries as any);
      return false;
    }
  }

  findRoyalMilitaryPerson(personId: string) {
    return this.getAll().flatMap(d => d.rulers).find(r => r.militaryIdentity?.personId === personId||r.militaryUsurperIdentity?.personId===personId);
  }

  recordRoyalMilitaryBattleDeath(personId: string, month: number, cause: "BATTLE_DEATH" | "SIEGE_LOSS" = "BATTLE_DEATH") {
    const ruler = this.findRoyalMilitaryPerson(personId);
    if (!ruler || hasRecordedRulerDeath(ruler)) return;
    const owner = this.getAll().find(d => d.rulers.includes(ruler))!;
    const team = Game.Core?.teams.find(t => t.name === owner.factionId);
    // A transferred body may be NORMAL abroad while its permanent identity still
    // holds an exiled crown. The casualty has already been accepted by User;
    // complete the same existing succession transaction in the historical polity.
    if ((ruler.status === "ruling" || ruler.status === "exiled") && owner.currentRulerId === ruler.id && team && shouldDynastyContinue(team.status)) {
      if (team.rulerUser?.historicalPersonId === personId) team.rulerUser = undefined;
      this.succeedRuler(team, owner, ruler, month, "combat", cause);
      return;
    }
    ruler.status = "dead"; ruler.deathMonth = month; ruler.deathReason = "战死";
    if (ruler.endYear === undefined) { ruler.endYear=month; ruler.politicalEndYear=month; ruler.endReason="战死"; }
    const dynasty = this.getAll().find(d => d.rulers.includes(ruler))!;
    if(ruler.chronicle){
      ruler.chronicle.deathCause=ruler.deathReason;
      const team=Game.Core?.teams.find(t=>t.name===dynasty.factionId);
      if(team)finalizeRulerPosthumousNames(ruler,dynasty.rulers,team,month);
    }
    dynasty.heirIds = dynasty.heirIds.filter(id => id !== ruler.id);
    if (dynasty.designatedHeirId === ruler.id) { dynasty.designatedHeirId = undefined; dynasty.designatedSinceMonth = undefined; }
    WorldHistory.addRulerDied(month, dynasty.factionId, this.getRulerPersonalName(ruler), {rulerId:ruler.id, deathReason:ruler.deathReason, age:Math.floor((month-ruler.bornYear)/12)});
  }

  private settleRoyalMilitaryAccession(ruler: Ruler, month: number) {
    if (!ruler.militaryIdentity) return;
    MilitaryCommandRegistry.endPersonCommands(ruler.militaryIdentity.personId, month, "DISMISSED");
    const person = MilitaryCommandRegistry.getPerson(ruler.militaryIdentity.personId);
    if (person) person.politicalRulerId = ruler.id;
  }

  update(year: number, teams: Team[]) {
    // Formerly enthroned deposed rulers keep a life after their polity ends.
    teams.forEach((team) => {
      const archivedDynasty = this.get(team.name);
      if (archivedDynasty) {
        this.archiveNaturallyDeadDeposedRulers(team, archivedDynasty, year);
        this.archiveNaturallyDeadHeirs(archivedDynasty, year, true);
      }
    });
    teams.filter((team) => shouldDynastyContinue(team.status)).forEach((team) => {
      const dynasty = this.initializeFaction(team, 0);
      if (dynasty) {
        this.archiveNaturallyDeadHeirs(dynasty, year);
      }
      const ruler = dynasty ? this.getCurrentRuler(team.name) : undefined;
      if (
        !dynasty ||
        !ruler ||
        ruler.accessionYear === undefined ||
        !isNaturallyDeadByMonth(ruler.naturalDeathYear ?? ruler.plannedEndYear, year)
      ) {
        if (ruler) {
          this.observeRuler(team, ruler, year);
        }
        if (dynasty) {
          this.ensureActiveHeir(team, dynasty, year);
        }
        this.ensureRulerUnit(team);
        if (dynasty && ruler) {this.evaluateInReignDeposition(team, dynasty, ruler, year);this.grantRoyalHonor(team,year);}
        return;
      }
      this.succeedRuler(team, dynasty, ruler, year, "natural");
    });
  }

  grantRoyalHonor(team:Team,month:number){
    const dynasty=this.get(team.name);if(!dynasty)return;
    const grant=planRoyalHonor({faction:team,dynasty,month,countryName:getFactionDisplayNameAtMonth(team,month),issuerTitle:this.getRulerTitleDisplay(team.name,month),people:MilitaryCommandRegistry.getPeople(),formations:MilitaryCommandRegistry.getFormations(),events:WorldHistory.getEventsForFaction(team.name)});
    if(!grant)return;
    const recipient=dynasty.rulers.find(r=>r.id===grant.recipientRulerId)!,old=recipient.royalHonors,history=WorldHistory.snapshotPoliticalTransaction(),rng=worldRandom.exportState(),scope=beginPoliticalMutation();
    try{recipient.royalHonors=[...(old??[]),grant];WorldHistory.addEvent({id:grant.eventId,year:month,type:'royal-honor-granted',category:'politics',importance:'major',actorFactionId:team.name,factionIds:[team.name],rulerId:grant.issuerRulerId,title:royalHonorText(grant),metadata:{recipientRulerId:grant.recipientRulerId,royalHonor:JSON.stringify(grant)}});}
    catch{scope.cancel();recipient.royalHonors=old;const restoring=beginPoliticalMutation();WorldHistory.rollbackPoliticalTransaction(history);worldRandom.restore(rng);restoring.finishRollback();return;}
    scope.commit();return grant;
  }

  markExiled(team: Team, year: number) {
    if (team.status === "EXTINCT") return;
    const existing=this.getCurrentRuler(team.name);
    if(existing?.status==="exiled")return;
    const dynasty = this.initializeFaction(team, 0);
    const ruler = dynasty ? this.getCurrentRuler(team.name) : undefined;
    if (ruler && (ruler.status === "ruling" || ruler.status === "exiled")) {
      ruler.status = "exiled";
    }
    team.removeRulerUnit(true);
    WorldHistory.addDynastyExiled(
      year,
      team.name,
      ruler ? this.getRulerTitle(team, ruler, year) : this.getRulerDisplay(team.name)
    );
  }

  markRestored(team: Team, year: number, cityName: string) {
    if (team.status === "EXTINCT") return;
    const dynasty = this.initializeFaction(team, 0);
    const ruler = dynasty ? this.getCurrentRuler(team.name) : undefined;
    if (ruler && (ruler.status === "ruling" || ruler.status === "exiled")) {
      ruler.status = "ruling";
    }
    this.ensureRulerUnit(team);
    WorldHistory.addDynastyRestored(
      year,
      team.name,
      ruler ? this.getRulerTitle(team, ruler, year) : this.getRulerDisplay(team.name),
      cityName
    );
  }

  markExtinct(team: Team, year: number) {
    const dynasty = this.dynasties.get(team.name);
    const ruler = dynasty ? this.getCurrentRuler(team.name) : undefined;
    if (dynasty?.currentRulerId && !ruler) {
      throw new Error(`Missing current ruler record: ${team.name}/${dynasty.currentRulerId}`);
    }
    // A polity's end is not a person's death. An already ended reign is immutable.
    const offices = dynasty?.rulers.filter(record => record === ruler || record.status === "ruling" || record.status === "exiled") ?? [];
    for (const office of offices) {
      if (hasRecordedRulerDeath(office)) continue;
      if (office.endYear !== undefined) {
        if (office.status === "ruling" || office.status === "exiled") {
          throw new Error(`Ended ruler still holds office: ${team.name}/${office.id}`);
        }
        continue;
      }
      office.status = "politically-ended";
      office.endYear = year;
      office.politicalEndYear = year;
      office.endReason = "政治终结";
      if (office.chronicle) finishRulerChronicle(office.chronicle, createTerminalRulerSnapshot(year));
      // Missing chronicles still close the office; never invent an accession snapshot.
    }
    if (dynasty) {
      this.archiveHeirs(dynasty);
      dynasty.currentRulerId = null;
    }
    team.removeRulerUnit(true);
  }

  markMerged(team: Team, monthIndex: number) {
    this.markAdministrativeEnd(team, monthIndex, "合邦退位");
  }

  private markAdministrativeEnd(team: Team, monthIndex: number, reason: string) {
    const dynasty = this.dynasties.get(team.name);
    if (!dynasty) return;
    const ruler = this.getCurrentRuler(team.name);
    if (ruler && !hasRecordedRulerDeath(ruler) && ruler.endYear === undefined) {
      ruler.status = "abdicated";
      ruler.endYear = monthIndex;
      ruler.politicalEndYear = monthIndex;
      ruler.endReason = reason;
      if (ruler.chronicle) finishRulerChronicle(ruler.chronicle, createRulerSnapshot(team, monthIndex));
    }
    dynasty.rulers.forEach((recordedRuler) => {
      if (recordedRuler.status === "heir" || recordedRuler.status === "exiled") recordedRuler.status = "kin";
    });
    dynasty.heirIds = [];
    dynasty.designatedHeirId = undefined;
    dynasty.designatedSinceMonth = undefined;
    dynasty.currentRulerId = null;
  }

  markSubmitted(team: Team, monthIndex: number) {
    this.markAdministrativeEnd(team, monthIndex, "纳土退位");
  }

  get(factionId: string) {
    return this.dynasties.get(factionId);
  }

  getCurrentRuler(factionId: string) {
    const dynasty = this.dynasties.get(factionId);
    if (!dynasty?.currentRulerId) {
      return undefined;
    }
    return this.currentRulerLookup.get(dynasty);
  }

  hasClaimant(factionId: string) {
    const dynasty = this.dynasties.get(factionId);
    if (!dynasty) {
      return false;
    }
    const current = this.getCurrentRuler(factionId);
    if (current && (current.status === "ruling" || current.status === "exiled")) {
      return true;
    }
    return dynasty.heirIds.some((id) => {
      const heir = dynasty.rulers.find((ruler) => ruler.id === id);
      return Boolean(heir && heir.status === "heir");
    });
  }

  /** Read-only month-boundary claimant check for systems that run before Dynasty.update(). */
  hasClaimantAtMonth(factionId: string, worldMonth: number) {
    const dynasty = this.dynasties.get(factionId);
    if (!dynasty) return false;
    const current = this.getCurrentRuler(factionId);
    if (current && (current.status === "ruling" || current.status === "exiled") &&
        !isNaturallyDeadByMonth(current.naturalDeathYear ?? current.plannedEndYear, worldMonth)) return true;
    return dynasty.heirIds.some((id) => {
      const heir = dynasty.rulers.find((ruler) => ruler.id === id);
      return Boolean(heir && heir.status === "heir" &&
        !isNaturallyDeadByMonth(heir.naturalDeathYear ?? heir.plannedEndYear, worldMonth));
    });
  }

  getRulerDisplay(factionId: string) {
    const ruler = this.getCurrentRuler(factionId);
    if (!ruler) {
      return "无";
    }
    return `${ruler.houseName.replace(/氏$/, "")}${ruler.givenName}`;
  }

  /** Called only after City accepts a siege contact with a real RULER id. */
  recordPersonalSiegeContact(factionId: string, rulerId: string, worldMonth: number) {
    const ruler = this.getCurrentRuler(factionId);
    if (!ruler || ruler.id !== rulerId || ruler.status !== "ruling") return;
    ruler.lastPersonalSiegeContactMonth = worldMonth;
  }

  handleRulerCombatDeath(team: Team, rulerId: string, year: number) {
    const dynasty = this.dynasties.get(team.name);
    const ruler = dynasty?.rulers.find((item) => item.id === rulerId);
    if (!dynasty || !ruler || (ruler.status !== "ruling" && ruler.status !== "exiled") || team.status === "EXTINCT") {
      return true;
    }
    const stability = getFactionStability(team) ?? 100;
    const capitalUnderSiege = Boolean(team.capitalCity?.underSiege);
    const rulerInSiege = hasRecentPersonalSiegeContact(ruler, year);
    const severeCrisis = Boolean(capitalUnderSiege && stability <= 25);
    const monthsSinceLastBattleDeath =
      dynasty.lastRulerBattleDeathYear === undefined
        ? undefined
        : year - dynasty.lastRulerBattleDeathYear;
    const hazardRuler=structuredClone(ruler),hazardRandom=worldRandom.exportState();
    if (!checkRulerBattleHazard(ruler, year, {
      reignMonths: year - (ruler.accessionYear ?? year),
      monthsSinceLastBattleDeath,
      severeCrisis,
      capitalUnderSiege,
      rulerInSiege,
      sovereigntyRank: team.sovereigntyRank,
    })) {
      return false;
    }
    try{return successionTransaction(team,this,()=>{dynasty.lastRulerBattleDeathYear=year;team.rulerUser=undefined;this.succeedRuler(team,dynasty,ruler,year,'combat');return true;});}
    catch(error){for(const key of Object.keys(ruler))delete (ruler as any)[key];Object.assign(ruler,hazardRuler);worldRandom.restore(hazardRandom);throw error;}
  }

  private succeedRuler(...args:Parameters<DynastyRegistryStore['succeedRulerBody']>){return successionTransaction(args[0],this,()=>this.succeedRulerBody(...args));}

  private succeedRulerBody(
    team: Team,
    dynasty: Dynasty,
    predecessor: Ruler,
    year: number,
    reason: "natural" | "combat" | "captured",
    combatCause: "BATTLE_DEATH" | "SIEGE_LOSS" = "BATTLE_DEATH"
  ) {
    if(predecessor.residentIdentity){
      const u=Team.GetUserById(predecessor.residentIdentity.sourceUserId);
      if(u?.historicalPersonId===predecessor.residentIdentity.personId&&reason!=="combat")u.destroyUser(true,{cause:"RULER_LIFECYCLE",month:year,context:"唯一人物生命结束，移除其地图实体"});
    }
    if (predecessor.militaryIdentity||predecessor.militaryUsurperIdentity) {
      const i = predecessor.militaryUsurperIdentity??predecessor.militaryIdentity!, u = Team.GetUserById(i.sourceUserId);
      if (reason !== "combat" && u?.historicalPersonId === i.personId) u.destroyUser(true,{cause:"RULER_LIFECYCLE",month:year});
      MilitaryCommandRegistry.mirrorPoliticalDeath(i.personId,predecessor.id,year,reason === "natural" ? "NATURAL_DEATH" : reason === "captured" ? "CAPTURED" : combatCause);
    }
    predecessor.status = "dead";
    predecessor.regimeNameAtEnd = team.displayName;
    predecessor.endYear = year;
    predecessor.politicalEndYear = year;
    predecessor.deathMonth = year;
    predecessor.endReason =
      reason === "combat" ? "战死" : reason === "captured" ? "被俘处死" : "去世";
    predecessor.deathReason = predecessor.endReason as RulerDeathReason;
    if(predecessor.residentIdentity?.military)MilitaryCommandRegistry.mirrorPoliticalDeath(predecessor.residentIdentity.military.personId,predecessor.id,year,reason==="natural"?"NATURAL_DEATH":reason==="captured"?"CAPTURED":"BATTLE_DEATH");
    if (predecessor.chronicle) {
      finishRulerChronicle(
        predecessor.chronicle,
        createRulerSnapshot(team, year),
        predecessor.endReason
      );
    }
    this.archiveNaturallyDeadHeirs(dynasty, year);
    const displacedDesignatedHeirId = dynasty.designatedHeirId;
    const oldHouseName = dynasty.houseName;
    const oldStateName = team.displayName;
    const oldColor = team.color;
    const previousRulerTitle = this.getRulerTitle(team, predecessor, year);
    let successor = this.consumeHeir(dynasty, predecessor, year);
    const legitimateSuccessor = successor;
    const revolutionContext = this.revolutionContext(team, dynasty, predecessor, successor, year, reason);
    const revolution = evaluateDynasticRevolution(revolutionContext);
    politicalEffect(()=>this.revolutionGateDiagnostics.record(team.name, oldStateName, revolutionContext, revolution));
    this.revolutionChecks = [{ factionId: team.name, worldMonth: year, blockers: revolution.blockers },
      ...this.revolutionChecks.filter((item) => item.factionId !== team.name)].slice(0, 5);
    if (revolution.usurpation) {
      dynasty.rulers.forEach((ruler) => {
        if (ruler.houseName === oldHouseName && (ruler.status === "heir" || ruler.status === "kin")) {
          ruler.status = "kin";
          ruler.displacedByUsurpationMonth = year;
        }
      });
      dynasty.heirIds = [];
      successor = undefined;
    }
    if (!successor && team.status === "ACTIVE" && team.cities.length > 0) {
      const knownDynasties = this.getAll();
      const candidate=revolution.usurpation&&legitimateSuccessor?selectMilitaryUsurper(revolutionContext.military?.candidates??[],MilitaryCommandRegistry.getPeople(),oldHouseName):undefined;
      if(revolution.usurpation){const audit=auditMilitaryUsurpers(revolutionContext.military?.candidates??[],MilitaryCommandRegistry.getPeople(),oldHouseName);politicalEffect(()=>this.revolutionGateDiagnostics.recordPersonalCandidates(audit,candidate?.personId));}
      const person=candidate?MilitaryCommandRegistry.getPerson(candidate.personId):undefined,user=person?team.getUserById(person.sourceUserId):undefined,personal=person&&splitEstablishedPersonalName(person.personalName);
      if(candidate&&(!person||!user||!user.matchesMilitaryLife(person)||!personal))throw Error('Usurper live identity changed before accession');
      const newHouse = personal?.houseName??createSuccessorDynastyHouseName({
        factionType: team.factionType,
        existingHouseNames: knownDynasties.flatMap((item) => item.rulers.map((ruler) => ruler.houseName)),
        recentHouseNames: dynasty.rulers.slice(-8).map((item) => item.houseName),
      });
      successor = person&&candidate&&personal?this.createFormalRuler(team,newHouse,year,undefined,predecessor.id,person.bornMonth,{givenName:personal.givenName,naturalDeathMonth:deriveMilitaryLifeSchedule(person).naturalDeathMonth}):this.createHeir(
        team,
        newHouse,
        year,
        undefined,
        predecessor.id,
        revolution.usurpation ? "USURPER" : getUnrelatedSuccessorRelation(team.identityStage)
      );
      if(person&&candidate&&user&&legitimateSuccessor){
        successor.relationType='USURPER';successor.militaryUsurperIdentity=militaryUsurperIdentity(candidate,person,year,predecessor.id,legitimateSuccessor.id,{roll:revolution.rollResult!,chance:revolution.chance,baselineChance:revolution.baselineChance});
        MilitaryCommandRegistry.endPersonCommands(person.personId,year,'DISMISSED');person.politicalRulerId=successor.id;user.historicalPersonId=person.personId;
      }
      dynasty.houseName = newHouse;
      dynasty.rulers.push(successor);
      team.houseName = newHouse;
      const epochs = dynasty.houseEpochs ?? (dynasty.houseEpochs = [{ houseName: oldHouseName,
        startMonth: predecessor.accessionYear ?? year, foundingRulerId: predecessor.id, startReason: "FOUNDING" }]);
      beginHouseEpoch(epochs, { houseName: newHouse, startMonth: year, foundingRulerId: successor.id,
        startReason: revolution.usurpation ? "USURPATION" : "NATURAL_HOUSE_SUCCESSION",
        displacedHouseName: oldHouseName,
        displacedSuccessorId: revolution.usurpation ? legitimateSuccessor?.id : undefined,
        displacedDesignatedHeirId: revolution.usurpation ? displacedDesignatedHeirId : undefined });
      if (revolution.usurpation) {
        const factions = [...new Set([...(Game.Core?.teams ?? []), team])];
        const newName = createStateName({ capitalName: team.capitalCity?.name },
          [...factions.map((faction) => faction.displayName), newHouse.replace(/氏$/, "")],
          factions.flatMap((faction) => faction.nameHistory.map((entry) => entry.name)), (max) => worldRandom.pickIndex(max));
        renameFactionDisplayName(team, newName, year, "dynastic-revolution");
        const palette = [0xb45309, 0x4f46e5, 0x0d9488, 0xbe123c, 0x7c3aed, 0x15803d, 0x0284c7, 0xa16207]
          .filter((color) => !factions.some((faction) => faction.status === "ACTIVE" && faction.color === color));
        team.setRegimeColor(palette.length ? palette[worldRandom.pickIndex(palette.length)] : oldColor ^ 0x606060, year);
      }
    }
    if (!successor) {
      dynasty.currentRulerId = null;
      WorldHistory.addDynastyLineEnded(
        year,
        team.name,
        this.getRulerPersonalName(predecessor)
      );
      if (
        team.status !== "ACTIVE" &&
        (WorldRemnants.get(team.name)?.population ?? 0) <= 0
      ) {
        team.markExtinct(year);
        this.markExtinct(team, year);
        WorldHistory.addFactionExtinct(
          year,
          team.name,
          `${team.name}国残部已经消散，${dynasty.houseName}王统断绝，${team.name}国彻底灭亡`
        );
      }
      // Settle only after the same-boundary terminal outcome is canonical.
      finalizeRulerPosthumousNames(predecessor, dynasty.rulers, team, year);
      return;
    }
    finalizeRulerPosthumousNames(predecessor, dynasty.rulers, team, year);
    const nextRuler = successor;
    this.settleRoyalMilitaryAccession(nextRuler, year);
    nextRuler.accessionYear = year;
    nextRuler.politicalEndYear = undefined;
    nextRuler.predecessorId = predecessor.id;
    nextRuler.reignOrdinal = nextRuler.reignOrdinal ?? this.getNextReignOrdinal(dynasty);
    nextRuler.plannedEndYear = nextRuler.naturalDeathYear;
    nextRuler.chronicle = createRulerChronicle(createRulerSnapshot(team, year));
    nextRuler.status = team.status === "EXILED" ? "exiled" : "ruling";
    dynasty.currentRulerId = nextRuler.id;
    if (reason === "natural") {
      team.removeRulerUnit(true);
    }

    const reignYears = year - (predecessor.accessionYear ?? year);
    const rule = calculateSuccessionEffect(
      year,
      reignYears,
      dynasty.rulers
        .filter((ruler) => ruler.id !== nextRuler.id && ruler.predecessorId)
        .map((ruler) => ruler.accessionYear)
        .filter((accessionYear): accessionYear is number => accessionYear !== undefined)
        .concat(
          nextRuler.relationType === "NEW_HOUSE" || nextRuler.relationType === "USURPER" ||
            Math.floor(monthsToYears(year - nextRuler.bornYear)) < 16
            ? [year, year]
            : []
        ),
      getSuccessionShockMultiplier(team.sovereigntyRank)
    );
    if (revolution.usurpation && legitimateSuccessor) {
      const eventId = WorldHistory.addDynasticRevolution(year, team.name, nextRuler.id, {
        ...(revolution.militaryParticipant ? militaryParticipationMetadata("REVOLUTION", team.name, year, revolution.militaryParticipant,
          revolution.observedPoliticalShocks.map(s => s.eventId), revolution.baselineChance, revolution.chance, revolution.rollResult,
          { stability: revolutionContext.stability, cityCount: revolutionContext.cityCount, riskTier: revolution.riskTier }, WorldHistory.getEventsForFaction(team.name)) : {}),
        ...captureAccessionCapital(team, year, nextRuler.id, predecessor.id),
        politicalCrisis:JSON.stringify(capturePoliticalCrisis({kind:'REVOLUTION',factionId:team.name,worldMonth:year,countryName:oldStateName,cityCount:revolutionContext.cityCount,stability:revolutionContext.stability,...politicalCapital(captureAccessionCapital(team,year,nextRuler.id,predecessor.id)),successorBornMonth:nextRuler.bornYear},revolution.observedPoliticalShocks.map(s=>s.eventId),revolutionContext.sourceEvents??[])),
        ...(nextRuler.militaryUsurperIdentity?{militaryUsurperIdentity:JSON.stringify(nextRuler.militaryUsurperIdentity),militaryUsurperPersonId:nextRuler.militaryUsurperIdentity.personId}:{}),
        oldHouseName, newHouseName: dynasty.houseName, predecessorRulerId: predecessor.id,
        predecessorRulerName: this.getRulerPersonalName(predecessor), previousRulerTitle,
        displacedSuccessorId: legitimateSuccessor.id, displacedSuccessorName: this.getRulerPersonalName(legitimateSuccessor),
        displacedSuccessorAge: Math.max(0, Math.floor(monthsToYears(year - legitimateSuccessor.bornYear))),
        oldHouseFoundingRulerId: dynasty.houseEpochs?.at(-2)?.foundingRulerId,
        newHouseFoundingRulerId: dynasty.houseEpochs?.at(-1)?.foundingRulerId,
        vulnerabilityEvidence: revolution.evidence.join(","), stability: getFactionStability(team) ?? 100,
        oldStateName, newStateName: team.displayName, oldColor, newColor: team.color,
        successionReason: reason, month: year, actorFactionColor: team.color,
        newRulerName: this.getRulerPersonalName(nextRuler), riskTier: revolution.riskTier,
        ...(revolution.politicalShocks.length ? { crisisEvidence: JSON.stringify(revolution.politicalShocks.map(shock => ({
          kind: shock.kind, eventId: shock.eventId, month: shock.month, cityIds: shock.cityIds, cityNames: shock.cityNames ?? [],
        }))) } : {}),
      });
      nextRuler.chronicle.notableEventIds.push(eventId);
    }
    const effect = FactionEffects.addSuccessionEffect(team.name, year, rule);
    WorldHistory.addRulerSuccession(
      year,
      team.name,
      this.getRulerPersonalName(predecessor),
      this.getRulerPersonalName(nextRuler),
      {
        reason,
        ...captureAccessionCapital(team, year, nextRuler.id, predecessor.id),
        previousRulerTitle,
        rulerPoliticalTitle: getRulerTitleAtMonth(team, year),
        naturalDeathVerb: getNaturalDeathVerbForTitle(getRulerTitleAtMonth(team, year)),
        nextSuccessionVerb: getSuccessionVerbForTitle(
          getRulerTitleAtMonth(team, year)
        ),
        previousRulerId: predecessor.id,
        nextRulerId: nextRuler.id,
        relationType: nextRuler.relationType,
        reignMonths: reignYears,
        reignYears: Math.round(monthsToYears(reignYears)),
        age: Math.round(monthsToYears(year - predecessor.bornYear)),
        actorFactionColor: team.color,
        population: team.users.size,
        populationCapacity: getPopulationCapacity(team),
        territoryPercent:
          (team.blocks.children.size / Math.max(Game.Core?.totalCells ?? 1, 1)) *
          100,
        cityCount: team.cities.length,
        stability: getFactionStability(team) ?? 0,
        factionStatus: team.status,
        effectType: effect.type,
        effectDuration: Math.round(monthsToYears(effect.endYear - effect.startYear)),
        loyaltyRecoveryMultiplier: effect.loyaltyRecoveryMultiplier,
        rebellionRiskMultiplier: effect.rebellionRiskMultiplier,
        recentSuccessionCount: rule.recentSuccessionCount,
      }
    );
    this.ensureActiveHeir(team, dynasty, year);
    this.ensureRulerUnit(team);
    if(nextRuler.militaryUsurperIdentity){
      const errors=validateMilitaryUsurpers({world:{worldMonth:year},dynasties:this.exportState().dynasties.map(d=>({...d,rulers:d.rulers.map(exportRulerSave)})),registries:{militaryCommandRegistry:MilitaryCommandRegistry.exportState()},worldHistory:WorldHistory.exportState(),users:(Game.Core?.teams??[team]).flatMap(t=>[...t.users].map(u=>({userId:u.id,name:u.name,bornMonth:u.bornMonth,factionId:t.name,role:u.role,rulerId:u.rulerId,militaryPersonId:u.militaryPersonId,historicalPersonId:u.historicalPersonId})))} as any);
      if(errors.length)throw Error(errors.join('; '));
    }
  }

  resolveCapturedRuler(team: Team, conqueror: Team, year: number) {return successionTransaction(team,this,()=>this.resolveCapturedRulerBody(team,conqueror,year));}
  private resolveCapturedRulerBody(team: Team, conqueror: Team, year: number) {
    const dynasty = this.dynasties.get(team.name);
    const ruler = dynasty ? this.getCurrentRuler(team.name) : undefined;
    if (!dynasty || !ruler || (ruler.status !== "ruling" && ruler.status !== "exiled") || team.status === "EXTINCT") {
      return false;
    }
    const eventId = WorldHistory.addRulerCaptured(
      year,
      team.name,
      this.getRulerTitle(team, ruler, year),
      conqueror.name,
      this.getRulerTitleDisplay(conqueror.name, year),
      ruler.id
    );
    if (ruler.chronicle) {
      ruler.chronicle.notableEventIds.push(eventId);
    }
    this.succeedRuler(team, dynasty, ruler, year, "captured");
    return this.hasClaimant(team.name);
  }

  ensureRulerUnit(team: Team) {
    if (team.status !== "ACTIVE") {
      team.removeRulerUnit(true);
      return;
    }
    const ruler = this.getCurrentRuler(team.name);
    if (!ruler || ruler.status !== "ruling") {
      return;
    }
    const month = Game.Core?.simulator?.year ?? ruler.accessionYear ?? 0;
    if (Math.floor(monthsToYears(Math.max(0, month - ruler.bornYear))) < RULER_COMBAT_MIN_AGE) {
      team.removeRulerUnit(true);
      return;
    }
    if (team.rulerUser?.rulerId === ruler.id && team.users.has(team.rulerUser)) {
      return;
    }
    team.removeRulerUnit(true);
    if (ruler.militaryIdentity) {
      this.settleRoyalMilitaryAccession(ruler, month);
      const identity = ruler.militaryIdentity;
      const existing = Team.GetUserById(identity.sourceUserId);
      if (existing) {
        if (existing.historicalPersonId !== identity.personId || existing.team !== team || existing.bornMonth !== ruler.bornYear) return;
        existing.role = "RULER"; existing.rulerId = ruler.id; existing.player.setRole("RULER", ruler.id, true);
        Game.Core?.logicalUnitRegistry.updateRole(existing.player.logicalUnitId, "RULER", ruler.id); team.rulerUser = existing;
        return;
      }
    }
    if(ruler.militaryUsurperIdentity){const i=ruler.militaryUsurperIdentity,u=Team.GetUserById(i.sourceUserId);
      if(!u||u.historicalPersonId!==i.personId||u.militaryPersonId!==i.personId||u.bornMonth!==ruler.bornYear||u.team!==team)throw Error('Missing unique usurper body');
      u.role='RULER';u.rulerId=ruler.id;u.player.setRole('RULER',ruler.id,true);Game.Core?.logicalUnitRegistry.updateRole(u.player.logicalUnitId,'RULER',ruler.id);team.rulerUser=u;return;
    }
    if(ruler.residentIdentity){
      const existing=Team.GetUserById(ruler.residentIdentity.sourceUserId);
      if(existing){
        if(existing.historicalPersonId!==ruler.residentIdentity.personId)return; // A recycled live ID is not this person. Never replace it.
        if(existing.team===team){existing.role="RULER";existing.rulerId=ruler.id;existing.player.setRole("RULER",ruler.id,true);Game.Core?.logicalUnitRegistry.updateRole(existing.player.logicalUnitId,"RULER",ruler.id);team.rulerUser=existing;}
        return;
      }
    }
    const name = this.getRulerTitle(team, ruler, month);
    team.makeUser(
      ruler.militaryIdentity?.sourceUserId ?? ruler.residentIdentity?.sourceUserId ?? getRulerUserId(ruler.id),
      ruler.militaryIdentity?.sourceUserLabel ?? ruler.residentIdentity?.sourceUserLabel ?? name,
      undefined,
      100,
      "RULER",
      ruler.id,
      { cause: "RULER_LIFECYCLE", month, context: "ruler unit established" },
      ruler.militaryIdentity ? {bornMonth:ruler.bornYear,historicalPersonId:ruler.militaryIdentity.personId,militaryPersonId:ruler.militaryIdentity.personId} : ruler.residentIdentity ? {bornMonth:ruler.bornYear,historicalPersonId:ruler.residentIdentity.personId,militaryPersonId:ruler.residentIdentity.military?.personId} : undefined
    );
  }

  getInReignDepositionDiagnostics(worldMonth: number) {
    return this.depositionDiagnostics.snapshot(worldMonth);
  }

  /** Test/experiment control. Production callers keep the conservative default. */
  setInReignDepositionRiskGroupForSimulation(riskGroup: DepositionRiskGroup) {
    this.depositionRiskGroup = riskGroup;
  }

  private evaluateInReignDeposition(team: Team, dynasty: Dynasty, current: Ruler, worldMonth: number) {
    if (worldMonth % 12 !== 0) return;
    const recentEvents: import("../History/WorldHistory").WorldEvent[] = [];
    let beforeIndex: number | undefined;
    do {
      const page = WorldHistory.getEventWindow({ factionId: team.name,
        startMonth: worldMonth - 36, endMonth: worldMonth, limit: 256, beforeIndex });
      recentEvents.push(...page.events);
      if (!page.hasOlder) break;
      beforeIndex = page.nextIndex;
    } while (true);
    const evaluation = evaluateDepositionOpportunity({
      factionId: team.name, status: team.status, identityStage: team.identityStage, cityCount: team.cities.length,
      stability: getFactionStability(team), currentRuler: current, rulers: dynasty.rulers,
      houseName: dynasty.houseName, worldMonth, lastAttemptMonth: dynasty.lastDepositionAttemptMonth,
      events: recentEvents, riskGroup: this.depositionRiskGroup,
      military: MilitaryCommandRegistry.getPoliticalInfluence(team, worldMonth, Game.Core?.logicalUnitRegistry),
    });
    if (evaluation.blockers.includes("COOLDOWN")) {
      this.depositionDiagnostics.observe(team.name, worldMonth, evaluation, team.status === "ACTIVE" && team.identityStage === "STATE", "COOLDOWN");
      return;
    }
    if (!evaluation.eligible) {
      this.depositionDiagnostics.observe(team.name, worldMonth, evaluation, team.status === "ACTIVE" && team.identityStage === "STATE");
      return;
    }
    evaluation.royalMilitaryClaims=MilitaryCommandRegistry.getRoyalDepositionClaims(team,worldMonth,evaluation.candidates.map(c=>c.ruler),Game.Core?.logicalUnitRegistry);
    // Exactly one canonical roll per qualified annual boundary. Diagnostics do not touch RNG.
    dynasty.lastDepositionAttemptMonth = worldMonth;
    const roll = worldRandom.next();
    evaluation.militaryRoll = roll;
    const succeeds = roll < evaluation.probability;
    if (!succeeds) {
      this.depositionDiagnostics.observe(team.name, worldMonth, evaluation, team.status === "ACTIVE" && team.identityStage === "STATE", "FAILURE");
      return;
    }
    evaluation.royalHonorClaims=royalHonorCandidateClaims(dynasty,worldMonth,team.sovereigntyRank);
    const selection = chooseDepositionClaimant(evaluation,worldMonth,roll);
    const claimant = selection?.claimant;
    if (selection) evaluation.selection = selection.evidence;
    if (!claimant || !this.commitDeposition(team, dynasty, current, claimant.ruler, claimant.relation, worldMonth, evaluation)) {
      this.depositionDiagnostics.observe(team.name, worldMonth, evaluation, team.status === "ACTIVE" && team.identityStage === "STATE", "FAILURE");
      return;
    }
    this.depositionDiagnostics.observe(team.name, worldMonth, evaluation, team.status === "ACTIVE" && team.identityStage === "STATE", "SUCCESS");
  }

  private commitDeposition(team: Team, dynasty: Dynasty, predecessor: Ruler, successor: Ruler,
    relation: RecordedKinRelation,
    worldMonth: number, evaluation: DepositionEvaluation) {
    if (team.status !== "ACTIVE" || team.cities.length === 0 || dynasty.currentRulerId !== predecessor.id ||
      predecessor.status !== "ruling" || hasRecordedRulerDeath(predecessor) ||
      successor.status !== "heir" && successor.status !== "kin" || successor.reignOrdinal !== undefined ||
      successor.houseName !== dynasty.houseName || !dynasty.rulers.includes(successor) ||
      !evaluation.candidates.some((candidate) => candidate.ruler.id === successor.id) ||
      evaluation.evidence.some((fact) => fact.month > worldMonth)) return false;
    if (evaluation.militaryParticipant && !MilitaryCommandRegistry.getPoliticalInfluence(team, worldMonth, Game.Core?.logicalUnitRegistry).candidates.some(p =>
      JSON.stringify(p) === JSON.stringify(evaluation.militaryParticipant))) return false;
    if(evaluation.selection&&evaluation.selection.version>=2){
      const verified={...evaluation,royalHonorClaims:royalHonorCandidateClaims(dynasty,worldMonth,team.sovereigntyRank),royalMilitaryClaims:MilitaryCommandRegistry.getRoyalDepositionClaims(team,worldMonth,evaluation.candidates.map(c=>c.ruler),Game.Core?.logicalUnitRegistry)};
      const expected=chooseDepositionClaimant(verified,worldMonth,evaluation.selection.roll);
      if(!expected||expected.claimant.ruler.id!==successor.id||JSON.stringify(expected.evidence)!==JSON.stringify(evaluation.selection))return false;
    }
    const previousState = {
      predecessor: structuredClone(predecessor), successor: structuredClone(successor), currentRulerId: dynasty.currentRulerId,
      heirIds: [...dynasty.heirIds], designatedHeirId: dynasty.designatedHeirId,
      designatedSinceMonth: dynasty.designatedSinceMonth,
    };
    const militaryBefore = MilitaryCommandRegistry.snapshotTransaction();
    const successorUser = successor.militaryIdentity ? Team.GetUserById(successor.militaryIdentity.sourceUserId) : undefined;
    const successorRole = successorUser ? {role:successorUser.role,rulerId:successorUser.rulerId,playerRole:successorUser.player.role,playerRulerId:successorUser.player.rulerId} : undefined;
    const previousRulerUser = team.rulerUser;
    const previousUserRole = previousRulerUser?.role;
    const previousUserRulerId = previousRulerUser?.rulerId;
    const previousPlayerRole = previousRulerUser?.player.role;
    const previousPlayerRulerId = previousRulerUser?.player.rulerId;
    const historyBefore = WorldHistory.exportState();
    const unitRegistry = Game.Core?.logicalUnitRegistry;
    const unitsBefore = unitRegistry?.getEntries?.().map(e=>({...e,state:{...e.state}}));
    const unitSequenceBefore = unitRegistry?.exportState?.().nextUnitSequence;
    const candidateStatuses = dynasty.rulers.map((ruler) => [ruler.id, ruler.status] as const);
    const monthSnapshot = createRulerSnapshot(team, worldMonth);
    const nextChronicle = createRulerChronicle(monthSnapshot);
    const successorPerson=successor.militaryIdentity?MilitaryCommandRegistry.getPerson(successor.militaryIdentity.personId):undefined;
    const successorAppointment=successorPerson?.appointments.filter(a=>a.factionId===team.name&&a.startMonth<=worldMonth&&(a.endMonth??worldMonth)>=worldMonth).at(-1);
    const successorOffice=successorPerson&&successorAppointment?verifiedPoliticalOffice(successorPerson,successorAppointment.commandId,team.name,worldMonth,WorldHistory.getEventsForFaction(team.name)):undefined;
    const politicalCrisis=capturePoliticalCrisis({kind:'DEPOSITION',factionId:team.name,worldMonth,countryName:team.displayName,cityCount:team.cities.length,stability:getFactionStability(team)??100,...politicalCapital(captureAccessionCapital(team,worldMonth,successor.id,predecessor.id)),successorBornMonth:successor.bornYear,
      ...(successorPerson&&successorAppointment&&successorOffice?{successorOffice:{personId:successorPerson.personId,commandId:successorAppointment.commandId,office:successorOffice.office,eventId:successorOffice.eventId}}:{})},evaluation.evidence.map(e=>e.eventId),WorldHistory.getEventsForFaction(team.name));
    try {
      predecessor.status = "deposed";
      predecessor.endYear = worldMonth;
      predecessor.politicalEndYear = worldMonth;
      predecessor.endReason = "被废";
      predecessor.regimeNameAtEnd = team.displayName;
      predecessor.templeName = undefined;
      predecessor.templeNameReasons = undefined;
      predecessor.posthumousEpithet = undefined;
      predecessor.posthumousEpithetReasons = undefined;
      if (predecessor.chronicle) finishRulerChronicle(predecessor.chronicle, monthSnapshot);

      successor.status = "ruling";
      successor.accessionYear = worldMonth;
      successor.politicalStartYear = worldMonth;
      successor.politicalEndYear = undefined;
      successor.endYear = undefined;
      successor.endReason = undefined;
      successor.accessionCause = "DEPOSITION";
      successor.predecessorId = predecessor.id;
      successor.relationType = relation;
      successor.reignOrdinal = this.getNextReignOrdinal(dynasty);
      successor.plannedEndYear = successor.naturalDeathYear;
      successor.chronicle = nextChronicle;
      successor.templeName = undefined;
      successor.templeNameReasons = undefined;
      successor.posthumousEpithet = undefined;
      successor.posthumousEpithetReasons = undefined;

      dynasty.currentRulerId = successor.id;
      dynasty.heirIds = dynasty.heirIds.filter((id) => id !== successor.id);
      if (dynasty.designatedHeirId === successor.id) {
        dynasty.designatedHeirId = undefined;
        dynasty.designatedSinceMonth = undefined;
      }
      dynasty.rulers.forEach((ruler) => {
        if (ruler.id !== successor.id && (ruler.status === "heir" || ruler.status === "kin")) ruler.status = "kin";
      });
      // Candidate refresh is deterministic and does not create kin as a side effect of the coup.
      dynasty.heirIds = selectActiveDynasticCandidateIds({ currentRuler: successor, rulers: dynasty.rulers,
        month: worldMonth, cap: getDynasticCandidateCap(team.identityStage, team.sovereigntyRank),
        isAlive: (candidate, month) => candidate.status !== "dead" && candidate.status !== "deposed" && !isNaturallyDeadByMonth(candidate.naturalDeathYear, month),
        pickIndex: () => 0, preferredIds: [] });
      const selected = new Set(dynasty.heirIds);
      dynasty.rulers.forEach((ruler) => { if (ruler.id !== successor.id && (ruler.status === "heir" || ruler.status === "kin")) ruler.status = selected.has(ruler.id) ? "heir" : "kin"; });
      // The annual qualification already consumed its sole political roll. Do not
      // let a tied heir designation introduce a second, unrelated RNG draw.
      this.refreshDesignatedHeir(dynasty, successor, worldMonth, () => 0);

    const eventId = WorldHistory.addRulerDeposed(worldMonth, team.name, team.displayName, predecessor, successor, relation,
      evaluation.evidence.map(({ eventId: id }) => id), { politicalCrisis:JSON.stringify(politicalCrisis), depositionSelection: JSON.stringify(evaluation.selection), ...captureAccessionCapital(team, worldMonth, successor.id, predecessor.id),
        ...(evaluation.militaryParticipant ? militaryParticipationMetadata("DEPOSITION", team.name, worldMonth, evaluation.militaryParticipant,
          evaluation.evidence.map(e => e.eventId), evaluation.baselineProbability ?? evaluation.probability, evaluation.probability, evaluation.militaryRoll,
          { stability: getFactionStability(team) ?? 100, cityCount: team.cities.length }, WorldHistory.getEventsForFaction(team.name)) : {}) });
    if (predecessor.chronicle) predecessor.chronicle.notableEventIds.push(eventId);
    successor.chronicle!.notableEventIds.push(eventId);

      // The old monarch remains a living person: remove only the political role/crown,
      // and keep the existing population unit instead of silently destroying it.
      if (team.rulerUser?.rulerId === predecessor.id) {
        team.rulerUser.role = "NORMAL";
        team.rulerUser.rulerId = undefined;
        team.rulerUser.player.setRole("NORMAL", undefined);
        team.rulerUser = undefined;
      }
      this.ensureRulerUnit(team);
      const successorShouldHaveUnit = Math.floor(monthsToYears(Math.max(0, worldMonth - successor.bornYear))) >= RULER_COMBAT_MIN_AGE;
      if (dynasty.currentRulerId !== successor.id || successor.status !== "ruling" || predecessor.status !== "deposed" ||
        (successorShouldHaveUnit && (!team.rulerUser || team.rulerUser.rulerId !== successor.id || !team.users.has(team.rulerUser))) ||
        (!successorShouldHaveUnit && team.rulerUser)) throw new Error("deposition runtime invariant failed");

    } catch {
      for(const key of Object.keys(predecessor))delete (predecessor as any)[key];
      for(const key of Object.keys(successor))delete (successor as any)[key];
      Object.assign(predecessor, previousState.predecessor);
      Object.assign(successor, previousState.successor);
      MilitaryCommandRegistry.rollbackTransaction(militaryBefore);
      if(successorUser&&successorRole){successorUser.role=successorRole.role;successorUser.rulerId=successorRole.rulerId;successorUser.player.setRole(successorRole.playerRole,successorRole.playerRulerId,true);}
      WorldHistory.importState(historyBefore);
      dynasty.currentRulerId = previousState.currentRulerId;
      dynasty.heirIds = previousState.heirIds;
      dynasty.designatedHeirId = previousState.designatedHeirId;
      dynasty.designatedSinceMonth = previousState.designatedSinceMonth;
      candidateStatuses.forEach(([id, status]) => { const record = dynasty.rulers.find((ruler) => ruler.id === id); if (record) record.status = status; });
      if (team.rulerUser && team.rulerUser !== previousRulerUser) { if(team.rulerUser===successorUser)team.rulerUser=undefined;else team.removeRulerUnit(true); }
      if (previousRulerUser) {
        previousRulerUser.role = previousUserRole!;
        previousRulerUser.rulerId = previousUserRulerId;
        previousRulerUser.player.setRole(previousPlayerRole!, previousPlayerRulerId, true);
        team.rulerUser = previousRulerUser;
      }
      if(unitsBefore&&unitSequenceBefore!==undefined)unitRegistry!.importState(unitSequenceBefore,unitsBefore as Array<{state: import("../Simulation/LogicalUnitState").LogicalUnitState;player: import("../Components/Player").default}>);
      this.ensureRulerUnit(team);
      return false;
    }
    return true;
  }

  private archiveNaturallyDeadDeposedRulers(team: Team, dynasty: Dynasty, worldMonth: number) {
    dynasty.rulers.forEach((ruler) => {
      if ((ruler.status !== "deposed" && !((ruler.residentIdentity || ruler.militaryIdentity||ruler.militaryUsurperIdentity) && ["politically-ended","abdicated","kin"].includes(ruler.status))) || ruler.reignOrdinal === undefined || hasRecordedRulerDeath(ruler) ||
        !isNaturallyDeadByMonth(ruler.naturalDeathYear ?? ruler.plannedEndYear, worldMonth)) return;
      ruler.status = "dead";
      ruler.deathMonth = worldMonth;
      ruler.deathReason = "自然去世";
      if (ruler.militaryIdentity||ruler.militaryUsurperIdentity) {
        const identity=ruler.militaryUsurperIdentity??ruler.militaryIdentity!;
        MilitaryCommandRegistry.mirrorPoliticalDeath(identity.personId,ruler.id,worldMonth,"NATURAL_DEATH");
        const u = Team.GetUserById(identity.sourceUserId);
        if (u?.historicalPersonId === (ruler.militaryUsurperIdentity??ruler.militaryIdentity)!.personId) u.destroyUser(true,{cause:"RULER_LIFECYCLE",month:worldMonth});
      }
      if(ruler.residentIdentity?.military)MilitaryCommandRegistry.mirrorPoliticalDeath(ruler.residentIdentity.military.personId,ruler.id,worldMonth,"NATURAL_DEATH");
      if(ruler.residentIdentity){const u=Team.GetUserById(ruler.residentIdentity.sourceUserId);if(u?.historicalPersonId===ruler.residentIdentity.personId)u.destroyUser(true,{cause:"RULER_LIFECYCLE",month:worldMonth,context:"人物自然死亡，移除其唯一地图实体"});}
      if (ruler.chronicle) {
        ruler.chronicle.deathCause = ruler.deathReason;
        finalizeRulerPosthumousNames(ruler, dynasty.rulers, team, worldMonth);
      }
      const ended=ruler.endYear!==undefined&&ruler.endYear<=worldMonth;
      const formerTitle=ended?`故${ruler.regimeNameAtEnd??getFactionDisplayNameAtMonth(team,ruler.endYear!)}${getRulerTitleAtMonth(team,ruler.endYear!)}${this.getRulerPersonalName(ruler)}`:undefined;
      WorldHistory.addRulerDied(worldMonth, team.name, formerTitle??this.getRulerTitle(team, ruler, worldMonth), {
        formerRuler:ended?1:undefined,officeEndMonth:ended?ruler.endYear:undefined,rulerNameAtDeath:formerTitle,
        rulerId: ruler.id, deathReason: ruler.deathReason, age: Math.floor(monthsToYears(worldMonth - ruler.bornYear)),
      });
    });
  }

  recordCityCaptured(rulerId: string | undefined, _cityId: string, eventId?: string) {
    if (!rulerId) {
      return;
    }
    const ruler = this.findRulerById(rulerId);
    if (!ruler?.chronicle) {
      return;
    }
    recordPersonalCityCapture(ruler.chronicle, eventId);
  }

  recordCityLost(factionId: string, eventId?: string) {
    const ruler = this.getCurrentRuler(factionId);
    if (!ruler?.chronicle) {
      return;
    }
    ruler.chronicle.citiesLostDuringReign += 1;
    if (eventId) {
      ruler.chronicle.notableEventIds.push(eventId);
    }
  }

  recordRebellion(factionId: string, eventId?: string) {
    const ruler = this.getCurrentRuler(factionId);
    if (!ruler?.chronicle) {
      return;
    }
    ruler.chronicle.rebellionsDuringReign += 1;
    if (eventId) {
      ruler.chronicle.notableEventIds.push(eventId);
    }
  }

  recordRestoration(factionId: string, eventId?: string) {
    const ruler = this.getCurrentRuler(factionId);
    if (!ruler?.chronicle) {
      return;
    }
    ruler.chronicle.restorationsDuringReign += 1;
    if (eventId) {
      ruler.chronicle.notableEventIds.push(eventId);
    }
  }

  recordUnification(factionId: string, eventId?: string) {
    const ruler = this.getCurrentRuler(factionId);
    if (!ruler?.chronicle) {
      return;
    }
    ruler.chronicle.completedUnification = true;
    if (eventId) {
      ruler.chronicle.notableEventIds.push(eventId);
    }
  }

  recordStateFounded(factionId: string, stateName: string, year: number, eventId?: string) {
    const ruler = this.getCurrentRuler(factionId);
    if (!ruler?.chronicle) {
      return;
    }
    ruler.chronicle.foundedStateName = stateName;
    ruler.chronicle.foundedStateMonth = year;
    if (eventId) {
      ruler.chronicle.notableEventIds.push(eventId);
    }
  }

  recordEmperorProclaimed(factionId: string, year: number, eventId?: string) {
    const ruler = this.getCurrentRuler(factionId);
    if (!ruler?.chronicle) {
      return;
    }
    ruler.chronicle.proclaimedEmperorMonth = year;
    if (eventId) {
      ruler.chronicle.notableEventIds.push(eventId);
    }
  }

  private createFormalRuler(
    team: Team,
    houseName: string,
    accessionYear: number,
    parentId?: string,
    predecessorId?: string,
    residentBornMonth?: number,
    establishedMilitary?:{givenName:string;naturalDeathMonth:number}
  ): Ruler {
    this.sequence += 1;
    const accessionAge = residentBornMonth === undefined ? worldRandom.int(
      RULER_MIN_AGE_AT_ACCESSION,
      RULER_MAX_AGE_AT_ACCESSION
    ) : 0;
    const bornYear = residentBornMonth ?? accessionYear - yearsToMonths(accessionAge);
    if(establishedMilitary&&establishedMilitary.naturalDeathMonth<=accessionYear)throw new Error("Military founder has no surviving life schedule");
    const naturalDeathYear = establishedMilitary?.naturalDeathMonth ?? (residentBornMonth === undefined
      ? createNaturalDeathMonth(bornYear,max=>worldRandom.pickIndex(max))
      : createSurvivingResidentDeathMonth(bornYear,accessionYear,max=>worldRandom.pickIndex(max)));
    const recentNames =
      this.dynasties
        .get(team.name)
        ?.rulers.filter((ruler) => ruler.houseName === houseName &&
          (ruler.reignOrdinal !== undefined || !hasRecordedRulerDeath(ruler)))
        .map((ruler) => ruler.givenName) ?? [];
    return {
      id: `${team.name}-ruler-${this.sequence}`,
      houseName,
      givenName: establishedMilitary?.givenName ?? pickRulerGivenName(getRulerGivenNamePool(houseName), recentNames, (max) =>
        worldRandom.pickIndex(max)
      ),
      bornYear,
      naturalDeathYear,
      accessionYear,
      politicalStartYear: accessionYear,
      plannedEndYear: naturalDeathYear,
      parentId,
      predecessorId,
      status: team.status === "EXILED" ? "exiled" : "ruling",
      chronicle: createRulerChronicle(createRulerSnapshot(team, accessionYear)),
    };
  }

  private initializeRoyalHousehold(team: Team, dynasty: Dynasty, founder: Ruler, month: number) {
    const plan = planInitialRoyalHousehold(founder.bornYear, month, max => worldRandom.pickIndex(max));
    const createKin = (bornYear: number, parentId?: string, relationType?: RulerRelationType): Ruler => {
      this.sequence += 1;
      const naturalDeathYear = createNaturalDeathMonth(bornYear, max => worldRandom.pickIndex(max));
      return { id: `${team.name}-ruler-${this.sequence}`, houseName: dynasty.houseName,
        givenName: pickRulerGivenName(getRulerGivenNamePool(dynasty.houseName), dynasty.rulers.map(r => r.givenName), max => worldRandom.pickIndex(max)),
        bornYear, naturalDeathYear, plannedEndYear: naturalDeathYear, politicalStartYear: month,
        parentId, relationType, status: "kin" };
    };
    const parentPlan = plan.find(p => p.kind === "PARENT");
    // A scheduled lifespan already elapsed is not a historical death. Discard the pair rather than inventing one.
    const parent = parentPlan ? createKin(parentPlan.bornMonth) : undefined;
    if (parent && !isNaturallyDeadByMonth(parent.naturalDeathYear, month)) {
      dynasty.rulers.push(parent);
      founder.parentId = parent.id;
      const siblingPlan = plan.find(p => p.kind === "SIBLING")!;
      const sibling = createKin(siblingPlan.bornMonth, parent.id, "SIBLING");
      if (!isNaturallyDeadByMonth(sibling.naturalDeathYear, month)) dynasty.rulers.push(sibling);
    }
    const childPlan = plan.find(p => p.kind === "CHILD");
    if (childPlan) dynasty.rulers.push(createKin(childPlan.bornMonth, founder.id, "DIRECT_CHILD"));
    dynasty.heirIds = selectActiveDynasticCandidateIds({ currentRuler: founder, rulers: dynasty.rulers,
      month, cap: Math.min(2, getDynasticCandidateCap(team.identityStage, team.sovereigntyRank)),
      isAlive: (r, at) => r.status !== "dead" && !isNaturallyDeadByMonth(r.naturalDeathYear ?? r.plannedEndYear, at),
      pickIndex: max => worldRandom.pickIndex(max) });
    for (const r of dynasty.rulers) if (dynasty.heirIds.includes(r.id)) r.status = "heir";
    this.refreshDesignatedHeir(dynasty, founder, month);
  }

  private createHeir(
    team: Team,
    houseName: string,
    politicalStartYear: number,
    parentId?: string,
    predecessorId?: string,
    relationType: RulerRelationType = "DIRECT_CHILD"
  ): Ruler {
    const parent = parentId
      ? this.dynasties
          .get(team.name)
          ?.rulers.find((ruler) => ruler.id === parentId)
      : undefined;
    const derivedBornYear = parent
      ? deriveHeirBirthMonth(
          parent.bornYear,
          politicalStartYear,
          (max) => worldRandom.pickIndex(max),
          yearsToMonths(HEIR_PARENT_MIN_AGE_AT_BIRTH),
          yearsToMonths(HEIR_PARENT_MAX_AGE_AT_BIRTH)
        )
      : undefined;
    if (parentId && (!parent || derivedBornYear === undefined)) {
      throw new Error(`Cannot create age-valid child: ${team.name}/${parentId}`);
    }
    const bornYear = derivedBornYear ?? politicalStartYear - yearsToMonths(
          worldRandom.int(RULER_MIN_AGE_AT_ACCESSION, RULER_MAX_AGE_AT_ACCESSION)
        );
    this.sequence += 1;
    const naturalDeathYear = createNaturalDeathMonth(bornYear, (max) =>
      worldRandom.pickIndex(max)
    );
    const recentNames =
      this.dynasties
        .get(team.name)
        ?.rulers.filter((ruler) => ruler.houseName === houseName &&
          (ruler.reignOrdinal !== undefined || !hasRecordedRulerDeath(ruler)))
        .map((ruler) => ruler.givenName) ?? [];
    return {
      id: `${team.name}-ruler-${this.sequence}`,
      houseName,
      givenName: pickRulerGivenName(getRulerGivenNamePool(houseName), recentNames, (max) =>
        worldRandom.pickIndex(max)
      ),
      bornYear,
      naturalDeathYear,
      plannedEndYear: naturalDeathYear,
      politicalStartYear,
      parentId,
      predecessorId,
      relationType,
      status: "heir",
    };
  }

  private getNextReignOrdinal(dynasty: Dynasty) {
    return getNextRulerReignOrdinal(dynasty.rulers);
  }

  private ensureActiveHeir(team: Team, dynasty: Dynasty, year: number, allowInitialBootstrap = false) {
    const current = this.getCurrentRuler(team.name);
    const candidateCap = getDynasticCandidateCap(team.identityStage, team.sovereigntyRank);
    const isAlive = (candidate: Ruler, atMonth: number) =>
      candidate.status !== "dead" && candidate.status !== "deposed" &&
      !isNaturallyDeadByMonth(candidate.naturalDeathYear ?? candidate.plannedEndYear, atMonth);
    const existingCandidates = selectActiveDynasticCandidateIds({
      currentRuler: current,
      rulers: dynasty.rulers,
      month: year,
      cap: candidateCap,
      isAlive,
      pickIndex: (length) => length === 1 ? 0 : worldRandom.pickIndex(length),
      preferredIds: dynasty.heirIds,
    });
    const selectedIds = new Set(existingCandidates);
    dynasty.rulers.forEach((ruler) => {
      if (ruler.id === current?.id || ruler.status === "dead" || ruler.status === "exiled" || ruler.status === "politically-ended" || ruler.status === "abdicated" || ruler.status === "deposed") return;
      ruler.status = selectedIds.has(ruler.id) ? "heir" : "kin";
    });
    dynasty.heirIds = existingCandidates;
    if (shouldCreateActiveHeir(team.status)) {
      const parents = getCandidateParentsToReplenish({
        currentRuler: current,
        rulers: dynasty.rulers,
        candidateIds: dynasty.heirIds,
        month: year,
        minimumParentAgeMonths: yearsToMonths(HEIR_PARENT_MIN_AGE_AT_BIRTH),
        candidateCap,
      });
      const inSuccessionCrisis = team.cities.length <= 1 || (getFactionStability(team) ?? 100) <= 45;
      // A founding ruler gets one age-valid baseline dynastic link even in a
      // one-city/crisis start. Later crisis months may not expand the pool.
      const bootstrapOnly = inSuccessionCrisis && allowInitialBootstrap && dynasty.heirIds.length === 0;
      for (const parent of parents) {
        if ((inSuccessionCrisis && (!bootstrapOnly || parent.id !== current?.id)) || dynasty.heirIds.length >= (bootstrapOnly ? 1 : candidateCap)) break;
        const heir = this.createHeir(team, dynasty.houseName, year, parent.id);
        dynasty.rulers.push(heir);
        dynasty.heirIds.push(heir.id);
      }
    }
    this.refreshDesignatedHeir(dynasty, current, year);
  }

  private refreshDesignatedHeir(dynasty: Dynasty, current: Ruler | undefined, month: number, pickIndex?: (length: number) => number) {
    const selection = current
      ? selectRecordedDynasticSuccessor({
          predecessor: current,
          candidates: dynasty.heirIds
            .map((id) => dynasty.rulers.find((ruler) => ruler.id === id))
            .filter((ruler): ruler is Ruler => Boolean(ruler)),
          rulers: dynasty.rulers,
          houseName: dynasty.houseName,
          month,
          isAlive: (candidate, atMonth) =>
            candidate.status !== "dead" && candidate.status !== "deposed" &&
            !isNaturallyDeadByMonth(candidate.naturalDeathYear ?? candidate.plannedEndYear, atMonth),
          preferredCandidateId: dynasty.designatedHeirId,
          pickIndex: pickIndex ?? ((length) => length === 1 ? 0 : worldRandom.pickIndex(length)),
        })
      : undefined;
    if (!selection) {
      dynasty.designatedHeirId = undefined;
      dynasty.designatedSinceMonth = undefined;
      return;
    }
    if (selection.ruler.id !== dynasty.designatedHeirId || dynasty.designatedSinceMonth === undefined) {
      dynasty.designatedHeirId = selection.ruler.id;
      dynasty.designatedSinceMonth = month;
    }
  }

  private archiveHeirs(dynasty: Dynasty) {
    dynasty.rulers.forEach((heir) => {
      if (heir.reignOrdinal !== undefined || heir.status !== "heir") {
        return;
      }
      // Extinction ends succession eligibility, not the person's life.
      heir.status = "kin";
    });
    dynasty.heirIds = [];
    dynasty.designatedHeirId = undefined;
    dynasty.designatedSinceMonth = undefined;
  }

  private archiveNaturallyDeadHeirs(dynasty: Dynasty, year: number, militaryOnly = false) {
    dynasty.rulers.forEach((heir) => {
      if (militaryOnly && !heir.militaryIdentity) return;
      if (
        heir.status === "dead" ||
        heir.status !== "heir" && heir.status !== "kin" ||
        heir.reignOrdinal !== undefined ||
        !isNaturallyDeadByMonth(heir.naturalDeathYear ?? heir.plannedEndYear, year)
      ) {
        return;
      }
      if (heir.militaryIdentity) {
        const u = Team.GetUserById(heir.militaryIdentity.sourceUserId);
        if (u?.historicalPersonId === heir.militaryIdentity.personId) u.destroyUser(false,{cause:"NATURAL_DEATH",month:year,context:"宗室既定寿命届满",damageSource:"MILITARY_LIFESPAN"});
        else {
          MilitaryCommandRegistry.endPersonCommands(heir.militaryIdentity.personId, year, "DEATH");
          const p=MilitaryCommandRegistry.getPerson(heir.militaryIdentity.personId);
          if(p){MilitaryCommandRegistry.mirrorPoliticalDeath(p.personId,heir.id,year,"NATURAL_DEATH");}
        }
      }
      const wasActiveCandidate = heir.status === "heir";
      heir.status = "dead";
      heir.politicalEndYear = year;
      heir.endYear = year;
      heir.endReason = "自然去世";
      heir.deathMonth = year;
      heir.deathReason = "自然去世";
      const parent = heir.parentId
        ? dynasty.rulers.find((ruler) => ruler.id === heir.parentId)
        : undefined;
      const heirDeathMonth = heir.naturalDeathYear ?? heir.plannedEndYear;
      if (
        wasActiveCandidate &&
        parent?.chronicle &&
        heirDeathMonth !== undefined &&
        predeceasedParentByMonth(heirDeathMonth, parent.endYear)
      ) {
        const team = Game.Core?.teams.find((item) => item.name === dynasty.factionId);
        const parentTitle = team ? formatRulerTitleAtMonth(team, "", year) : "父君";
        const eventId = WorldHistory.addHeirDied(
          year,
          dynasty.factionId,
          heir.id,
          parent.id,
          this.getRulerPersonalName(heir),
          Math.floor(monthsToYears(year - heir.bornYear)),
          "natural",
          parentTitle
        );
        parent.chronicle.notableEventIds.push(eventId);
      }
    });
    dynasty.heirIds = dynasty.heirIds.filter((heirId) => dynasty.rulers.some((ruler) => ruler.id === heirId && ruler.status === "heir"));
  }

  private revolutionContext(team: Team, dynasty: Dynasty, predecessor: Ruler, successor: Ruler | undefined,
    year: number, reason: "natural" | "combat" | "captured"): RevolutionContext {
    const sourceEvents=predecessor.status==='dead'&&predecessor.deathMonth===year?WorldHistory.getEventsForFaction(team.name):[];
    return { sourceEvents,worldMonth: year, identityStage: team.identityStage, status: team.status,
      stability: getFactionStability(team) ?? 100, cityCount: team.cities.length,
      predecessor, successor, successionReason: reason, factionId: team.name,
      // Candidate previews do not scan historical evidence or create political opportunities.
      politicalShocks: predecessor.status === "dead" && predecessor.deathMonth === year
        ? derivePoliticalSuccessionShocks(team.name, predecessor, year, sourceEvents) : [],
      military: predecessor.status === "dead" && predecessor.deathMonth === year ? MilitaryCommandRegistry.getPoliticalInfluence(team, year, Game.Core?.logicalUnitRegistry) : undefined,
      previousSuccessionMonths: dynasty.rulers.filter((ruler) => ruler.predecessorId && ruler.accessionYear !== undefined)
        .map((ruler) => ruler.accessionYear!) };
  }

  getRevolutionDiagnostics(teams: Team[], worldMonth: number) {
    const epochs = this.listForDiagnostics().flatMap((dynasty) => (dynasty.houseEpochs ?? []).map((epoch) => ({ ...epoch, factionId: dynasty.factionId, foundingRelation: dynasty.rulers.find(ruler => ruler.id === epoch.foundingRulerId)?.relationType })));
    return { naturalHouseSuccessionCount: epochs.filter((epoch) => epoch.startReason === "NATURAL_HOUSE_SUCCESSION" && epoch.foundingRelation === "NEW_HOUSE").length,
      usurpationCount: epochs.filter((epoch) => epoch.startReason === "USURPATION").length,
      activeHouseEpochCount: epochs.filter((epoch) => epoch.endMonth === undefined && teams.some((team) => team.name === epoch.factionId && team.status === "ACTIVE")).length,
      lastRevolution: epochs.filter((epoch) => epoch.startReason === "USURPATION").sort((a, b) => b.startMonth - a.startMonth)[0],
      lastBoundaryChecks: this.revolutionChecks,
      cumulativeGate: this.revolutionGateDiagnostics.snapshot(worldMonth),
      candidateBlockers: teams.filter((team) => team.status === "ACTIVE").slice(0, 5).map((team) => {
        const dynasty = this.get(team.name);
        const predecessor = this.getCurrentRuler(team.name);
        if (!dynasty || !predecessor) return { factionId: team.name, blockers: ["NO_ELIGIBLE_LEGITIMATE_SUCCESSOR"] };
        const selected = selectRecordedDynasticSuccessor({ predecessor, candidates: dynasty.rulers.filter((ruler) => dynasty.heirIds.includes(ruler.id)),
          rulers: dynasty.rulers, houseName: dynasty.houseName, month: worldMonth,
          isAlive: (ruler, month) => ruler.status !== "dead" && ruler.status !== "deposed" && !isNaturallyDeadByMonth(ruler.naturalDeathYear, month),
          preferredCandidateId: dynasty.designatedHeirId, pickIndex: () => 0 });
        return { factionId: team.name, ...getRevolutionEligibility(this.revolutionContext(team, dynasty, predecessor, selected?.ruler, worldMonth, "natural")) };
      }) };
  }

  private consumeHeir(dynasty: Dynasty, predecessor: Ruler, year: number) {
    const candidates = dynasty.heirIds
      .map((id) => dynasty.rulers.find((ruler) => ruler.id === id))
      .filter((ruler): ruler is Ruler => Boolean(ruler));
    const selected = selectRecordedDynasticSuccessor({
      predecessor,
      candidates,
      rulers: dynasty.rulers,
      houseName: dynasty.houseName,
      month: year,
      isAlive: (candidate, month) =>
        candidate.status !== "dead" && candidate.status !== "deposed" &&
        !isNaturallyDeadByMonth(candidate.naturalDeathYear ?? candidate.plannedEndYear, month),
      preferredCandidateId: dynasty.designatedHeirId,
      pickIndex: (length) => length === 1 ? 0 : worldRandom.pickIndex(length),
    });
    const selectedId = selected?.ruler.id;
    if (selected) selected.ruler.relationType = selected.relationType;
    dynasty.heirIds = dynasty.heirIds.filter((id) => id !== selectedId);
    dynasty.designatedHeirId = undefined;
    dynasty.designatedSinceMonth = undefined;
    return selected?.ruler;
  }

  getRulerTitleDisplay(factionId: string, monthIndex: number) {
    const ruler = this.getCurrentRuler(factionId);
    const team = Game.Core?.teams.find((item) => item.name === factionId);
    if (!ruler || !team) {
      return this.getRulerDisplay(factionId);
    }
    return this.getRulerTitle(team, ruler, monthIndex);
  }

  getRulerHistoricalTitle(rulerId: string, factionId: string, monthIndex: number) {
    const ruler = this.findRulerById(rulerId);
    const team = Game.Core?.teams.find((item) => item.name === factionId);
    return ruler && team ? this.getRulerTitle(team, ruler, monthIndex) : undefined;
  }

  private getRulerTitle(team: Team, ruler: Ruler, monthIndex: number) {
    return formatRulerTitleAtMonth(
      team,
      this.getRulerPersonalName(ruler),
      monthIndex
    );
  }

  private getRulerPersonalName(ruler: Ruler) {
    return `${ruler.houseName.replace(/氏$/, "")}${ruler.givenName}`;
  }

  private observeRuler(team: Team, ruler: Ruler, year: number) {
    if (ruler.chronicle) {
      observeRulerPeak(ruler.chronicle, createRulerSnapshot(team, year));
    }
  }

  private findRulerById(rulerId: string) {
    for (const dynasty of this.dynasties.values()) {
      const ruler = dynasty.rulers.find((item) => item.id === rulerId);
      if (ruler) {
        return ruler;
      }
    }
    return undefined;
  }

  getAll() {
    return [...this.dynasties.values()];
  }
}

function getRulerUserId(rulerId: string) {
  let hash = 0;
  for (let i = 0; i < rulerId.length; i++) {
    hash = (hash * 31 + rulerId.charCodeAt(i)) >>> 0;
  }
  return 1800000000 + (hash % 100000000);
}

const DynastyRegistry = new DynastyRegistryStore();
MilitaryCommandRegistry.setRoyalService({
  nobleEpoch:(factionId)=>{const d=DynastyRegistry.get(factionId);return nobleEpochForRuler(d,d?.currentRulerId??null)?.foundingRulerId;},
  candidates:(team,month)=>DynastyRegistry.getRoyalMilitaryCandidates(team,month),
  enlist:(candidate,team,month,members)=>DynastyRegistry.enlistRoyalMilitary(candidate,team,month,members),
  eligible:(user,month)=>DynastyRegistry.isRoyalMilitaryEligible(user,month),
});

export default DynastyRegistry;

function createRulerSnapshot(team: Team, month: number): RulerReignSnapshot {
  const totalCells = Math.max(Game.Core?.totalCells ?? 1, 1);
  return {
    month,
    population: team.users.size,
    territoryShare: team.blocks.children.size / totalCells,
    cityCount: team.cities.length,
    stability: getFactionStability(team) ?? 0,
  };
}
