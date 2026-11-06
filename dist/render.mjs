const TAU = Math.PI * 2;

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
    this.backdrop = makeCanvas();
    this.paintBackdrop(this.backdrop.getContext('2d'));
  }

  paintBackdrop(ctx) {
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

  background(game) {
    const ctx = this.ctx;
    ctx.drawImage(this.backdrop, 0, 0);
    const drift = this.scrollTime;
    for (const star of this.stars) {
      const x = ((star.x - drift * (8 + star.z * 34)) % 1200 + 1200) % 1200;
      const alpha = .22 + star.z * .5 + Math.sin(this.time * .8 + star.phase) * .09;
      ctx.fillStyle = `rgba(173,212,223,${alpha})`;
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
      polygon(ctx, [[-debris.size,0],[-debris.size*.6,-15],[debris.size*.3,-21],[debris.size,0],[debris.size*.7,14],[-debris.size*.5,20]], '#0b1822', '#172a35');
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
      glow(ctx,0,0,radius*3,'rgba(255,112,78,.15)');
      circle(ctx,0,0,radius+1,'#bd5748');circle(ctx,0,0,radius*.65,'#ffbb83');circle(ctx,-1,-1,radius*.25,'#ffe8b9');
    } else if(bullet.charged) {
      const angle=Math.atan2(bullet.vy||0,bullet.vx||1);ctx.rotate(angle);
      const length=44+radius*2;
      glow(ctx,0,0,radius*2,'rgba(95,228,242,.25)');
      polygon(ctx,[[-length,0],[-8,-radius*.65],[8,-radius],[radius*1.7,0],[8,radius],[-8,radius*.65]],'rgba(65,184,211,.3)');
      ctx.beginPath();ctx.ellipse(0,0,radius*1.7,radius,0,0,TAU);ctx.fillStyle='#82e6ef';ctx.fill();
      ctx.beginPath();ctx.ellipse(3,0,radius*1.1,radius*.48,0,0,TAU);ctx.fillStyle='#e6ffff';ctx.fill();
    } else {
      ctx.rotate(Math.atan2(bullet.vy||0,bullet.vx||1));
      ctx.fillStyle='rgba(102,211,225,.13)';ctx.fillRect(-21,-4,30,8);
      ctx.fillStyle='#5cc9da';ctx.fillRect(-16,-2,25,4);
      ctx.fillStyle='#d2faff';ctx.fillRect(-5,-1,15,2);
    }
    ctx.restore();
  }

  pickup(item) {
    const ctx=this.ctx;
    const y=item.y+Math.sin(this.time*4+(item.age||0))*3;
    const color=item.type==='repair'?'#98dbb0':'#e9bc75';
    ctx.save();ctx.translate(item.x,y);ctx.rotate(Math.PI/4);
    glow(ctx,0,0,30,item.type==='repair'?'rgba(100,221,166,.1)':'rgba(240,182,93,.1)');
    ctx.fillStyle='#12212a';ctx.fillRect(-11,-11,22,22);ctx.strokeStyle=color;ctx.lineWidth=1;ctx.strokeRect(-11,-11,22,22);
    ctx.rotate(-Math.PI/4);ctx.fillStyle=color;
    if(item.type==='repair'){ctx.fillRect(-2,-7,4,14);ctx.fillRect(-7,-2,14,4);}
    else {polygon(ctx,[[-4,-8],[4,-8],[1,-1],[6,-1],[-4,9],[-1,2],[-6,2]],color);}
    ctx.restore();
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
    if(game.flash>0){ctx.fillStyle=`rgba(220,243,245,${Math.min(game.flash*.2,.18)})`;ctx.fillRect(0,0,1200,600);}
    const vignette=ctx.createRadialGradient(580,260,160,600,300,710);
    vignette.addColorStop(0,'transparent');vignette.addColorStop(1,'rgba(0,4,10,.42)');
    ctx.fillStyle=vignette;ctx.fillRect(0,0,1200,600);
  }
}
