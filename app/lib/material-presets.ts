// Template materi HTML interaktif. Admin non-teknis cukup mengubah data di bagian atas skrip.
// Semua memakai EI.report / EI.complete(skor 0-100, jawaban) untuk melaporkan hasil ke induk.
import type { HtmlDoc } from "./material-doc";

const BASE_CSS = `body{max-width:720px;margin:0 auto}h2{margin:0 0 12px;color:#0F2F5E}button{font:inherit;cursor:pointer}
.btn{background:#1B5FB8;color:#fff;border:0;border-radius:10px;padding:12px 18px;font-weight:600;min-height:44px}.btn.alt{background:#fff;color:#1B5FB8;border:1.5px solid #C5D2E4}
.card{border:1px solid #DCE3ED;border-radius:14px;padding:16px;margin:12px 0;background:#fff}.muted{color:#4B5A70;font-size:14px}.ok{color:#1D6B3F;font-weight:600}.bad{color:#B3261E;font-weight:600}
input[type=text]{font:inherit;padding:8px 10px;border:1.5px solid #C5D2E4;border-radius:8px;min-width:110px}`;

export const PRESETS: { key: string; name: string; desc: string; doc: HtmlDoc }[] = [
  {
    key: "quiz", name: "Multiple-choice quiz", desc: "Questions with options A-D, score at the end.",
    doc: {
      css: BASE_CSS + `.opt{display:block;width:100%;text-align:left;margin:8px 0;padding:12px 14px;border:1.5px solid #C5D2E4;border-radius:10px;background:#fff}.opt.sel{border-color:#1B5FB8;background:#E9F0FA}.opt.right{border-color:#1D6B3F;background:#E6F4EC}.opt.wrong{border-color:#B3261E;background:#FDECEA}`,
      html: `<h2>Quiz: Subject-Verb Agreement</h2><div id="app"></div>`,
      js: `// EDIT DATA HERE: q = question, o = options, a = index of the correct answer (starting at 0)
var DATA=[
 {q:"The results of the experiment ___ surprising.",o:["was","were","is","has been"],a:1},
 {q:"She avoided ___ the question.",o:["to answer","answering","answer","answered"],a:1},
 {q:"If I ___ more time, I would travel.",o:["have","had","will have","would have"],a:1}
];
var i=0,score=0,picked=null,answers=[],app=document.getElementById('app');
function show(){
 if(i>=DATA.length){var pct=Math.round(score/DATA.length*100);app.innerHTML='<div class="card"><h2>Done</h2><p>Your score: <b>'+score+' of '+DATA.length+'</b> ('+pct+'%).</p><button class="btn" onclick="restart()">Try again</button></div>';EI.complete(pct,answers);return;}
 var d=DATA[i];app.innerHTML='<div class="card"><p class="muted">Question '+(i+1)+' of '+DATA.length+'</p><p><b>'+d.q+'</b></p>'+d.o.map(function(t,k){return '<button class="opt" data-k="'+k+'">'+"ABCD"[k]+'. '+t+'</button>'}).join('')+'<p id="fb"></p><button class="btn" id="next" style="display:none">'+(i+1<DATA.length?'Next':'See score')+'</button></div>';
 var opts=app.querySelectorAll('.opt');opts.forEach(function(b){b.onclick=function(){if(picked!==null)return;picked=+b.dataset.k;answers.push(picked);var ok=picked===d.a;if(ok)score++;opts.forEach(function(x,k){if(k===d.a)x.classList.add('right');else if(k===picked)x.classList.add('wrong')});document.getElementById('fb').innerHTML=ok?'<span class="ok">Correct!</span>':'<span class="bad">Not quite.</span> Answer: '+"ABCD"[d.a];var n=document.getElementById('next');n.style.display='inline-block';n.onclick=function(){i++;picked=null;show()}}})}
function restart(){i=0;score=0;picked=null;answers=[];show()}
show();`,
    },
  },
  {
    key: "flashcard", name: "Flashcard", desc: "Two-sided cards; mark the ones you know.",
    doc: {
      css: BASE_CSS + `.fc{min-height:150px;display:flex;align-items:center;justify-content:center;text-align:center;font-size:22px;font-weight:700;color:#0F2F5E;cursor:pointer;user-select:none}`,
      html: `<h2>Flashcard: Vocabulary</h2><div id="app"></div>`,
      js: `// EDIT DATA HERE: f = front, b = back
var DATA=[{f:"reluctant",b:"unwilling, hesitant"},{f:"adequate",b:"sufficient, enough"},{f:"hinder",b:"to obstruct, hold back"},{f:"thrive",b:"to grow strongly, flourish"}];
var i=0,flip=false,known={},app=document.getElementById('app');
function show(){var n=Object.keys(known).length;var d=DATA[i];app.innerHTML='<p class="muted">Card '+(i+1)+' of '+DATA.length+' · known: '+n+'</p><div class="card fc" id="c" tabindex="0" role="button" aria-label="Flip card">'+(flip?d.b:d.f)+'</div><p class="muted" style="text-align:center">Click the card to flip it</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn alt" id="p">Previous</button><button class="btn" id="k">I know it</button><button class="btn alt" id="n">Next</button></div>';
 var c=document.getElementById('c');c.onclick=function(){flip=!flip;show()};c.onkeydown=function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();flip=!flip;show()}};
 document.getElementById('p').onclick=function(){i=(i-1+DATA.length)%DATA.length;flip=false;show()};document.getElementById('n').onclick=function(){i=(i+1)%DATA.length;flip=false;show()};
 document.getElementById('k').onclick=function(){known[i]=1;EI.report(Math.round(Object.keys(known).length/DATA.length*100),Object.keys(known));i=(i+1)%DATA.length;flip=false;show()}}
show();`,
    },
  },
  {
    key: "fillblank", name: "Fill in the blank", desc: "Sentences with a blank for participants to fill in.",
    doc: {
      css: BASE_CSS,
      html: `<h2>Fill in the blanks</h2><div id="app"></div><button class="btn" id="chk">Check answers</button><p id="res"></p>`,
      js: `// EDIT DATA HERE: use ___ for the blank, ans = correct answer (case-insensitive)
var DATA=[{t:"The scientists ___ the results yesterday.",ans:"published"},{t:"She is interested ___ marine biology.",ans:"in"},{t:"If it ___ tomorrow, we will stay home.",ans:"rains"}];
var app=document.getElementById('app');
app.innerHTML=DATA.map(function(d,i){return '<div class="card">'+(i+1)+'. '+d.t.replace('___','<input type="text" data-i="'+i+'" aria-label="Answer '+(i+1)+'" autocomplete="off">')+'<span id="m'+i+'"></span></div>'}).join('');
document.getElementById('chk').onclick=function(){var ok=0,ans=[];DATA.forEach(function(d,i){var v=app.querySelector('[data-i="'+i+'"]').value.trim();ans.push(v);var good=v.toLowerCase()===d.ans.toLowerCase();if(good)ok++;document.getElementById('m'+i).innerHTML=good?' <span class="ok">✓</span>':' <span class="bad">✗ ('+d.ans+')</span>'});var pct=Math.round(ok/DATA.length*100);document.getElementById('res').innerHTML='<b>Score: '+ok+' of '+DATA.length+' ('+pct+'%)</b>';EI.complete(pct,ans)};`,
    },
  },
  {
    key: "matching", name: "Matching (drag & drop)", desc: "Drag or tap each word to its match.",
    doc: {
      css: BASE_CSS + `.row{display:grid;grid-template-columns:1fr 1fr;gap:12px}.it{padding:10px 12px;margin:6px 0;border:1.5px solid #C5D2E4;border-radius:10px;background:#fff;touch-action:manipulation}.it.sel{border-color:#1B5FB8;background:#E9F0FA}.it.done{opacity:.5}.drop{min-height:44px;padding:10px 12px;margin:6px 0;border:2px dashed #C5D2E4;border-radius:10px}.drop.good{border-color:#1D6B3F;background:#E6F4EC}`,
      html: `<h2>Match each word with its meaning</h2><p class="muted">Drag a word onto its meaning, or tap a word and then tap a box.</p><div class="row"><div id="L"></div><div id="R"></div></div><p id="res"></p>`,
      js: `// EDIT DATA HERE: w = word, m = meaning
var DATA=[{w:"reluctant",m:"unwilling"},{w:"adequate",m:"sufficient"},{w:"hinder",m:"obstruct"},{w:"thrive",m:"flourish"}];
var L=document.getElementById('L'),R=document.getElementById('R'),sel=null,got=0,tries=0;
function shuffle(a){return a.map(function(x){return [Math.random(),x]}).sort(function(p,q){return p[0]-q[0]}).map(function(p){return p[1]})}
shuffle(DATA).forEach(function(d){var e=document.createElement('div');e.className='it';e.textContent=d.w;e.draggable=true;e.dataset.w=d.w;e.onclick=function(){if(e.classList.contains('done'))return;document.querySelectorAll('.it.sel').forEach(function(x){x.classList.remove('sel')});sel=e;e.classList.add('sel')};e.ondragstart=function(ev){ev.dataTransfer.setData('text/plain',d.w);sel=e};L.appendChild(e)});
shuffle(DATA).forEach(function(d){var t=document.createElement('div');t.className='drop';t.textContent=d.m;t.dataset.w=d.w;function tryDrop(w){tries++;if(w===d.w&&!t.classList.contains('good')){t.classList.add('good');t.textContent=d.m+': '+w;got++;var el=L.querySelector('[data-w="'+w+'"]');if(el){el.classList.add('done');el.classList.remove('sel')}sel=null;if(got===DATA.length){var pct=Math.max(0,Math.round(DATA.length/tries*100));document.getElementById('res').innerHTML='<b class="ok">All matched! Attempts: '+tries+'</b>';EI.complete(pct,{tries:tries})}}else if(w!==d.w){document.getElementById('res').innerHTML='<span class="bad">Not a match, try again.</span>'}}
 t.ondragover=function(ev){ev.preventDefault()};t.ondrop=function(ev){ev.preventDefault();tryDrop(ev.dataTransfer.getData('text/plain'))};t.onclick=function(){if(sel)tryDrop(sel.dataset.w)};R.appendChild(t)});`,
    },
  },
  {
    key: "timer", name: "Practice timer", desc: "A countdown for timed reading practice per passage.",
    doc: {
      css: BASE_CSS + `.big{font-size:56px;font-weight:800;color:#0F2F5E;text-align:center}.late{color:#B3261E}`,
      html: `<h2>Reading practice timer</h2><p class="muted">Set the duration, read the passage, and finish before time runs out.</p><div class="card"><div class="big" id="t">11:00</div><div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center"><label>Minutes <input type="text" id="m" value="11" size="3" inputmode="numeric" aria-label="Minutes"></label><button class="btn" id="go">Start</button><button class="btn alt" id="rs">Reset</button></div><p id="msg" class="muted" style="text-align:center"></p></div>`,
      js: `var T=document.getElementById('t'),M=document.getElementById('m'),msg=document.getElementById('msg'),left=0,iv=null,total=0;
function fmt(s){return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')}
function set(){var m=Math.max(1,Math.min(90,parseInt(M.value,10)||11));total=m*60;left=total;T.textContent=fmt(left);T.classList.remove('late')}
document.getElementById('go').onclick=function(){if(iv)return;set();msg.textContent='Running…';iv=setInterval(function(){left--;T.textContent=fmt(Math.max(0,left));if(left<=60)T.classList.add('late');if(left<=0){clearInterval(iv);iv=null;msg.textContent='Time is up!';EI.complete(100,{minutes:total/60})}},1000)};
document.getElementById('rs').onclick=function(){clearInterval(iv);iv=null;set();msg.textContent=''};M.onchange=set;set();`,
    },
  },
];
