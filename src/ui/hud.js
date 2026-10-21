/** Responsive HUD with body search and English/Hindi labels. */
import { SPEED_PRESETS } from '../data/celestialBodies.js';

const HI = {
  Sun:'सूर्य', Mercury:'बुध', Venus:'शुक्र', Earth:'पृथ्वी', Moon:'चंद्रमा', 'The Moon':'चंद्रमा',
  Mars:'मंगल', Phobos:'फोबोस', Deimos:'डिमोस', Jupiter:'बृहस्पति', Io:'आयो', Europa:'यूरोपा',
  Ganymede:'गेनीमेड', Callisto:'कैलिस्टो', Saturn:'शनि', Titan:'टाइटन', Triton:'ट्राइटन', Uranus:'अरुण', Neptune:'वरुण',
  Pluto:'प्लूटो', Charon:'कैरोन', 'SOLAR SYSTEM':'सौरमंडल', EXPLORER:'एक्सप्लोरर',
  BODIES:'ग्रह व उपग्रह', SEARCH:'ग्रह खोजें…', VISUALIZATION:'दृश्य मोड', 'TRUE SCALE':'वास्तविक माप',
  ORBITS:'कक्षाएँ', LABELS:'नाम', 'FREE CAM':'मुक्त कैमरा', 'RESET VIEW':'दृश्य रीसेट',
  'SIMULATED TIME':'वर्तमान समय (IST)', '● NOW':'● अभी', '1 HR/S':'1 घंटा/से', '1 DAY/S':'1 दिन/से',
  '1 MO/S':'1 माह/से', '1 YR/S':'1 वर्ष/से', 'REAL TIME':'वास्तविक समय', 'APPROXIMATE ORBITS':'अनुमानित कक्षाएँ'
};
const translate = (text, lang) => lang === 'hi' ? (HI[text] || text) : text;
function el(tag, className, text) { const node=document.createElement(tag); if(className) node.className=className; if(text!==undefined) node.textContent=text; return node; }
function button(label, className, onClick) { const b=el('button',`hud-btn ${className??''}`,label); b.type='button'; b.addEventListener('click',onClick); return b; }
export function createHUD(app, bodyList) {
  let lang='en', query='';
  const hud=el('div','hud');
  const top=el('header','top-bar');
  const title=el('div','app-title');
  const titleMain=el('span','title-main','SOLAR SYSTEM'), titleSub=el('span','title-sub','EXPLORER'); title.append(titleMain,titleSub);
  const viewControls=el('div','view-controls');
  const vizBtn=button('VISUALIZATION','scale-btn active',()=>app.onSetScaleMode('viz'));
  const trueBtn=button('TRUE SCALE','scale-btn',()=>app.onSetScaleMode('true'));
  const scaleGroup=el('div','btn-group'); scaleGroup.append(vizBtn,trueBtn);
  let orbitsOn=true, labelsOn=true;
  const orbitsBtn=button('ORBITS','toggle-btn active',()=>{orbitsOn=!orbitsOn;orbitsBtn.classList.toggle('active',orbitsOn);app.onToggleOrbits(orbitsOn);});
  const labelsBtn=button('LABELS','toggle-btn active',()=>{labelsOn=!labelsOn;labelsBtn.classList.toggle('active',labelsOn);app.onToggleLabels(labelsOn);});
  const freeBtn=button('FREE CAM','action-btn active',()=>app.onFreeCamera());
  const resetBtn=button('RESET VIEW','action-btn',()=>app.onResetView());
  const langBtn=button('हिंदी','action-btn language-btn',()=>{lang=lang==='en'?'hi':'en';langBtn.textContent=lang==='en'?'हिंदी':'English'; renderText(); app.onLanguageChange?.(lang);});
  viewControls.append(scaleGroup,orbitsBtn,labelsBtn,freeBtn,resetBtn,langBtn); top.append(title,viewControls); hud.append(top);

  const listWrap=el('aside','body-list');
  const heading=el('div','panel-heading','BODIES');
  const search=el('input','body-search'); search.type='search'; search.placeholder='Search planets…'; search.setAttribute('aria-label','Search planets');
  const list=el('div','body-list-items'); const itemButtons=new Map();
  for(const body of bodyList){ const item=button(body.name,`body-item ${body.isMoon?'moon-item':''}`,()=>app.onSelectBody(body.id)); item.dataset.name=body.name.toLowerCase(); item.dataset.id=body.id; itemButtons.set(body.id,item); list.append(item); }
  search.addEventListener('input',()=>{query=search.value.trim().toLowerCase(); filterBodies();});
  search.addEventListener('keydown',e=>{if(e.key==='Enter'){const visible=[...itemButtons.values()].filter(b=>b.style.display!=='none');if(visible.length===1) app.onSelectBody(visible[0].dataset.id); else {const exact=bodyList.find(b=>[b.name.toLowerCase(),(HI[b.name]||'').toLowerCase(),b.id].includes(query));if(exact)app.onSelectBody(exact.id);}}});
  listWrap.append(heading,search,list); hud.append(listWrap);
  const bodiesToggle=button('BODIES ▾','bodies-toggle',()=>{listWrap.classList.toggle('open');bodiesToggle.classList.toggle('active',listWrap.classList.contains('open'));}); hud.append(bodiesToggle);

  const timeBar=el('footer','time-bar');
  const playBtn=button('❚❚','play-btn',()=>app.onTogglePlay());
  const speeds=el('div','speed-group'); const speedButtons=SPEED_PRESETS.map((preset,i)=>{const b=button(preset.label,'speed-btn',()=>app.onSetSpeed(i));speeds.append(b);return b;});
  const dateWrap=el('div','sim-date-wrap'); const dateLabel=el('div','sim-date-label','CURRENT TIME (IST)'); const dateEl=el('div','sim-date','—'); dateWrap.append(dateLabel,dateEl);
  const nowBtn=button('● NOW','now-btn',()=>app.onGoToNow()); nowBtn.title='Return to current time';
  const dateGroup=el('div','date-group');dateGroup.append(dateWrap,nowBtn);timeBar.append(playBtn,speeds,dateGroup);hud.append(timeBar);document.body.append(hud);

  function filterBodies(){for(const b of itemButtons.values()){const body=bodyList.find(x=>x.id===b.dataset.id);const hay=[body.name,body.id,HI[body.name]||''].join(' ').toLowerCase();b.style.display=hay.includes(query)?'block':'none';}}
  function renderText(){titleMain.textContent=translate('SOLAR SYSTEM',lang);titleSub.textContent=translate('EXPLORER',lang);vizBtn.textContent=translate('VISUALIZATION',lang);trueBtn.textContent=translate('TRUE SCALE',lang);orbitsBtn.textContent=translate('ORBITS',lang);labelsBtn.textContent=translate('LABELS',lang);freeBtn.textContent=translate('FREE CAM',lang);resetBtn.textContent=translate('RESET VIEW',lang);heading.textContent=translate('BODIES',lang);search.placeholder=translate('SEARCH',lang);dateLabel.textContent=translate('SIMULATED TIME',lang);nowBtn.textContent=translate('● NOW',lang);speedButtons.forEach((b,i)=>b.textContent=translate(SPEED_PRESETS[i].label,lang));for(const body of bodyList)itemButtons.get(body.id).textContent=translate(body.name,lang);filterBodies();}
  return {setDate(text){dateEl.textContent=text;},setPlaying(playing){playBtn.textContent=playing?'❚❚':'▶';playBtn.classList.toggle('paused',!playing);},setActiveSpeed(index){speedButtons.forEach((b,i)=>b.classList.toggle('active',i===index));},setScaleMode(mode){vizBtn.classList.toggle('active',mode==='viz');trueBtn.classList.toggle('active',mode==='true');},setFreeCam(isFree){freeBtn.classList.toggle('active',isFree);},setActiveBody(id){for(const [bodyId,btn] of itemButtons)btn.classList.toggle('active',bodyId===id);listWrap.classList.remove('open');bodiesToggle.classList.remove('active');},getLanguage(){return lang;}};
}
