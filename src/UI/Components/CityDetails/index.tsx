import CityChroniclePanel from './CityChroniclePanel';
import MilitaryArchiveWindow from '../FactionDetails/MilitaryArchiveWindow';
import {CityAppanageSection} from './CityAppanages';
import {Box,Button,Typography} from '@mui/material';
import {useEffect,useState,useMemo} from 'react';
import {useDispatch,useSelector} from 'react-redux';
import type City from '../../../Components/City';
import Game from '../../../Game/Game';
import WorldHistory from '../../../History/WorldHistory';
import {importantCityHistory} from '../../../History/CityHistoryPresentation';
import ArchivedCities,{type ArchivedCity} from '../../../Simulation/ArchivedCities';
import {selectCityFromList} from '../../../Simulation/CitySelection';
import {CityListFilter,getVisibleCities} from '../../../Simulation/CityListRules';
import {formatWorldDate} from '../../../Simulation/WorldTime';
import DynastyRegistry from '../../../Politics/Dynasty';
import {formatCityHistoryEvent,getCityHistoricalFactionName} from '../../../History/CityHistoryFormatter';
import {RootState} from '../../../store';
import {setSelectedCityId} from '../../../store/rootSlice';

export default function CityDetails(){
 const [filter,setFilter]=useState<CityListFilter>('all'),selectedCityId=useSelector((s:RootState)=>s.root.selectedCityId),teams=useSelector((s:RootState)=>s.root.teams),month=useSelector((s:RootState)=>s.root.worldMonth);
 const cities=teams.flatMap(t=>t.cities),city=cities.find(c=>c.id===selectedCityId),archived=selectedCityId?ArchivedCities.get(selectedCityId):undefined;
 return city||archived?<CityProfile key={selectedCityId} city={city} archived={archived} teams={teams} month={month}/>:<CityList cities={cities} filter={filter} onFilterChange={setFilter}/>;
}
function CityProfile({city,archived,teams,month}:{city?:City;archived?:ArchivedCity;teams:RootState['root']['teams'];month:number}){
 const dispatch=useDispatch(),[tab,setTab]=useState<'overview'|'defense'>('overview'),[complete,setComplete]=useState(false),[warOpen,setWarOpen]=useState(false),[revision,setRevision]=useState(WorldHistory.getRevision());
 useEffect(()=>WorldHistory.subscribeRevision(setRevision),[]);
 const id=city?.id??archived!.id,name=city?.name??archived!.name,foundedMonth=city?.foundedYear??archived!.foundedMonth,founderId=city?.founderFactionId??archived!.founderFactionId;
 const byFaction=new Map(teams.map(t=>[t.name,t])),history=(city?.history??archived!.history).filter(e=>e.year<=month),attacker=teams.find(t=>t.name===city?.attackingFactionId);
 const warRecords=useMemo(()=>warOpen?(complete?history:importantCityHistory(history,WorldHistory.getEventsForCity(id),id)):[],[warOpen,complete,id,revision,month]);
 const facts:Array<[string,string|number]>=[['归属',city?(city.ownerTeam?.displayName??city.ownerFactionId):getCityHistoricalFactionName(byFaction,archived!.lastOwnerFactionId,archived!.destroyedMonth)],['建立',formatWorldDate(foundedMonth)],['易手',`${city?.captureCount??archived!.captureCount}次`]];
 if(city)facts.push(['城防',`${city.defense} / ${city.maxDefense}`],['忠诚',city.loyalty],['破坏度',`${city.devastation} / 100`],['状态',city.loyaltyStatus]);
 else facts.push(['毁灭',formatWorldDate(archived!.destroyedMonth)]);
 return <Box data-city-profile={id} data-archive-scroll sx={{height:'100%',overflowY:'auto',boxSizing:'border-box',p:1,minWidth:0,overflowWrap:'anywhere'}}>
  <Button size='small' onClick={()=>dispatch(setSelectedCityId(undefined))}>← 城市列表</Button>
  <Typography variant='h6' fontWeight='bold' fontSize='1rem'>{city?.isCapital?'★ ':''}{city?'':'城市档案：'}{name}{!city&&<Typography component='span' fontSize='.72rem' color='var(--gg-text-muted)'> · 已毁灭</Typography>}</Typography>
  <Box role='tablist' aria-label='城市资料' sx={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:.5,my:1}}>
   {([['overview','概况'],['defense','城史']] as const).map(([value,label])=><Button key={value} role='tab' aria-selected={tab===value} size='small' variant={tab===value?'contained':'outlined'} sx={{minWidth:0,px:.5}} onClick={()=>setTab(value)}>{label}</Button>)}
  </Box>
  {tab==='overview'&&<Box role='tabpanel' aria-label='概况' sx={{display:'grid',gap:.65}}>
   {facts.map(([label,value])=><Box key={label} sx={{display:'grid',gridTemplateColumns:'4em minmax(0,1fr)',gap:.7,fontSize:'.84rem'}}><Box color='var(--gg-text-muted)'>{label}</Box><Box>{value}</Box></Box>)}
   <Typography fontSize='.78rem' color='var(--gg-text-muted)'>初属：{getCityHistoricalFactionName(byFaction,founderId,foundedMonth)}</Typography>
   {city&&<Typography fontSize='.78rem' color='var(--gg-text-muted)'>{city.isCapital?'首都':'普通城市'} · 防御区{city.fortifiedCells.length}格</Typography>}
   {city?.siegeBattle&&<Typography fontSize='.82rem' fontWeight='bold'>{attacker?.displayName??city.siegeBattle.attackerId}正在围攻 · 攻方{city.siegeBattle.attackers}人／守方{city.siegeBattle.defenders}人</Typography>}
   <CityAppanageSection key={id} cityId={id}/>
  </Box>}
  {tab==='defense'&&<Box role='tabpanel' aria-label='城史'>
   <CityChroniclePanel cityId={id} month={month} factions={byFaction} revision={revision}/>
   <details onToggle={e=>setWarOpen(e.currentTarget.open)}><summary>攻守详录</summary><Button size='small' onClick={()=>setComplete(v=>!v)}>{complete?'精选战事':'完整战事'}</Button>
    {warOpen&&<MilitaryArchiveWindow ids={warRecords.map((_,i)=>String(i))} estimateHeight={70} maxRows={24}>{key=>{const e=warRecords[Number(key)];return <Typography fontSize='.79rem' sx={{py:.5}}>{formatWorldDate(e.year)} · {formatCityHistoryEvent(e,{name,founderFactionId:founderId,foundedMonth},byFaction,e.rulerId&&e.newOwnerFactionId?DynastyRegistry.getRulerHistoricalTitle(e.rulerId,e.newOwnerFactionId,e.year):undefined)}</Typography>;}}</MilitaryArchiveWindow>}
   </details>
  </Box>}

 </Box>;
}

function CityList({
  cities,
  filter,
  onFilterChange,
}: {
  cities: City[];
  filter: CityListFilter;
  onFilterChange: (filter: CityListFilter) => void;
}) {
  const visibleCities = getVisibleCities(cities, filter);
  return (
    <Box sx={{ p: 1, borderTop: "1px solid #00000022" }}>
      <Typography fontWeight="bold">天下城市</Typography>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 0.4, my: 0.75 }}>
        {[
          ["all", "全部"],
          ["capital", "首都"],
          ["siege", "围攻"],
          ["abnormal", "异常"],
        ].map(([value, label]) => (
          <Button
            key={value}
            size="small"
            variant={filter === value ? "contained" : "outlined"}
            onClick={() => onFilterChange(value as CityListFilter)}
            sx={{ minWidth: 0, px: 0.5, fontSize: "0.72rem" }}
          >
            {label}
          </Button>
        ))}
      </Box>
      <Box sx={{ display: "grid", gap: 0.4, maxHeight: "24rem", overflowY: "auto" }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "1.5fr 0.8fr 0.7fr 0.8fr 0.7fr 0.7fr",
            gap: 0.5,
            fontSize: "0.74rem",
            color: "var(--gg-text-muted)",
          }}
        >
          <span>城市</span>
          <span>归属</span>
          <span>身份</span>
          <span>城防</span>
          <span>忠诚</span>
          <span>破坏</span>
        </Box>
        {visibleCities.map((item) => (
          <Box
            key={item.id}
            onClick={() => selectCityFromList(Game.Core, item.id)}
            sx={{
              display: "grid",
              gridTemplateColumns: "1.5fr 0.8fr 0.7fr 0.8fr 0.7fr 0.7fr",
              gap: 0.5,
              alignItems: "center",
              fontSize: "0.78rem",
              p: 0.55,
              border: "1px solid var(--gg-border)",
              borderRadius: "var(--gg-radius)",
              cursor: "pointer",
              background: item.underSiege ? "rgba(255,59,48,0.08)" : "var(--gg-panel)",
              "&:hover": {
                borderColor: "var(--gg-selected)",
              },
            }}
          >
            <span>{item.isCapital ? "★ " : "● "}{item.name}</span>
            <span>{item.ownerTeam?.displayName ?? item.ownerFactionId}</span>
            <span>{item.isCapital ? "首都" : "城市"}</span>
            <span>{item.defense}/{item.maxDefense}</span>
            <span>{item.loyalty}</span>
            <span>{item.devastation}</span>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
