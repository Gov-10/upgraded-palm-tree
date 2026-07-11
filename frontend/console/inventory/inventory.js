const tabs = document.querySelectorAll('.module-tab');
const panels = document.querySelectorAll('.console-content');
const titleEl = document.getElementById('page-title');

function activateTab(key){
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === key));
    panels.forEach(p => p.classList.toggle('active', p.id === 'tab-' + key));
    const label = document.querySelector('.module-tab[data-tab="'+key+'"]').textContent.trim();
    titleEl.textContent = 'Inventory · ' + label;
    window.scrollTo({top:0,behavior:'smooth'});
}

tabs.forEach(t => t.addEventListener('click', () => activateTab(t.dataset.tab)));
document.querySelectorAll('[data-goto]').forEach(el => el.addEventListener('click', (e)=>{ e.preventDefault(); activateTab(el.dataset.goto); }));

// ambient particle background
const canvas = document.getElementById('bg-canvas');
const ctx = canvas.getContext('2d');
function resize(){ canvas.width = innerWidth; canvas.height = innerHeight; }
resize();
addEventListener('resize', resize);
const dots = Array.from({length:50}, () => ({
    x: Math.random()*innerWidth, y: Math.random()*innerHeight,
    r: Math.random()*1.4+0.3, vx:(Math.random()-0.5)*0.15, vy:(Math.random()-0.5)*0.15
}));
function frame(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    dots.forEach(d=>{
        d.x+=d.vx; d.y+=d.vy;
        if(d.x<0||d.x>canvas.width) d.vx*=-1;
        if(d.y<0||d.y>canvas.height) d.vy*=-1;
        ctx.beginPath(); ctx.arc(d.x,d.y,d.r,0,Math.PI*2);
        ctx.fillStyle='rgba(148,163,184,0.35)'; ctx.fill();
    });
    requestAnimationFrame(frame);
}
frame();
