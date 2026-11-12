// Campaign data is shared by the simulation, artwork and interface.
export const STAGES = Object.freeze([
  { id: 'orion', name: 'CINTURÃO DE ÓRION', subtitle: 'O primeiro sinal', waveDuration: 28, theme: 'orion', color: '#8be0e4', boss: { type: 'sentinel', name: 'SENTINELA DE ÓRION', hp: 150, radius: 76 }, briefing: 'Desvie dos leques do Sentinela e encontre uma abertura no escudo.' },
  { id: 'titan', name: 'RUÍNAS DE TITÃ', subtitle: 'Frota perdida', waveDuration: 28, theme: 'titan', color: '#d7b18c', boss: { type: 'carrier', name: 'ARCA DE FERRO', hp: 200, radius: 95 }, briefing: 'A Arca envia drones e dispara de dois canhões. Não fique cercado.' },
  { id: 'ion', name: 'OCEANO DE ÍON', subtitle: 'Correntes elétricas', waveDuration: 30, theme: 'ion', color: '#7de4bb', boss: { type: 'serpent', name: 'LEVIATÃ DE ÍON', hp: 235, radius: 72 }, briefing: 'Acompanhe os movimentos do Leviatã e procure espaços entre as espirais.' },
  { id: 'solar', name: 'FORJA SOLAR', subtitle: 'Sob pressão', waveDuration: 30, theme: 'solar', color: '#ffad68', boss: { type: 'forge', name: 'TITÃ SOLAR', hp: 270, radius: 90 }, briefing: 'As faixas luminosas avisam onde o Titã vai disparar. Saia delas antes do ataque.' },
  { id: 'rift', name: 'FENDA SOMBRIA', subtitle: 'Nada segue em linha reta', waveDuration: 32, theme: 'rift', color: '#c5b1ff', boss: { type: 'prism', name: 'PRISMA ESPECTRAL', hp: 305, radius: 80 }, briefing: 'Os projéteis do Prisma ricocheteiam nas bordas. Observe a trajetória de volta.' },
  { id: 'core', name: 'NÚCLEO DO VAZIO', subtitle: 'A última transmissão', waveDuration: 32, theme: 'core', color: '#ff8a83', boss: { type: 'overlord', name: 'IMPERADOR DO VAZIO', hp: 360, radius: 100 }, briefing: 'O Imperador combina os ataques anteriores. Guarde uma bomba para abrir caminho.' },
]);

export const POWERS = Object.freeze({
  blaster: { name: 'BLASTER', symbol: '•', color: '#8be0e4', duration: 0, description: 'Arma principal. As melhorias aumentam a quantidade de tiros.' },
  weapon: { name: 'MELHORIA', symbol: '↑', color: '#e9bc75', duration: 0, description: 'Aumenta permanentemente o nível do blaster, até o nível III.' },
  repair: { name: 'REPARO', symbol: '+', color: '#98dbb0', duration: 0, description: 'Restaura um ponto do escudo.' },
  laser: { name: 'LASER', symbol: 'L', color: '#ff8bba', duration: 16, description: 'Tiros de alta energia que atravessam três alvos por 16 segundos.' },
  spread: { name: 'DISPERSÃO', symbol: 'D', color: '#ffd27a', duration: 16, description: 'Cinco tiros em leque cobrem uma área maior por 16 segundos.' },
  homing: { name: 'MÍSSEIS GUIADOS', symbol: 'M', color: '#9ed8ff', duration: 16, description: 'Projéteis que buscam inimigos automaticamente por 16 segundos.' },
  rapid: { name: 'TIRO RÁPIDO', symbol: 'R', color: '#f3f598', duration: 15, description: 'Acelera a cadência da arma por 15 segundos. Combina com outras armas.' },
  shield: { name: 'BARREIRA', symbol: 'S', color: '#8ff1e1', duration: 14, description: 'Absorve dois impactos sem perder vida, por até 14 segundos.' },
  bomb: { name: 'BOMBA NOVA', symbol: 'B', color: '#b6afff', duration: 0, description: 'Pressione C para limpar os tiros inimigos e causar dano em toda a tela. Máximo de três bombas.' },
});

export const POWER_DROP_CYCLE = Object.freeze(['weapon', 'laser', 'rapid', 'spread', 'shield', 'homing', 'bomb']);
