# R-Type — jogo local

Arcade espacial inspirado nos jogos de tiro lateral. Arte original em Canvas 2D, efeitos sonoros sintetizados e interface em português. Não precisa instalar dependências.

## Jogar no seu computador

Na pasta principal `rtype`, dê dois cliques em **iniciar-jogo.cmd**. Deixe a janela aberta e acesse **http://localhost:4173** no navegador. Para encerrar, pressione Ctrl+C nessa janela.

Também pode iniciar pelo terminal. Com Node.js 18 ou superior, execute nesta pasta:

```sh
npm start
```

Abra **http://localhost:4173**. O servidor aceita conexões apenas do próprio computador (`127.0.0.1`). Nenhuma conta do ChatGPT é necessária para jogar. Após reiniciar o computador, execute o arquivo novamente.

## Controles

| Ação | Tecla |
| --- | --- |
| Mover | WASD ou setas |
| Disparar continuamente | Segurar Espaço ou Z |
| Carregar canhão | Segurar X e soltar |
| Usar bomba Nova | C |
| Pausar ou retomar | P ou Esc |
| Iniciar, retomar, avançar de fase ou jogar novamente | Enter |
| Reiniciar em pausa ou ao terminar | R |

No celular, use o direcional e os botões de tiro na tela. O modo paisagem oferece mais espaço.

Atravesse seis fases. Cada fase tem ondas de inimigos, um cenário próprio e um chefe com ataques diferentes. Depois de vencer um chefe, leia a próxima missão e pressione Enter para continuar; você recupera um ponto do escudo e uma bomba, respeitando os limites. A campanha termina ao derrotar o sexto chefe.

| Fase | Chefe | Desafio |
| --- | --- | --- |
| Cinturão de Órion | Sentinela de Órion | Disparos em leque mirando a nave |
| Ruínas de Titã | Arca de Ferro | Dois canhões e drones de apoio |
| Oceano de Íon | Leviatã de Íon | Movimentos sinuosos e espirais |
| Forja Solar | Titã Solar | Ataques em faixas avisadas antes do disparo |
| Fenda Sombria | Prisma Espectral | Projéteis que ricocheteiam nas bordas |
| Núcleo do Vazio | Imperador do Vazio | Combinação de padrões e varreduras |

Colete os módulos deixados pelos inimigos:

| Módulo | Efeito |
| --- | --- |
| Melhoria | Aumenta permanentemente o nível do blaster, até III |
| Reparo | Recupera um ponto do escudo |
| Laser | Tiros que atravessam três alvos, por 16 segundos |
| Dispersão | Cinco tiros em leque, por 16 segundos |
| Mísseis guiados | Buscam os inimigos, por 16 segundos |
| Tiro rápido | Aumenta a cadência por 15 segundos |
| Barreira | Absorve dois impactos, por até 14 segundos |
| Bomba Nova | Repõe uma bomba; C limpa disparos inimigos e causa dano na tela. Máximo de três |

As armas temporárias substituem umas às outras. Tiro rápido e barreira podem ser combinados com qualquer arma. Os temporizadores congelam na pausa e no intervalo entre fases. O recorde e a preferência de som são salvos localmente; o jogo funciona mesmo quando o navegador bloqueia armazenamento.

## Verificar

```sh
npm test
```

Os testes cobrem as regras da partida e as respostas HTTP do servidor local. Para testar a interface em Chrome ou Edge, mantenha `npm start` aberto e, em outro terminal com Node.js 22 ou superior, execute:

```sh
npm run test:browser
```

O teste usa um navegador em modo invisível e grava os resultados e capturas em `artifacts/`. Se o navegador não estiver em um caminho padrão, informe o executável na variável `CHROME_PATH`.

O motor (`dist/game.mjs`), o renderizador (`dist/render.mjs`) e a interface (`dist/app.mjs`) são módulos separados. Os arquivos servidos localmente estão em `dist`. O projeto completo está na pasta `jogo` e suas alterações ficam apenas no computador do usuário.
