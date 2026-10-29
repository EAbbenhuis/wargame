# Logboek

## 2026-10-29: Wargame-basis gebouwd (Claude Code-sessie, prompt 01)

### 1. Wat eruit kwam, per onderdeel

- **Repo-opzet.** npm-workspaces met `engine`, `web` en `server`; TypeScript 5.9 strict; ESLint met architectuurregels; Prettier; Vitest; GitHub Actions (check + e2e). Eerste commit op `main`, daarna alles op `task/wargame-basis`.
- **Kaart.** Hexraster van 20×14, puntige hexen, eigen hex-wiskunde (getest vóór de rest). Zes terreinsoorten: open, bos, stad, rivier, heuvel, brug. Fictief land (Blauwland/Roodland, rivier de Grensstroom). Fictieve plaatsen: Brakhoven, Hoge Lindert, Merelbos, Noorderbrug, Kruisweide, Ostervaal, Uitkijkheuvel, Grensbrug.
- **Eenheden.**
  - Blauw: 9 eenheden (3 infanterie, 3 pantser, artillerie, verkenning, logistiek).
  - Rood: 7 eenheden (3 infanterie, 1 pantser, artillerie, verkenning, logistiek).
  - NAVO-achtige SVG-symbolen (blauwe rechthoek, rode ruit), met het symbool zelf uit de data.
- **Beweging en gevecht.**
  - Bewegingspunten per type en terreinkosten per bewegingsklasse.
  - Wie naast een vijand komt, stopt.
  - Gevecht via een gevechtstabel (5 kolommen, d6) met modifiers: terrein, ingegraven, flank, aanval vanuit de rivier.
  - Artillerie vuurt vóór de beweging.
  - Terugtrekken, vernietiging, herstel naast logistiek.
- **Beurtstructuur.** Gelijktijdig (WEGO), zoals Ebbe in fase 0 koos. Fasen: vuur → beweging per tik → gevecht → herstel → doelen → einde.
- **Fog of war.** Zichtafstand per type; zichtlijnen die door bos, stad en heuvel geblokkeerd worden; vanaf een heuvel kijk je eroverheen. Herinnering aan eerder geziene vijanden. Het beurtverslag toont alleen wat je kon waarnemen.
- **Doelen en einde.** Drie doelen met waarde. Na 12 beurten (of als een kant geen eenheden meer heeft) volgen punten en een uitslag (winst, verlies of onbeslist).
- **AI-tegenstander.** Utility-AI in de engine; deterministisch; ziet alleen het eigen spelersbeeld; houdingen evenwichtig, aanvallend en verdedigend (in `data/postures.ts`).
- **AI-staf.**
  - `scripted` (standaard): 8 commando's, waaronder "plan voor doel X", "zwakste plek", "aanvalskansen", "verdedigen", "verkennen", "dreiging" en "situatie".
  - `openrouter`: de prompt wordt in de engine uit het spelersbeeld gebouwd; de server geeft hem door.
  - In beide modi gaan voorstellen als intenties door de validatie van de engine. De speler bevestigt, en ongeldige voorstellen worden met reden getoond.
- **After-action report.** Uit de spelgeschiedenis: kantelpunten, tijdlijn per beurt, verliezen en lessen.
- **Debugmenu** (alleen in development): scenario laden met een seed, naar een beurt springen (de computer speelt blauw), fog of war uit, acties kopiëren. Naspelen kan ook met `?seed=`.
- **Aanpasbaarheid.**
  - Data in `packages/engine/src/data/`, met een uitleg bovenaan elk uitbreidingspunt.
  - Test die bewijst dat een nieuw eenheidstype via alleen `data/` werkt.
  - Test die bewijst dat geen code buiten `data/` een eenheidstype of terrein bij naam noemt.
  - `docs/modding.md` met 10 opdrachten; `CLAUDE.md` voor toekomstige sessies.
- **Snelle cyclus.**
  - Vite hot reload; Vitest voor regels (alle 125 tests in ongeveer 3 s).
  - Scripted staf, dus nooit wachten op een taalmodel.
  - Plekken waar de cyclus langer werd, en wat eraan gedaan is:
    - Een volledig computerspel duurde eerst ongeveer 1 s, door het kopiëren van de hele toestand en een Dijkstra-zoektocht per hex. Na optimalisatie is dat ongeveer 150 ms.
    - De Playwright-test duurt ongeveer 12 s, inclusief een build. Die hoort niet bij de gewone cyclus.

### 2. Bijgestuurd ten opzichte van de opdracht, en waarom

- **Gelijktijdige beurten in plaats van mijn aanbeveling om-en-om.** Keuze van Ebbe; de complexiteit zit in één bestand met tests.
- **Omvang van de krachten: 9 tegen 7.** Niet exact gelijk, maar nodig voor de balans. Een aanvaller over een rivier heeft overmacht nodig.
- **TypeScript 5.9 in plaats van 6/7.** typescript-eslint ondersteunt nog geen nieuwere versie.
- **Playwright 1.63** is vastgezet op de versie van de voorgeïnstalleerde browser.
- **concurrently 9.2.5 in plaats van 9.2.1**, vanwege een kritiek beveiligingslek.
- **PR via de REST-API.** GraphQL (`gh pr create`) is geblokkeerd in deze omgeving.
- **Werkmap.** De repo is gekloond naar `/home/user/wargame` in een cloudsessie, niet in een lokale map. De fetch-instelling van de lege clone is aangepast, zodat subagents een worktree konden maken.
- **Extra's binnen de opdracht.**
  - `scripts/balance.ts` (balans meten).
  - Terrein "brug".
  - Overwinning gedeeltelijk op verliezen gebaseerd (0,2 punt per sterktepunt), zoals gevraagd: "op basis van bezette doelen en verliezen".
- **Rivier hernoemd.** De rivier heette eerst "de Vaal", maar dat is een echte rivier. Nu heet hij "de Grensstroom".
- **Vervolg op de onafhankelijke review.** Drie fouten hersteld (zie punt 5) en de tests versterkt. Daardoor verschoof de balans; de tweede rode tankcompagnie is vervangen door infanterie.

### 3. Resultaten met getallen

- **Tests:** 125, allemaal groen, in 17 testbestanden: engine 114, web 5, server 6. Duur van `npm test`: 2,6 tot 3,1 s (Vitest meldt 2,6 s).
- **Playwright (e2e):** 1 test, groen. Een volledig spel van 12 beurten duurt ongeveer 6 s in de browser, ongeveer 12 s inclusief build.
- **Build:** `npm run build` duurt 1,1 tot 1,2 s. JavaScript-bundel 264 kB (85 kB gzip).
- **Overige controles:** typecheck 8,5 s en lint 7,5 s, gemeten terwijl er tegelijk agents draaiden.
- **Verse clone zonder `.env`:** `npm install` (6 s), `npm test`, `build`, `typecheck`, `lint` en de dev-server (HTTP 200) slaagden.
- **Balans** (computer tegen computer, 40 seeds, blauw "evenwichtig"):

  | Rood        | Blauw wint | Rood wint | Onbeslist |
  | ----------- | ---------- | --------- | --------- |
  | Evenwichtig | 18         | 19        | 3         |
  | Aanvallend  | 17         | 9         | 14        |
  | Verdedigend | 1          | 39        | 0         |

- **Modding-proef 1, opdracht 4 "moeras"** (branch `proef/modding-moeras`, commit 13d0102). Uitgevoerd door een subagent als "verse sessie".
  - Geslaagd: alle controles groen, 113 tests.
  - Tijd: 1,2 min van start tot groen, 3,4 min inclusief afwerking. De gids schat 8 min voor een mens.
  - 8 bestanden geraakt. Voorspeld waren `terrains.ts`, het scenario en `HexMap.tsx`; extra geraakt werden `types.ts` (patroonnaam) en twee teksten die de rivierregel letterlijk noemden.
  - Verbeteringen die hieruit volgden:
    - de terreinregels voor het taalmodel komen nu uit de data;
    - de docs leggen nu uit hoe je kolom en rij vindt en hoe je een terreinpatroon toevoegt;
    - het lock-bestand is gelijkgetrokken.
- **Modding-proef 2, opdracht 10 "drones"** (branch `proef/modding-drones`, commit 41c13ef). Ook door een subagent.
  - Geslaagd: alle controles groen, 119 tests en e2e.
  - Tijd: 6,7 min tot groen, inclusief twee rebases. De gids schat 20 min voor een mens.
  - Ontwerp: nieuwe optionele eigenschappen `altitude` (zicht over alles) en `holdsObjectives` (neemt geen doel in), plus bewegingsklasse `air`.
  - Problemen die de proef blootlegde:
    - de voorbeeld-drone in `extensibility.test.ts` had dezelfde id `'drone'`; nu `'test-drone'`;
    - de test "6 tot 9 eenheden" blokkeert een tiende blauwe eenheid; nu uitgelegd in CLAUDE.md;
    - de balans verschoof sterk (blauw van 25 naar 6 van de 40 winsten, op de oude balans), omdat de computer de drone als zwakke gevechtseenheid inzet.
  - De branch is niet gemerged en zit op een basis van vóór de review-reparaties.
- **CI.** Groen op elke push naar de PR. Laatste volledige run op de code (`c20e443`): https://github.com/EAbbenhuis/wargame/actions/runs/40904463276 (check 24 s, e2e 35 s).

### 4. Waar het staat

- **Branch:** `task/wargame-basis`. PR: https://github.com/EAbbenhuis/wargame/pull/1 (staat open, niet gemerged).
- **Belangrijkste commits:**
  - `e06afe9` repo-opzet (main);
  - `91ed4b6` hex-raster;
  - `2f573db` engine;
  - `9a76e17` AI-tegenstander;
  - `231a232` staf in de engine;
  - `99dc04c` web-interface;
  - `541dae4` staf-server;
  - `bce2233` Playwright;
  - `e140322` uitbreidbaarheidsbewijs;
  - `d452141` reparaties na review en balans;
  - `8112a04` rivier hernoemd.
- **Modding-proeven:** branches `proef/modding-moeras` en `proef/modding-drones`.

### 5. Wat niet gelukt is of niet geverifieerd kon worden

- **OpenRouter-modus niet getest tegen het echte model.** Er was geen sleutel, en openrouter.ai was vanuit deze cloudomgeving niet bereikbaar (de netwerkregels weigerden de verbinding). Wel getest:
  - de server met een nagebootste `fetch` (6 unit-tests: sleutel, model, fouten, limiet, geen lekken);
  - de hele keten browser → server → nep-model → validatie, handmatig met een lokale nep-OpenRouter. Een onmogelijk voorstel werd met reden geweigerd.

  Onbekend is dus of `anthropic/claude-haiku-4.5` goed JSON teruggeeft met deze prompt (er is een terugval naar gewone tekst), en hoe goed de adviezen zijn. Model-id en prijs zijn via een zoekmachine gevonden, niet op openrouter.ai zelf gecontroleerd.

- **Balans en speelduur niet met mensen gemeten.**
  - Alle balansgetallen zijn computer tegen computer.
  - "Binnen 20 minuten uitgespeeld" is niet gemeten; 12 beurten met nadenken lijkt haalbaar, maar dat is een inschatting.
  - Tegen "verdedigend" wint de computer-blauw vrijwel nooit (1 van 40). Voor een mens is onbekend of dat te zwaar is.
- **Workshopsituatie onbekend** (vraag 2 uit fase 0 is open). Ingericht voor lokaal gebruik (`npm run dev`). In een cloudsessie zoals deze kan een deelnemer de Vite-server niet zelf in de browser openen.
- **Tijden in `docs/modding.md` zijn schattingen voor mensen.** Alleen opdrachten 4 en 10 zijn uitgeprobeerd, en dan door een AI-agent, die veel sneller is dan een leek. Opdrachten 1-3 en 5-9 zijn niet uitgevoerd.
- **Kleinere punten:**
  - Er is geen "gouden" eindtoestand vastgelegd, die verschillen tussen versies van de engine zou vangen. De determinismetests vergelijken twee spellen in hetzelfde proces.
  - "Spring naar beurt" in het debugmenu legt de gespeelde acties niet vast, dus daarna is "kopieer acties" niet meer volledig.
  - De limiet van de server is één teller voor iedereen, niet per gebruiker.
  - Alleen getest in Chromium op Linux (1366×768). Firefox, Safari, Windows en beamer-resolutie zijn niet getest.
  - Beweging wordt geanimeerd als rechte lijn, niet langs het pad.
  - Plaatsnamen zijn verzonnen, maar niet systematisch gecontroleerd tegen alle bestaande plaatsen ter wereld.
- **Het eerste subagent-plan liep vast.** Een worktree maken mislukte door de lege clone (geen `origin/main`). Na het aanpassen van de fetch-instelling lukte het; de proef-agents moesten twee keer rebasen omdat de basisbranch onder hen doorging.
