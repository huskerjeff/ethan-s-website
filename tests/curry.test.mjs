import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// A deterministic DOM/clock harness runs the actual module and its event handlers.
// Visual, keyboard and WebGL validation remains a browser-review responsibility.
function court(saved = {}, failStorage = false) {
  const handlers = new Map(), frames = new Map(), events = [];
  const values = new Map(Object.entries(saved).map(([k,v]) => ['ethanArena:v1:' + k, JSON.stringify(v)]));
  let document, sequence = 0, time = 0;
  function node() {
    return { textContent: '', hidden: false, disabled: false, attrs: {}, style: {}, children: [], listeners: {},
      classList: { add() {}, remove() {} },
      setAttribute(k,v) { this.attrs[k] = v; },
      addEventListener(k,v) { this.listeners[k] = v; },
      replaceChildren(...items) { this.children = items; },
      focus() { document.activeElement = this; },
      click() { if (!this.disabled) this.listeners.click?.(); }
    };
  }
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(([,id]) => [id,node()]));
  const spots = Array.from({length:5}, () => { const n=node(); n.state=node(); n.querySelector=()=>n.state; return n; });
  const cards = Array.from({length:4}, () => { const n=node(); n.story=node(); n.story.hidden=true; n.querySelector=()=>n.story; return n; });
  ids['record-confirm'].hidden = true;
  document = { readyState: 'complete', hidden:false, activeElement:null,
    getElementById:id=>ids[id], createElement:node,
    querySelectorAll:s=>s==='[data-curry-spot]' ? spots : cards,
    addEventListener(k,v) { if (!handlers.has(k)) handlers.set(k,[]); handlers.get(k).push(v); },
    dispatchEvent(e) { events.push(e); handlers.get(e.type)?.forEach(f=>f(e)); }
  };
  const context=vm.createContext({ document,
    window:{matchMedia:()=>({matches:true})},
    localStorage:{getItem:k=>values.get(k)??null,setItem(k,v){if(failStorage) throw new Error('Storage disabled');values.set(k,v);}},
    requestAnimationFrame:f=>{frames.set(++sequence,f);return sequence;},cancelAnimationFrame:id=>frames.delete(id),
    CustomEvent:class {constructor(type,opts={}){this.type=type;this.detail=opts.detail;}}
  });
  const source=readFileSync(new URL('../curry.js',import.meta.url),'utf8').replace(/export (const|function) /g,'$1 ');
  vm.runInContext(source,context);
  function tick() {time+=50;const tasks=[...frames.values()];frames.clear();tasks.forEach(f=>f(time));}
  function make() {ids['curry-shot'].click();tick();for(let i=0;i<20;i++)tick();ids['curry-shot'].click();}
  return {ids,spots,cards,values,events,document,make,tick};
}

test('actual Court handlers save unlocks, count each make once, and restore progress', () => {
  const page=court();
  assert.equal(page.spots[0].disabled,false);assert.equal(page.spots[1].disabled,true);
  for(let i=0;i<3;i++)page.make();
  assert.equal(page.spots[1].disabled,false);
  assert.equal(page.ids['curry-streak'].textContent,'STREAK: 3/3');
  assert.equal(page.ids['record-total'].textContent,'00003');
  page.document.dispatchEvent({type:'arena:three'});
  assert.equal(page.ids['record-total'].textContent,'00004');
  const range=JSON.parse(page.values.get('ethanArena:v1:curryRange'));
  const restored=court({curryRange:range,recordTotal:4});
  assert.equal(restored.spots[1].disabled,false);assert.equal(restored.ids['record-total'].textContent,'00004');
  assert.equal(restored.ids['curry-streak'].textContent,'STREAK: 3/3');
});

test('counter milestone and confirmed reset use the real UI handlers', () => {
  const page=court({recordTotal:9});
  page.make();assert.equal(page.ids['record-message'].textContent,'Double digits!');
  assert.equal(page.ids['record-milestones'].children.length,1);
  page.ids['record-reset'].click();assert.equal(page.ids['record-confirm'].hidden,false);
  assert.equal(page.document.activeElement,page.ids['record-no']);
  page.ids['record-no'].click();assert.equal(page.ids['record-total'].textContent,'00010');
  page.ids['record-reset'].click();page.ids['record-yes'].click();
  assert.equal(page.ids['record-total'].textContent,'00000');
  assert.equal(page.values.get('ethanArena:v1:recordTotal'),'0');
  assert.equal(page.ids['record-milestones'].children.length,0);
  assert.equal(page.document.activeElement,page.ids['record-reset']);
});

test('record cards reveal stories, persist visits and announce the badge', () => {
  const page=court();
  page.cards.forEach(card=>card.click());
  assert.ok(page.cards.every(card=>card.attrs['aria-expanded']==='true' && !card.story.hidden));
  assert.ok(page.events.some(e=>e.type==='arena:badge' && e.detail==='recordchaser'));
  page.cards[0].click();assert.equal(page.cards[0].story.hidden,true);
  page.make();assert.equal(page.cards[0].story.hidden,true,'shooting must not reopen closed cards');
  const saved=JSON.parse(page.values.get('ethanArena:v1:curryRange'));
  assert.equal(saved.flipped.length,4);
});

test('blocked storage and background pause remain playable without an extra make', () => {
  const page=court({},true);
  page.make();assert.equal(page.ids['record-total'].textContent,'00001');
  assert.match(page.ids['curry-storage'].textContent,/Storage is unavailable/);
  page.ids['curry-shot'].click();page.tick();
  page.document.hidden=true;page.document.dispatchEvent({type:'visibilitychange'});
  assert.equal(page.ids['curry-shot'].textContent,'START SHOT');
  assert.equal(page.ids['record-total'].textContent,'00001');
});
