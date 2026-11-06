# R-Type: Nebula

Arcade espacial inspirado nos jogos de tiro lateral. Arte original em Canvas 2D, efeitos sonoros sintetizados e interface em português. Não precisa instalar dependências.

## Jogar

Com Node.js 18 ou superior, execute nesta pasta:

```sh
npm start
```

Abra **http://localhost:4173**. Também é possível hospedar os arquivos da pasta `dist` em qualquer servidor estático.

## Controles

| Ação | Tecla |
| --- | --- |
| Mover | WASD ou setas |
| Disparar continuamente | Segurar Espaço ou Z |
| Carregar canhão | Segurar X e soltar |
| Pausar ou retomar | P ou Esc |
| Iniciar, retomar ou jogar novamente | Enter |
| Reiniciar em pausa ou ao terminar | R |

No celular, use o direcional e os botões de tiro na tela. O modo paisagem oferece mais espaço.

Atravesse três setores de 22 segundos e derrote o guardião de Órion. Colete os módulos de melhoria de arma e de reparo. O recorde e a preferência de som são salvos localmente; o jogo funciona mesmo quando o navegador bloqueia armazenamento.

## Verificar

```sh
npm test
```

Os testes cobrem as regras da partida e as respostas HTTP do servidor local. Para testar a interface em Chrome ou Edge, mantenha `npm start` aberto e, em outro terminal com Node.js 22 ou superior, execute:

```sh
npm run test:browser
```

O teste usa um navegador em modo invisível e grava os resultados e capturas em `artifacts/`. Se o navegador não estiver em um caminho padrão, informe o executável na variável `CHROME_PATH`.

O motor (`dist/game.mjs`), o renderizador (`dist/render.mjs`) e a interface (`dist/app.mjs`) são módulos separados. Os arquivos prontos para publicação estão em `dist`.
