import { POWERS } from './campaign.mjs';

const TAU = Math.PI * 2;
const THEMES = {
  orion: { base: '#06111d', glow: '#1c6575', stars: '173,212,223', debris: '#0b1822', edge: '#172a35' },
  titan: { base: '#160f0d', glow: '#916247', stars: '224,197,167', debris: '#231914', edge: '#4b3427' },
  ion: { base: '#061815', glow: '#238b72', stars: '145,230,203', debris: '#102824', edge: '#245248' },
  solar: { base: '#1c0d08', glow: '#d57a32', stars: '255,204,148', debris: '#2d1a10', edge: '#664024' },
  rift: { base: '#100b20', glow: '#7362ac', stars: '196,183,237', debris: '#1b152e', edge: '#44365d' },
  core: { base: '#190a10', glow: '#ac4257', stars: '242,165,175', debris: '#2d141d', edge: '#5a2737' },
};

function seeded(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function polygon(ctx, points, fill, stroke, width = 1) {
  ctx.beginPath();
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}

function circle(ctx, x, y, radius, fill) {
  ctx.beginPath(); ctx.arc(x, y, radius, 0, TAU); ctx.fillStyle = fill; ctx.fill();
}

function glow(ctx, x, y, radius, color) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, 'transparent');
  circle(ctx, x, y, radius, gradient);
}

/** All artwork is drawn in logical 1200 × 600 game coordinates. */
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.time = 0;
    this.scrollTime = 0;
    const random = seeded(40723);
    this.stars = Array.from({ length: 170 }, () => ({
      x: random() * 1200,
      y: random() * 600,
      z: random(),
      phase: random() * TAU,
    }));
    this.debris = Array.from({ length: 13 }, () => ({
      x: random() * 1600,
      y: random() < .5 ? random() * 60 - 30 : 560 + random() * 100,
      size: 15 + random() * 55,
      turn: random() * TAU,
    }));
    const makeCanvas = () => typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(1200, 600)
      : Object.assign(canvas.ownerDocument.createElement('canvas'), { width: 1200, height: 600 });
    this.backdrops = new Map();
    for (const theme of Object.keys(THEMES)) {
      const backdrop = makeCanvas();
      this.paintBackdrop(backdrop.getContext('2d'), theme);
      this.backdrops.set(theme, backdrop);
    }
    this.backdrop = this.backdrops.get('orion');
    const ctx = this.ctx;
    this.vignette = ctx.createRadialGradient(580,260,160,600,300,710);
    this.vignette.addColorStop(0,'transparent');
    this.vignette.addColorStop(1,'rgba(0,4,10,.42)');
  }

  paintBackdrop(ctx, theme = 'orion') {
    if (theme !== 'orion') { this.paintThemedBackdrop(ctx, theme); return; }
    const random = seeded(8911);
    const base = ctx.createLinearGradient(0, 0, 1000, 600);
    base.addColorStop(0, '#06111d');
    base.addColorStop(.55, '#071625');
    base.addColorStop(1, '#030a13');
    ctx.fillStyle = base; ctx.fillRect(0, 0, 1200, 600);

    ctx.save();
    ctx.translate(740, 310); ctx.rotate(-.42); ctx.scale(2, .36);
    glow(ctx, 0, 0, 330, 'rgba(24,103,117,.15)');
    glow(ctx, -80, 65, 270, 'rgba(23,68,100,.19)');
    ctx.restore();
    glow(ctx, 1020, 140, 300, 'rgba(46,108,131,.09)');

    // A distant ring system, cut by the planet in the foreground.
    ctx.save(); ctx.translate(1004, 126); ctx.rotate(-.38);
    for (let i = 0; i < 6; i++) {
      ctx.beginPath(); ctx.ellipse(0, 0, 275 + i * 4, 68 + i * 2, 0, 0, TAU);
      ctx.strokeStyle = `rgba(108,162,169,${.028 + i * .004})`;
      ctx.lineWidth = i === 3 ? 4 : 1; ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.beginPath(); ctx.arc(1010, 87, 177, 0, TAU); ctx.clip();
    const sphere = ctx.createRadialGradient(891, 8, 5, 1015, 76, 225);
    sphere.addColorStop(0, '#37606d');
    sphere.addColorStop(.35, '#244753');
    sphere.addColorStop(.7, '#112837');
    sphere.addColorStop(1, '#030d19');
    ctx.fillStyle = sphere; ctx.fillRect(800, -100, 420, 390);
    for (let i = 0; i < 28; i++) {
      const y = -75 + i * 12;
      ctx.beginPath(); ctx.moveTo(820, y);
      ctx.bezierCurveTo(880, y - 23 + random() * 20, 1050, y + 50, 1210, y + 25);
      ctx.strokeStyle = `rgba(${random() > .5 ? '112,157,157' : '4,17,29'},${.035 + random() * .08})`;
      ctx.lineWidth = 3 + random() * 14; ctx.stroke();
    }
    for (let i = 0; i < 16; i++) {
      ctx.beginPath();
      ctx.ellipse(870 + random() * 250, -55 + random() * 290, 8 + random() * 30, 2 + random() * 6, -.3, 0, TAU);
      ctx.fillStyle = 'rgba(7,21,31,.07)'; ctx.fill();
    }
    const shadow = ctx.createLinearGradient(842, 0, 1180, 90);
    shadow.addColorStop(0, 'transparent'); shadow.addColorStop(.53, 'rgba(1,7,14,.13)'); shadow.addColorStop(1, 'rgba(1,7,14,.92)');
    ctx.fillStyle = shadow; ctx.fillRect(800, -100, 420, 390);
    ctx.restore();
    ctx.beginPath(); ctx.arc(1010, 87, 177, 1.48, 4.73);
    ctx.strokeStyle = 'rgba(117,187,197,.35)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(1010, 87, 180, 1.55, 4.7);
    ctx.strokeStyle = 'rgba(79,164,184,.07)'; ctx.lineWidth = 3; ctx.stroke();

    // The skeleton of an abandoned orbital dock, beyond the combat plane.
    ctx.save(); ctx.translate(730, 445); ctx.rotate(-.17);
    ctx.strokeStyle = 'rgba(51,88,103,.15)'; ctx.lineWidth = 2;
    for (let i = 0; i < 7; i++) {
      ctx.strokeRect(i * 77, 0, 48, 85);
      ctx.beginPath(); ctx.moveTo(i * 77, 0); ctx.lineTo(i * 77 + 48, 85); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(i * 77 + 48, 0); ctx.lineTo(i * 77, 85); ctx.stroke();
    }
    ctx.fillStyle = '#07111c'; ctx.fillRect(-15, -12, 580, 11); ctx.fillRect(-15, 84, 580, 18);
    ctx.fillStyle = 'rgba(101,155,161,.12)'; ctx.fillRect(-15, -12, 580, 1);
    ctx.restore();

    // Chart lines make the emptiness feel immense without competing with play.
    ctx.strokeStyle = 'rgba(82,128,148,.035)'; ctx.lineWidth = 1;
    for (let y = 90; y < 600; y += 120) {
      ctx.beginPath(); ctx.moveTo(0, y + .5); ctx.lineTo(1200, y + .5); ctx.stroke();
    }
    for (let x = 80; x < 1200; x += 180) {
      ctx.beginPath(); ctx.moveTo(x + .5, 0); ctx.lineTo(x + .5, 600); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(113,163,178,.18)';
    [[380,140],[690,380],[1130,360],[93,455],[521,48]].forEach(([x,y]) => {
      ctx.fillRect(x - 3,y,7,1); ctx.fillRect(x,y - 3,1,7);
    });
  }

  paintThemedBackdrop(ctx, theme) {
    const palette = THEMES[theme] || THEMES.orion;
    const random = seeded(3201 + Object.keys(THEMES).indexOf(theme) * 117);
    const base = ctx.createLinearGradient(0,0,1200,600);
    base.addColorStop(0,palette.base); base.addColorStop(.65,'#080b14'); base.addColorStop(1,palette.base);
    ctx.fillStyle=base; ctx.fillRect(0,0,1200,600);
    if (theme === 'titan') {
      glow(ctx,1030,100,430,'rgba(155,101,63,.17)');
      const moon=ctx.createRadialGradient(928,51,10,1044,127,210);
      moon.addColorStop(0,'#7b5f48');moon.addColorStop(.46,'#413326');moon.addColorStop(1,'#130f13');
      circle(ctx,1050,95,194,moon);
      ctx.save();ctx.beginPath();ctx.arc(1050,95,194,0,TAU);ctx.clip();
      for(let i=0;i<20;i++) {
        const x=870+random()*340,y=-60+random()*340,r=8+random()*30;
        circle(ctx,x,y,r,'rgba(7,7,12,.18)');
        ctx.beginPath();ctx.arc(x-2,y-3,r,-2.7,-.2);ctx.strokeStyle='rgba(210,164,113,.09)';ctx.lineWidth=2;ctx.stroke();
      }
      ctx.restore();
      ctx.save();ctx.translate(740,365);ctx.rotate(-.3);
      for(let i=0;i<9;i++) {
        const x=i*66;
        polygon(ctx,[[x,-20],[x+40,-20],[x+40,95],[x+20,120],[x,95]],'#251c18','#59402d');
        ctx.fillStyle='#110e10';ctx.fillRect(x+9,-10,22,68);
        ctx.strokeStyle='#79563a';ctx.beginPath();ctx.moveTo(x,24);ctx.lineTo(x+40,24);ctx.stroke();
      }
      ctx.fillStyle='#3a2a1d';ctx.fillRect(-10,-30,620,12);ctx.fillRect(0,95,600,10);ctx.restore();
      for(let i=0;i<18;i++) {
        const x=random()*1200,y=random()<.5?random()*115:495+random()*105;
        ctx.save();ctx.translate(x,y);ctx.rotate(random()*TAU);
        polygon(ctx,[[-28,-10],[7,-21],[32,0],[17,18],[-19,22]],'#241a15','#433025');ctx.restore();
      }
    } else if(theme==='ion') {
      glow(ctx,1020,240,420,'rgba(39,160,124,.16)');
      for(let i=0;i<12;i++) {
        ctx.beginPath();ctx.moveTo(-50,80+i*38);
        ctx.bezierCurveTo(310,240+i*13,730,-80+i*51,1260,150+i*30);
        ctx.strokeStyle=`rgba(65,204,163,${.025+i*.002})`;ctx.lineWidth=8+i*2;ctx.stroke();
        ctx.strokeStyle='rgba(99,224,186,.055)';ctx.lineWidth=1;ctx.stroke();
      }
      ctx.save();ctx.translate(1045,220);ctx.rotate(-.2);
      for(let i=0;i<5;i++) {
        ctx.beginPath();ctx.ellipse(0,0,176+i*9,240+i*9,0,0,TAU);
        ctx.strokeStyle=i===0?'rgba(93,215,169,.18)':'rgba(39,112,101,.08)';ctx.lineWidth=i===0?3:1;ctx.stroke();
      }
      circle(ctx,0,0,155,'#0b2825');glow(ctx,-80,-60,185,'rgba(72,170,126,.22)');ctx.restore();
      for(let i=0;i<27;i++) {
        const x=random()*1200,y=random()*600;
        ctx.beginPath();ctx.moveTo(x-4,y);ctx.lineTo(x+5,y);ctx.moveTo(x,y-4);ctx.lineTo(x,y+4);
        ctx.strokeStyle='rgba(89,207,179,.12)';ctx.lineWidth=1;ctx.stroke();
      }
    } else if(theme==='solar') {
      glow(ctx,1120,90,520,'rgba(213,101,30,.22)');
      const sun=ctx.createRadialGradient(1115,80,15,1100,90,205);
      sun.addColorStop(0,'#b37337');sun.addColorStop(.6,'#77411f');sun.addColorStop(1,'#42221a');
      circle(ctx,1100,70,205,sun);
      for(let i=0;i<12;i++) {
        ctx.beginPath();ctx.arc(1100,70,211+i*9,-.2,TAU);
        ctx.strokeStyle=`rgba(225,132,54,${.07-i*.004})`;ctx.lineWidth=i%3===0?3:1;ctx.stroke();
      }
      for(const side of [0,1]) {
        ctx.save();ctx.translate(650,side?600:0);if(side)ctx.scale(1,-1);
        polygon(ctx,[[-500,0],[650,0],[650,48],[430,58],[390,98],[180,81],[100,45],[-210,70],[-370,36],[-500,44]],'#221713','#503425');
        for(let i=0;i<10;i++) {
          const x=-440+i*112;
          ctx.fillStyle='#4f2a1c';ctx.fillRect(x,9,61,13);
          ctx.fillStyle='#9b5525';ctx.fillRect(x+4,12,48,3);
          ctx.strokeStyle='#493023';ctx.strokeRect(x+10,29,72,30);
        }
        ctx.restore();
      }
      for(let i=0;i<17;i++) {
        const x=random()*1200,y=random()*600;
        ctx.fillStyle='rgba(245,139,55,.14)';ctx.fillRect(x,y,1+random()*2,1);
      }
    } else if(theme==='rift') {
      glow(ctx,960,265,390,'rgba(105,73,175,.19)');
      ctx.save();ctx.translate(995,260);ctx.rotate(.32);
      for(let i=0;i<8;i++) {
        ctx.beginPath();ctx.ellipse(0,0,70+i*16,170+i*13,0,0,TAU);
        ctx.strokeStyle=`rgba(159,131,215,${.11-i*.01})`;ctx.lineWidth=i===0?4:1;ctx.stroke();
      }
      polygon(ctx,[[-18,-156],[25,-109],[-2,-45],[34,11],[-9,77],[7,153],[-35,113],[-16,39],[-42,-13],[-8,-88]],'#080712','#685493',2);
      ctx.restore();
      for(let i=0;i<23;i++) {
        const x=random()*1300-50,y=random()*600;
        ctx.save();ctx.translate(x,y);ctx.rotate(random()*TAU);
        const r=10+random()*30;
        polygon(ctx,[[0,-r],[r*.6,-r*.2],[r*.35,r*.9],[-r*.45,r*.4]],'#211831','#503c6a');
        ctx.beginPath();ctx.moveTo(0,-r);ctx.lineTo(-2,0);ctx.lineTo(r*.35,r*.9);ctx.strokeStyle='#62517e';ctx.lineWidth=.6;ctx.stroke();
        ctx.restore();
      }
    } else {
      glow(ctx,1020,300,420,'rgba(173,42,70,.19)');
      circle(ctx,1045,300,160,'#0b0912');
      for(let i=0;i<9;i++) {
        ctx.beginPath();ctx.arc(1045,300,170+i*12,0,TAU);
        ctx.strokeStyle=i%3===0?'rgba(202,83,105,.2)':'rgba(151,54,77,.09)';ctx.lineWidth=i%3===0?4:1;ctx.stroke();
      }
      for(let i=0;i<12;i++) {
        const angle=i*TAU/12;
        ctx.save();ctx.translate(1045,300);ctx.rotate(angle);
        polygon(ctx,[[170,-16],[300,-25],[360,0],[300,25],[170,16]],'#2b1520','#5f2a3d');
        ctx.fillStyle='#7f354c';ctx.fillRect(195,-3,110,6);ctx.restore();
      }
      circle(ctx,1045,300,122,'#140c17');
      glow(ctx,1045,300,130,'rgba(207,58,88,.3)');
      for(let i=0;i<4;i++) {
        ctx.save();ctx.translate(1045,300);ctx.rotate(.25+i*Math.PI/2);
        polygon(ctx,[[40,-40],[100,-100],[110,-45],[65,-5]],'#4b2033','#9f4f67');ctx.restore();
      }
      for(const y of [20,560]) {
        ctx.fillStyle='#2b1420';ctx.fillRect(0,y,1200,18);
        for(let x=0;x<1200;x+=85){ctx.fillStyle='#5f293c';ctx.fillRect(x,y+5,38,3);}
      }
    }
    ctx.strokeStyle='rgba(140,158,171,.035)';ctx.lineWidth=1;
    for(let y=100;y<600;y+=125){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(1200,y);ctx.stroke();}
  }

  background(game) {
    const ctx = this.ctx;
    const theme = game.stage?.theme || 'orion';
    const palette = THEMES[theme] || THEMES.orion;
    ctx.drawImage(this.backdrops.get(theme) || this.backdrop, 0, 0);
    const drift = this.scrollTime;
    for (const star of this.stars) {
      const x = ((star.x - drift * (8 + star.z * 34)) % 1200 + 1200) % 1200;
      const alpha = .22 + star.z * .5 + Math.sin(this.time * .8 + star.phase) * .09;
      ctx.fillStyle = `rgba(${palette.stars},${alpha})`;
      const size = star.z > .94 ? 2 : 1;
      ctx.fillRect(x, star.y, size, size);
      if (star.z > .97) {
        ctx.fillStyle = 'rgba(145,210,226,.13)';
        ctx.fillRect(x - 2, star.y, 5, 1); ctx.fillRect(x, star.y - 2, 1, 5);
      }
    }
    ctx.save();
    for (const debris of this.debris) {
      const x = ((debris.x - drift * 22) % 1600 + 1600) % 1600 - 200;
      ctx.save(); ctx.translate(x, debris.y); ctx.rotate(debris.turn);
      polygon(ctx, [[-debris.size,0],[-debris.size*.6,-15],[debris.size*.3,-21],[debris.size,0],[debris.size*.7,14],[-debris.size*.5,20]], palette.debris, palette.edge);
      ctx.fillStyle = 'rgba(56,94,107,.22)'; ctx.fillRect(-debris.size*.65,-4,debris.size,3);
      ctx.restore();
    }
    ctx.restore();
  }

  ship(player, state) {
    if (!player || player.hp <= 0) return;
    const ctx = this.ctx;
    const invulnerable = state !== 'menu' && Number(player.invulnerable) > 0;
    if (invulnerable && Math.floor(this.time * 14) % 3 === 0) return;
    ctx.save(); ctx.translate(player.x, player.y);
    if (state === 'menu') ctx.scale(1.8, 1.8);
    const flame = 24 + Math.sin(this.time * 58) * 5;
    glow(ctx, -28, 0, 48, 'rgba(255,132,60,.16)');
    polygon(ctx, [[-25,-6],[-25,6],[-28-flame,0]], '#f07843');
    polygon(ctx, [[-24,-3],[-24,3],[-28-flame*.68,0]], '#ffe6a1');
    polygon(ctx, [[-32,-10],[-13,-9],[-9,-20],[0,-20],[11,-10],[35,-3],[44,1],[24,9],[2,11],[-13,21],[-24,21],[-20,8],[-33,7]], '#263b49', '#617b87');
    polygon(ctx, [[-23,-9],[-8,-7],[-4,-17],[1,-17],[11,-7],[35,-2],[21,4],[-4,5],[-19,11]], '#c0ced0', '#dfebe6');
    polygon(ctx, [[-7,7],[13,6],[1,13],[-13,20],[-20,20]], '#718f9d');
    polygon(ctx, [[2,-9],[12,-7],[23,-3],[6,-2],[-1,-4]], '#2b9fae', '#99ecdc');
    ctx.fillStyle = '#ec8b4f'; ctx.fillRect(-28,-7,7,10);
    ctx.fillStyle = '#102332'; ctx.fillRect(-16,-2,10,3);
    ctx.fillStyle = '#587581'; ctx.fillRect(17,6,17,3);
    ctx.fillStyle = '#b1d3d5'; ctx.fillRect(32,5,9,2);
    ctx.fillStyle = '#e6c587'; ctx.fillRect(-7,9,5,2);
    if (player.weapon >= 2) {
      ctx.save(); ctx.translate(-2, -31);
      glow(ctx, 0, 0, 12, 'rgba(83,214,224,.18)');
      polygon(ctx, [[-7,0],[0,-5],[10,0],[0,5]], '#597b8b', '#a2d8df');
      ctx.fillStyle = '#65e0e4'; ctx.fillRect(5,-1,7,2); ctx.restore();
    }
    if (player.weapon >= 3) {
      ctx.save(); ctx.translate(-2, 32);
      glow(ctx, 0, 0, 12, 'rgba(83,214,224,.18)');
      polygon(ctx, [[-7,0],[0,-5],[10,0],[0,5]], '#597b8b', '#a2d8df');
      ctx.fillStyle = '#65e0e4'; ctx.fillRect(5,-1,7,2); ctx.restore();
    }
    if (player.charge > .03) {
      const radius = 5 + player.charge * 14;
      glow(ctx, 43, 0, radius * 2.8, `rgba(90,222,240,${.2 + player.charge * .35})`);
      circle(ctx, 43, 0, radius, 'rgba(83,209,225,.18)');
      circle(ctx, 43, 0, radius * .48, '#bffcff');
      ctx.beginPath(); ctx.arc(43, 0, radius + 5, this.time * 4, this.time * 4 + TAU * player.charge);
      ctx.strokeStyle = '#65e1e6'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    if (invulnerable) {
      ctx.beginPath(); ctx.ellipse(2,0,48,32,0,0,TAU);
      ctx.strokeStyle = `rgba(131,231,241,${.24 + Math.sin(this.time * 10) * .1})`; ctx.lineWidth=1; ctx.stroke();
    }
    if(player.shieldTime > 0 && player.shieldHits > 0) {
      glow(ctx,1,0,67,'rgba(97,233,209,.09)');
      polygon(ctx,[[57,0],[30,-39],[-27,-39],[-54,0],[-27,39],[30,39]],'rgba(82,208,190,.025)','#8ff1e1',1.6);
      for(let i=0;i<player.shieldHits;i++)circle(ctx,-9+i*16,-47,3,'#b7fff0');
    }
    if(player.rapidTime > 0) {
      ctx.strokeStyle='rgba(242,229,118,.5)';ctx.lineWidth=1;
      for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(-56,side*14);ctx.lineTo(-35,side*18);ctx.stroke();}
    }
    if(player.power && player.power !== 'blaster' && player.powerTime > 0) {
      circle(ctx,29,4,3,POWERS[player.power]?.color || '#9ed8ff');
    }
    ctx.restore();
  }

  enemy(enemy) {
    const ctx = this.ctx;
    ctx.save(); ctx.translate(enemy.x,enemy.y);
    const scale = (enemy.radius || 20) / 20;
    ctx.scale(scale, scale);
    const pulse = .7 + Math.sin(this.time * 7 + (enemy.age || 0)) * .3;
    if (enemy.type === 'heavy') {
      glow(ctx, 5, 0, 33, 'rgba(226,100,56,.08)');
      polygon(ctx, [[-25,-7],[-18,-17],[0,-22],[18,-16],[26,-6],[23,13],[7,21],[-12,17],[-20,9]], '#3b2d30','#8e6156');
      polygon(ctx, [[-23,-7],[-6,-15],[12,-14],[3,-5],[-14,0],[-19,10],[-28,4]], '#7f594b','#b78466');
      polygon(ctx, [[0,7],[14,3],[24,8],[16,17],[5,18]], '#5a4240');
      circle(ctx,0,0,8,'#231c25'); circle(ctx,-1,0,5,'#e29a5c'); circle(ctx,-2,0,2,'#ffedbc');
      ctx.fillStyle='#e8905e';ctx.fillRect(-24,-14,9,3);ctx.fillRect(-24,11,9,3);
      ctx.strokeStyle='#392a2d';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(8,-16);ctx.lineTo(6,-7);ctx.stroke();
    } else if (enemy.type === 'turret') {
      polygon(ctx, [[-21,-12],[-8,-22],[12,-17],[22,-4],[18,16],[0,22],[-19,13]],'#3a3540','#81616a');
      polygon(ctx, [[-16,-11],[0,-16],[15,-10],[9,-2],[-9,0]],'#65505a');
      ctx.fillStyle='#a36e63'; ctx.fillRect(-28,-4,24,8);
      ctx.fillStyle='#e9aa78'; ctx.fillRect(-29,-3,5,6);
      circle(ctx,2,2,9,'#171d2b');circle(ctx,2,2,5,`rgba(255,123,80,${pulse})`);
      ctx.strokeStyle='#a77265';ctx.lineWidth=2;ctx.beginPath();ctx.arc(2,2,13,-.8,1.8);ctx.stroke();
    } else if (enemy.type === 'zigzag' || enemy.type === 'interceptor') {
      polygon(ctx,[[-28,0],[-8,-8],[5,-22],[18,-24],[11,-7],[19,0],[11,7],[18,24],[5,22],[-8,8]],'#5b3540','#ac6470');
      polygon(ctx,[[-22,0],[1,-6],[11,0],[1,6]],'#cc796c');
      ctx.fillStyle='#edb17c'; ctx.fillRect(-15,-2,12,4);
      glow(ctx,17,-11,13,'rgba(249,113,80,.15)');glow(ctx,17,11,13,'rgba(249,113,80,.15)');
      polygon(ctx,[[12,-13],[24,-11],[12,-9]],'#fa8f66');
      polygon(ctx,[[12,9],[24,11],[12,13]],'#fa8f66');
    } else {
      polygon(ctx,[[-25,0],[-11,-11],[9,-15],[21,-9],[10,-2],[12,4],[22,10],[7,15],[-13,9]],'#6a3e42','#ae665c');
      polygon(ctx,[[-21,0],[-9,-7],[4,-5],[-4,0],[6,7],[-12,5]],'#ba7562');
      polygon(ctx,[[4,-12],[17,-8],[8,-5]],'#e7a47f');
      circle(ctx,-8,0,3,'#ffe5b8');
      polygon(ctx,[[16,-5],[29,0],[16,5]],'#bc5947');
      polygon(ctx,[[17,-2],[25,0],[17,2]],'#f0b381');
    }
    ctx.restore();
  }

  boss(boss) {
    if(!boss.type || boss.type === 'sentinel') { this.sentinel(boss); return; }
    const ctx=this.ctx;
    ctx.save();ctx.translate(boss.x,boss.y);
    const scale=(boss.radius||90)/90;ctx.scale(scale,scale);
    if(boss.type==='carrier')this.carrier(boss);
    else if(boss.type==='serpent')this.serpent(boss);
    else if(boss.type==='forge')this.forge(boss);
    else if(boss.type==='prism')this.prism(boss);
    else this.overlord(boss);
    if(boss.lastHit>0){ctx.globalAlpha=.25;circle(ctx,0,0,65,'#fff4d3');ctx.globalAlpha=1;}
    ctx.restore();
  }

  carrier() {
    const ctx=this.ctx;
    glow(ctx,0,0,150,'rgba(226,149,75,.08)');
    polygon(ctx,[[-111,-46],[-60,-76],[50,-65],[95,-34],[106,0],[95,34],[50,65],[-60,76],[-111,46],[-88,15],[-88,-15]],'#383136','#9a7a60',2);
    polygon(ctx,[[-69,-34],[46,-44],[81,-20],[89,20],[47,43],[-70,34]],'#645447','#ba9a74');
    ctx.fillStyle='#151b24';ctx.fillRect(-54,-26,97,52);
    for(let i=0;i<4;i++) {
      const x=-43+i*21;
      ctx.fillStyle='#303847';ctx.fillRect(x,-20,14,40);
      ctx.fillStyle='#d9ad66';ctx.fillRect(x+3,-15,8,3);ctx.fillRect(x+3,12,8,3);
    }
    for(const side of [-1,1]) {
      polygon(ctx,[[-103,side*49],[-80,side*76],[56,side*72],[72,side*49]],'#645145','#a17b54');
      ctx.fillStyle='#202531';ctx.fillRect(-116,side*60-9,66,18);
      ctx.fillStyle='#a78361';ctx.fillRect(-126,side*60-6,69,12);
      ctx.fillStyle='#ffce8b';ctx.fillRect(-130,side*60-4,9,8);
      circle(ctx,37,side*49,8,'#1a1e27');circle(ctx,37,side*49,4,'#dc9d65');
    }
    ctx.fillStyle='#1b2029';ctx.fillRect(84,-23,23,46);
    for(let i=0;i<5;i++){ctx.fillStyle=i%2?'#df9f5c':'#523e31';ctx.fillRect(93,-17+i*8,17,3);}
    polygon(ctx,[[-91,-8],[-62,-14],[-58,0],[-62,14],[-91,8]],'#dfb989','#ffe6b5');
    ctx.strokeStyle='#382d28';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(48,-43);ctx.lineTo(48,43);ctx.stroke();
  }

  serpent(boss) {
    const ctx=this.ctx;
    glow(ctx,0,0,140,'rgba(55,214,165,.09)');
    // The tail curls behind the hittable armored head, away from the player.
    for(let i=5;i>=1;i--) {
      const x=20+i*19,y=Math.sin(this.time*2.8-i*.72)*25;
      const r=28-i*2.4;
      ctx.save();ctx.translate(x,y);ctx.rotate(Math.sin(this.time*2.8-i*.72)*.2);
      polygon(ctx,[[-r,-r*.7],[0,-r],[r,r*-.5],[r*.9,r*.6],[0,r],[-r,r*.6]],'#173c36','#4f9b80',1.2);
      circle(ctx,1,0,r*.52,'#0d2829');circle(ctx,-2,-3,r*.24,'#77d5ad');
      ctx.restore();
    }
    polygon(ctx,[[-76,0],[-53,-36],[-14,-49],[26,-30],[43,0],[26,30],[-14,49],[-53,36]],'#205348','#75b692',2);
    polygon(ctx,[[-68,-4],[-34,-21],[-5,-16],[-21,-1],[-8,18],[-36,25]],'#3b826b','#9cdbc0');
    for(const side of [-1,1]) {
      polygon(ctx,[[-8,side*39],[15,side*72],[28,side*73],[23,side*20]],'#3a725f','#92c8a4');
      circle(ctx,-39,side*12,5,'#c1ffe2');
    }
    circle(ctx,-22,0,13,'#0c2625');glow(ctx,-24,0,28,'rgba(81,235,175,.18)');
    circle(ctx,-25,0,8,boss.phase===3?'#f2ed9c':'#95f5c8');
    polygon(ctx,[[-63,-3],[-84,-8],[-79,4],[-61,7]],'#91c0a0');
  }

  forge(boss) {
    const ctx=this.ctx;
    glow(ctx,-4,0,155,'rgba(255,126,38,.13)');
    polygon(ctx,[[-54,-96],[32,-99],[65,-69],[66,69],[32,99],[-54,96],[-86,50],[-86,-50]],'#3b2926','#94674e',2);
    for(const side of [-1,1]) {
      polygon(ctx,[[-64,side*43],[-99,side*65],[-81,side*100],[-30,side*108],[-10,side*78]],'#79513a','#bb8352');
      ctx.fillStyle='#211a1e';ctx.fillRect(-77,side*72-9,40,18);
      for(let i=0;i<4;i++){ctx.fillStyle='#e3a15c';ctx.fillRect(-73+i*9,side*72-6,3,12);}
      polygon(ctx,[[46,side*43],[81,side*63],[96,side*22],[59,side*12]],'#614332','#a5774f');
    }
    circle(ctx,-13,0,60,'#171a22');
    ctx.strokeStyle='#a87954';ctx.lineWidth=9;ctx.beginPath();ctx.arc(-13,0,60,0,TAU);ctx.stroke();
    const reactor=ctx.createRadialGradient(-23,-12,3,-13,0,45);
    reactor.addColorStop(0,'#fff8c0');reactor.addColorStop(.3,'#ffb74e');reactor.addColorStop(1,'#913a1e');
    circle(ctx,-13,0,45,reactor);
    for(let i=0;i<5;i++) {
      ctx.save();ctx.translate(-13,0);ctx.rotate(i*TAU/5+this.time*.12);
      polygon(ctx,[[29,-9],[70,-14],[75,0],[63,10],[29,9]],'#56372e','#d09a62');ctx.restore();
    }
    ctx.fillStyle='#261d22';ctx.fillRect(-108,-13,62,26);
    ctx.fillStyle=boss.telegraph?'#ffe6a0':'#b46c38';ctx.fillRect(-112,-8,14,16);
    if(boss.telegraph)glow(ctx,-112,0,45,'rgba(255,197,82,.35)');
    ctx.fillStyle='#171a23';ctx.fillRect(58,-47,25,94);
    for(let i=0;i<8;i++){ctx.fillStyle=i%2?'#b06330':'#4d3025';ctx.fillRect(64,-39+i*11,22,4);}
  }

  prism() {
    const ctx=this.ctx;
    glow(ctx,0,0,135,'rgba(144,104,239,.12)');
    for(let i=0;i<5;i++) {
      const angle=i*TAU/5+this.time*.3,x=Math.cos(angle)*83,y=Math.sin(angle)*83;
      ctx.save();ctx.translate(x,y);ctx.rotate(angle);
      polygon(ctx,[[0,-17],[12,0],[0,21],[-11,0]],'#544378','#b09cdd');
      polygon(ctx,[[0,-17],[0,21],[-11,0]],'#32284f');ctx.restore();
    }
    ctx.save();ctx.rotate(Math.sin(this.time*.9)*.09);
    polygon(ctx,[[-69,0],[9,-72],[60,-31],[49,48],[1,75]],'#382650','#b5a1de',2);
    polygon(ctx,[[-69,0],[9,-72],[3,-6]],'#7e66a3','#b3a4da');
    polygon(ctx,[[9,-72],[60,-31],[3,-6]],'#b19bd0');
    polygon(ctx,[[60,-31],[49,48],[3,-6]],'#655082');
    polygon(ctx,[[49,48],[1,75],[3,-6]],'#44305e');
    polygon(ctx,[[1,75],[-69,0],[3,-6]],'#624978');
    glow(ctx,-5,0,45,'rgba(180,143,246,.25)');
    polygon(ctx,[[-26,0],[-3,-22],[19,0],[-3,25]],'#f3dcff','#fff2ff');
    ctx.restore();
    ctx.strokeStyle='rgba(173,148,217,.3)';ctx.lineWidth=1;
    ctx.beginPath();ctx.ellipse(0,0,95,87,this.time*.1,0,TAU);ctx.stroke();
  }

  overlord(boss) {
    const ctx=this.ctx;
    glow(ctx,0,0,180,'rgba(218,58,94,.13)');
    polygon(ctx,[[-45,-76],[2,-103],[59,-71],[92,-26],[78,0],[92,26],[59,71],[2,103],[-45,76],[-80,24],[-80,-24]],'#321b31','#a45b78',2);
    for(const side of [-1,1]) {
      polygon(ctx,[[-27,side*67],[-56,side*105],[-17,side*129],[25,side*103],[54,side*70],[11,side*50]],'#4b2943','#bb7389');
      polygon(ctx,[[23,side*79],[71,side*111],[86,side*85],[70,side*40]],'#39213a','#80516f');
      ctx.fillStyle='#211a2c';ctx.fillRect(-79,side*64-9,63,18);
      ctx.fillStyle='#bb637d';ctx.fillRect(-96,side*64-5,56,10);
      circle(ctx,-97,side*64,5,'#ffb7b2');
      circle(ctx,40,side*47,7,'#1b1526');circle(ctx,40,side*47,3,'#ec8b9c');
    }
    circle(ctx,-15,0,55,'#100e1d');
    for(let i=0;i<10;i++) {
      const angle=i*TAU/10+this.time*.1;
      ctx.save();ctx.translate(-15,0);ctx.rotate(angle);
      polygon(ctx,[[42,-8],[72,-11],[80,0],[64,11],[42,8]],'#793c5b','#bc6c87');ctx.restore();
    }
    glow(ctx,-15,0,70,'rgba(249,84,131,.21)');
    const core=ctx.createRadialGradient(-24,-11,3,-15,0,35);
    core.addColorStop(0,'#fff2df');core.addColorStop(.4,'#f69ca1');core.addColorStop(1,'#982b63');
    circle(ctx,-15,0,35,core);
    ctx.strokeStyle='#f1a5b4';ctx.lineWidth=2;ctx.beginPath();ctx.arc(-15,0,43,this.time*.5,this.time*.5+Math.PI*1.6);ctx.stroke();
    ctx.fillStyle='#151421';ctx.fillRect(74,-30,19,60);
    for(let i=0;i<7;i++){ctx.fillStyle=i%2?'#a73e66':'#47233d';ctx.fillRect(83,-25+i*8,18,3);}
    if(boss.phase===3) {
      ctx.strokeStyle='rgba(255,119,159,.5)';ctx.lineWidth=1;
      ctx.beginPath();ctx.arc(-15,0,85,0,TAU);ctx.stroke();
    }
  }

  sentinel(boss) {
    const ctx=this.ctx;
    ctx.save();ctx.translate(boss.x,boss.y);
    ctx.scale((boss.radius || 86)/86,(boss.radius || 86)/86);
    glow(ctx,-4,0,145,'rgba(211,88,60,.09)');
    // Armored wings, exposed machinery, and a vulnerable reactor core.
    polygon(ctx,[[-25,-53],[-53,-87],[-37,-113],[9,-109],[30,-78],[59,-62],[71,-22],[101,-7],[97,20],[67,34],[52,77],[18,100],[-26,110],[-49,86],[-28,52],[-51,20],[-52,-18]],'#302c35','#75515a',2);
    polygon(ctx,[[-47,-87],[-31,-103],[9,-99],[23,-77],[4,-63],[-25,-64]],'#69444b','#a26d69');
    polygon(ctx,[[-27,65],[7,61],[34,78],[12,94],[-23,101],[-40,84]],'#64414a','#a26d69');
    polygon(ctx,[[31,-58],[57,-48],[66,-19],[48,-6],[21,-14]],'#59404a','#8b5b60');
    polygon(ctx,[[45,13],[67,26],[49,63],[26,66],[17,42]],'#503b46','#8b5b60');
    for (const side of [-1,1]) {
      ctx.fillStyle='#222531';ctx.fillRect(-51,side*72-9,48,18);
      ctx.fillStyle='#ad7268';ctx.fillRect(-58,side*72-6,44,12);
      ctx.fillStyle='#e09b78';ctx.fillRect(-60,side*72-4,7,8);
      for(let i=0;i<3;i++){ctx.fillStyle='#34313b';ctx.fillRect(-7+i*7,side*85-3,3,7);}
      circle(ctx,13,side*47,6,'#171e2c');circle(ctx,13,side*47,2,'#d88862');
    }
    ctx.fillStyle='#171f2c';ctx.fillRect(62,-22,34,43);
    for(let i=0;i<5;i++){ctx.fillStyle=i%2?'#b9614d':'#4d3640';ctx.fillRect(74,-18+i*8,16,3);}
    circle(ctx,-9,0,42,'#141d2a');
    ctx.beginPath();ctx.arc(-9,0,43,.25,TAU-.25);ctx.lineWidth=5;ctx.strokeStyle='#92716a';ctx.stroke();
    ctx.beginPath();ctx.arc(-9,0,35,this.time*.3,this.time*.3+4.8);ctx.lineWidth=2;ctx.strokeStyle='#ae6f60';ctx.stroke();
    const pulse=.7+Math.sin(this.time*6)*.18;
    glow(ctx,-12,0,58,`rgba(254,111,65,${pulse*.27})`);
    const core=ctx.createRadialGradient(-17,-5,2,-10,0,27);
    core.addColorStop(0,'#ffedc0');core.addColorStop(.3,'#f4a36c');core.addColorStop(.75,'#9a4d45');core.addColorStop(1,'#371f2d');
    circle(ctx,-10,0,27,core);
    ctx.strokeStyle='#e0a27c';ctx.lineWidth=1;ctx.beginPath();ctx.arc(-10,0,21,-1.8,1.5);ctx.stroke();
    for(let i=0;i<8;i++) {
      const angle=i*TAU/8+this.time*.1;
      const x=-9+Math.cos(angle)*48,y=Math.sin(angle)*48;
      ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.fillStyle='#6a4e53';ctx.fillRect(-4,-3,8,6);ctx.restore();
    }
    ctx.restore();
  }

  projectile(bullet, hostile=false) {
    const ctx=this.ctx;
    ctx.save();ctx.translate(bullet.x,bullet.y);
    const radius=bullet.radius || 4;
    if(hostile) {
      if(bullet.kind==='ricochet') {
        ctx.rotate(Math.atan2(bullet.vy||0,bullet.vx||-1));
        glow(ctx,0,0,radius*3,'rgba(183,133,255,.2)');
        polygon(ctx,[[-radius-2,0],[0,-radius],[radius+3,0],[0,radius]],'#b69ce8','#e5ceff');
        circle(ctx,0,0,radius*.35,'#fff1ff');
      } else {
        glow(ctx,0,0,radius*3,'rgba(255,112,78,.15)');
        circle(ctx,0,0,radius+1,'#bd5748');circle(ctx,0,0,radius*.65,'#ffbb83');circle(ctx,-1,-1,radius*.25,'#ffe8b9');
      }
    } else if(bullet.charged) {
      const angle=Math.atan2(bullet.vy||0,bullet.vx||1);ctx.rotate(angle);
      const length=44+radius*2;
      glow(ctx,0,0,radius*2,'rgba(95,228,242,.25)');
      polygon(ctx,[[-length,0],[-8,-radius*.65],[8,-radius],[radius*1.7,0],[8,radius],[-8,radius*.65]],'rgba(65,184,211,.3)');
      ctx.beginPath();ctx.ellipse(0,0,radius*1.7,radius,0,0,TAU);ctx.fillStyle='#82e6ef';ctx.fill();
      ctx.beginPath();ctx.ellipse(3,0,radius*1.1,radius*.48,0,0,TAU);ctx.fillStyle='#e6ffff';ctx.fill();
    } else if(bullet.kind==='laser') {
      ctx.rotate(Math.atan2(bullet.vy||0,bullet.vx||1));
      ctx.fillStyle='rgba(248,107,179,.15)';ctx.fillRect(-63,-9,81,18);
      ctx.fillStyle='#fa8bbc';ctx.fillRect(-56,-4,75,8);
      ctx.fillStyle='#fff1fa';ctx.fillRect(-49,-1.5,69,3);
      circle(ctx,20,0,4,'#fff1fa');
    } else if(bullet.kind==='homing') {
      ctx.rotate(Math.atan2(bullet.vy||0,bullet.vx||1));
      polygon(ctx,[[-15,-3],[6,-5],[15,0],[6,5],[-15,3]],'#9ed8ff','#daf3ff');
      polygon(ctx,[[-10,-3],[-18,-8],[-18,8],[-10,3]],'#5c89a7');
      polygon(ctx,[[-17,-3],[-31,0],[-17,3]],'#8edaf4');
      circle(ctx,5,0,2,'#f4ffff');
    } else {
      ctx.rotate(Math.atan2(bullet.vy||0,bullet.vx||1));
      const spread=bullet.kind==='spread';
      ctx.fillStyle=spread?'rgba(249,203,108,.14)':'rgba(102,211,225,.13)';ctx.fillRect(-21,-4,30,8);
      ctx.fillStyle=spread?'#ffd27a':'#5cc9da';ctx.fillRect(-16,-2,25,4);
      ctx.fillStyle=spread?'#fff7d2':'#d2faff';ctx.fillRect(-5,-1,15,2);
    }
    ctx.restore();
  }

  pickup(item) {
    const ctx=this.ctx;
    const y=item.y+Math.sin(this.time*4+(item.age||0))*3;
    const power=POWERS[item.type] || POWERS.weapon;
    const color=power.color;
    ctx.save();ctx.translate(item.x,y);ctx.rotate(Math.PI/4);
    ctx.globalAlpha=.12;glow(ctx,0,0,30,color);ctx.globalAlpha=1;
    ctx.fillStyle='#12212a';ctx.fillRect(-11,-11,22,22);ctx.strokeStyle=color;ctx.lineWidth=1;ctx.strokeRect(-11,-11,22,22);
    ctx.rotate(-Math.PI/4);ctx.fillStyle=color;
    if(item.type==='repair'){ctx.fillRect(-2,-7,4,14);ctx.fillRect(-7,-2,14,4);}
    else if(item.type==='weapon'){polygon(ctx,[[-4,-8],[4,-8],[1,-1],[6,-1],[-4,9],[-1,2],[-6,2]],color);}
    else {ctx.font='bold 14px monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(power.symbol,0,1);}
    ctx.restore();
  }

  telegraph(boss) {
    const warning=boss?.telegraph;
    if(!warning || !Number.isFinite(warning.y))return;
    const ctx=this.ctx;
    const end=Math.max(0,Math.min(1200,boss.x-50));
    const readiness=1-Math.min(1,Math.max(0,warning.time)/.85);
    ctx.save();
    ctx.fillStyle=`rgba(255,143,73,${.055+readiness*.085})`;ctx.fillRect(0,warning.y-40,end,80);
    ctx.strokeStyle='#ffb97a';ctx.lineWidth=1;ctx.setLineDash([12,8]);
    for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(0,warning.y+side*40);ctx.lineTo(end,warning.y+side*40);ctx.stroke();}
    ctx.setLineDash([]);
    ctx.strokeStyle=`rgba(255,184,107,${.25+readiness*.6})`;ctx.beginPath();ctx.moveTo(0,warning.y);ctx.lineTo(end,warning.y);ctx.stroke();
    for(let x=30;x<end;x+=180)polygon(ctx,[[x-4,warning.y-8],[x+6,warning.y],[x-4,warning.y+8]],'#ffd0a1');
    ctx.restore();
  }

  bomb(game) {
    const pulse=Math.min(1,Math.max(0,game.bombPulse||0));
    if(pulse>(this.lastBombPulse||0))this.bombOrigin={x:game.player.x,y:game.player.y};
    this.lastBombPulse=pulse;
    if(!pulse)return;
    const ctx=this.ctx;
    const origin=this.bombOrigin||game.player;
    const radius=40+(1-pulse)*1250;
    ctx.save();ctx.globalAlpha=pulse;
    ctx.strokeStyle='#c9bbff';ctx.lineWidth=4+pulse*5;
    ctx.beginPath();ctx.arc(origin.x,origin.y,radius,0,TAU);ctx.stroke();
    ctx.strokeStyle='rgba(188,201,255,.3)';ctx.lineWidth=15;
    ctx.beginPath();ctx.arc(origin.x,origin.y,radius*.96,0,TAU);ctx.stroke();
    ctx.fillStyle=`rgba(164,153,245,${pulse*.12})`;ctx.fillRect(0,0,1200,600);ctx.restore();
  }

  render(game, dt=1/60) {
    const elapsed = Math.min(Math.max(dt || 0, 0), .05);
    if (game.state !== 'paused') {
      this.time += elapsed;
      this.scrollTime += elapsed * (game.state === 'playing' ? 1 : .35);
    }
    const ctx=this.ctx;
    ctx.setTransform(this.canvas.width/1200,0,0,this.canvas.height/600,0,0);
    ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
    this.background(game);
    this.telegraph(game.boss);
    ctx.save();
    if(game.shake>0 && game.state==='playing') {
      const amount=Math.min(game.shake,6);
      ctx.translate(Math.sin(this.time*127)*amount,Math.cos(this.time*93)*amount);
    }
    for(const item of game.pickups || [])this.pickup(item);
    for(const enemy of game.enemies || [])this.enemy(enemy);
    if(game.boss)this.boss(game.boss);
    for(const bullet of game.bullets || [])this.projectile(bullet);
    for(const bullet of game.enemyBullets || [])this.projectile(bullet,true);
    this.ship(game.player,game.state);
    for(const particle of game.particles || []) {
      const alpha=Math.max(0,Math.min(1,particle.life/(particle.maxLife||1)));
      ctx.globalAlpha=alpha;ctx.fillStyle=particle.color||'#f6bb7d';
      const size=(particle.size||2)*(.35+alpha*.65);
      ctx.fillRect(particle.x-size/2,particle.y-size/2,size,size);
    }
    ctx.globalAlpha=1;
    ctx.restore();
    this.bomb(game);
    if(game.flash>0){ctx.fillStyle=`rgba(220,243,245,${Math.min(game.flash*.2,.18)})`;ctx.fillRect(0,0,1200,600);}
    ctx.fillStyle=this.vignette;ctx.fillRect(0,0,1200,600);
  }
}
