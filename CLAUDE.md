# CLAUDE.md: werkafspraken voor dit project

Dit bestand is voor Claude Code. Waarschijnlijk zit er iemand achter het toetsenbord die **niet kan programmeren** (bijvoorbeeld een generaal tijdens een workshop). Werk daarom zo:

- Leg in gewone taal uit wat je gaat doen en wat je gedaan hebt. Geen jargon zonder uitleg.
- Maak kleine, veilige stappen. Na elke stap: `npm test`, daarna laten zien in de browser.
- Vraag niet om toestemming voor dingen die je kunt terugdraaien; doe ze en meld het. Vraag wél bij grote ombouw of als de vraag onduidelijk is.
- Voeg geen grote features toe waar niet om gevraagd is. Goede ideeën die je onderweg tegenkomt, zet je in `docs/ideeen.md`.

## Wat is dit?

Een wargame in de browser (Nederlands). De speler voert een blauwe brigade aan tegen een rode AI-tegenstander op een hexkaart van een fictief land, en kan een AI-staf om advies vragen. Een spel duurt 12 beurten (ongeveer 20 minuten). **Beide kanten plannen tegelijk**; daarna voert de engine alle orders tegelijk uit.

## Architectuur in vier alinea's

De repo is een npm-workspace met drie packages. **`packages/engine`** bevat alle spelregels als pure TypeScript, zonder React en zonder browser. Het hart is `applyAction(toestand, actie) → { ok, state } | { ok: false, error }` in `src/game.ts`. De toestand (`GameState`, zie `src/types.ts`) is gewone JSON; toeval komt alleen uit een geseede generator (`src/rng.ts`). Daardoor geldt: zelfde scenario + seed + acties = precies hetzelfde spel.

**`packages/web`** is de React-app (Vite). Die tekent de toestand en stuurt acties naar de engine, maar bevat **zelf geen spelregels**. Een klik op de kaart wordt een _intentie_ ("ga naar die hex", "val die eenheid aan"); de engine maakt daar een order van of weigert met een reden, en de web-app toont die reden.

**Het spelersbeeld** (`getPlayerView(state, side)` in `src/view.ts`) is de enige bron van informatie voor de kaart, de AI-tegenstander en de AI-staf. Wat daar niet in zit (vijanden achter de fog of war), bestaat voor hen niet. Zo kan niemand valsspelen.

**`packages/server`** is een klein Express-servertje dat alleen berichten doorgeeft aan OpenRouter (een dienst die toegang geeft tot veel taalmodellen) voor de AI-staf "met taalmodel". De API-sleutel staat alleen daar, in `.env`. Het spel werkt volledig zonder server.

```
data/ (eenheden, terrein, scenario's)  ──►  engine: applyAction ──► GameState
                                                     │
                              getPlayerView(state, 'blue')  (fog of war)
                                ┌───────────┼──────────────┐
                           web: kaart    AI-tegenstander   AI-staf ──► (server ──► OpenRouter)
                                │                              │
                                └──── intentie ──► engine valideert ◄── voorstellen
```

## Gouden regels (niet onderhandelbaar)

1. **Spelregels staan alleen in `packages/engine`.** Nooit "even snel" een regel in een React-component of klikhandler. Iemand die later iets aanpast, moet op één plek kunnen zoeken. Lintregels en tests bewaken dit.
2. **Eerst de test, dan de regel.** Werk test-driven in de engine: schrijf een test in een `*.test.ts`-bestand die de nieuwe regel beschrijft, zie hem falen, maak hem groen.
3. **Nooit `Math.random()`, `Date.now()` of `new Date()` in de engine.** Gebruik `rollD6(state.rng)` of `nextFloat(state.rng)`. (ESLint blokkeert het.)
4. **Geen API-sleutel in de frontend of in git.** Ook niet tijdelijk. Sleutels horen in `.env` (staat in `.gitignore`); zie `.env.example`.
5. **De staf mag niet valsspelen.** Het taalmodel krijgt alleen `summarizeForModel(getPlayerView(...))`. Voorstellen gaan door `checkProposals` (engine-validatie) voordat de speler ze kan overnemen.
6. **Alles fictief.** Geen echte landen, steden, eenheden, wapensystemen of operaties. Verzin namen.
7. **De web-app importeert alleen uit `@wargame/engine`** (de publieke ingang `packages/engine/src/index.ts`). Iets nodig? Exporteer het daar.
8. **Geen code buiten `src/data/` noemt een eenheidstype of terrein bij naam** (zoals `'infantry'` of `'river'`). Gedrag hoort in een eigenschap in de data (bijvoorbeeld `fireRange`, `attackFromShift`). Een test (`extensibility.test.ts`) bewaakt dit.

## Afspraken over state management

- `GameState` is gewone JSON: geen klassen, geen functies. Kaart en catalogus veranderen tijdens een spel nooit en worden in kopieën gedeeld (zie `workingCopy` in `game.ts`); de rest wordt gekopieerd.
- `applyAction` verandert de oude toestand **nooit** (daar is een test voor). Binnen de engine mag code de werkkopie direct aanpassen (`unit.strength -= 1`); dat is leesbaar en veilig, omdat het een kopie is.
- De web-app gebruikt één Zustand-store (`packages/web/src/store/gameStore.ts`) met: de huidige `GameState`, de lijst van acties sinds de start (om na te spelen), en interface-zaken (selectie, meldingen, debug). Het staf-gesprek staat in `staff/staffStore.ts`.
- Afgeleide gegevens (spelersbeeld, bereikbare hexen, kansen) worden steeds opnieuw door de engine berekend; de store slaat ze niet op.

## Draaien en testen

| Wat                                    | Commando                                                          | Duur (ongeveer) |
| -------------------------------------- | ----------------------------------------------------------------- | --------------- |
| Installeren                            | `npm install`                                                     | 5–30 s          |
| Spel + staf-server starten             | `npm run dev` en open http://localhost:5173                       | 2 s             |
| Alleen het spel                        | `npm run dev:web`                                                 | 1 s             |
| Alle tests                             | `npm test`                                                        | 3 s             |
| Tests continu tijdens werken           | `npm run test:watch` (of `npx vitest packages/engine`)            | direct          |
| Eén testbestand                        | `npx vitest run packages/engine/src/rules/combat.test.ts`         | 1 s             |
| Typecontrole / lint                    | `npm run typecheck` / `npm run lint`                              | 8 s / 7 s       |
| Gebouwde site (statisch)               | `npm run build` (uitvoer in `packages/web/dist`)                  | 1 s             |
| End-to-end (speelt een heel spel)      | `npm run test:e2e`                                                | 12 s            |
| Balans meten (computer tegen computer) | `npx tsx packages/engine/scripts/balance.ts 40 balanced balanced` | 6 s             |

Snel iets zien zonder te spelen: het **debugmenu** (knop "debug" rechtsboven, alleen bij `npm run dev`) laadt een scenario met een seed, springt naar een beurt (de computer speelt blauw) en zet de fog of war uit. Een spel naspelen: open `http://localhost:5173/?seed=42`.

Klaar met een wijziging? Altijd: `npm test && npm run typecheck && npm run lint`.

## Waar vind je wat (uitbreidingspunten)

Elk van deze bestanden heeft bovenaan een korte uitleg.

| Wat wil je?                                         | Bestand(en)                                                           |
| --------------------------------------------------- | --------------------------------------------------------------------- |
| Nieuw eenheidstype, of waarden aanpassen            | `packages/engine/src/data/unitTypes.ts`                               |
| Nieuw terrein                                       | `packages/engine/src/data/terrains.ts` (+ teken in een scenariokaart) |
| Nieuw scenario, kaart, beurten, eenheden            | `packages/engine/src/data/scenarios/` (+ lijst in `index.ts`)         |
| Gevechtstabel, artillerieschade, herstel            | `packages/engine/src/data/combatTables.ts`                            |
| Nieuwe gevechtsregel                                | `packages/engine/src/rules/combatModifiers.ts`                        |
| Nieuwe AI-houding                                   | `packages/engine/src/data/postures.ts`                                |
| Gedrag van de AI-tegenstander                       | `packages/engine/src/ai/opponent.ts`                                  |
| Nieuw staf-commando (zonder taalmodel)              | `packages/engine/src/staff/commands/` (+ lijst in `index.ts`)         |
| Wat het taalmodel te zien krijgt                    | `packages/engine/src/staff/prompt.ts`                                 |
| Zicht / fog of war                                  | `packages/engine/src/rules/vision.ts`                                 |
| Beweging                                            | `packages/engine/src/rules/movement.ts`                               |
| Volgorde van een beurt (vuur, beweging, gevecht, …) | `packages/engine/src/rules/resolveTurn.ts`                            |
| Uitslag en punten                                   | `packages/engine/src/rules/victory.ts` + `victory` in het scenario    |
| Teksten in het beurtverslag                         | `packages/engine/src/text/describe.ts`                                |
| After-action report                                 | `packages/engine/src/aar.ts`                                          |
| Kleuren, lettertypes, opmaak                        | `packages/web/src/styles.css`, `packages/web/src/map/UnitCounter.tsx` |
| Kaart tekenen                                       | `packages/web/src/map/HexMap.tsx`                                     |
| Zijpaneel, knoppen                                  | `packages/web/src/panels/`, `packages/web/src/screens/`               |

Voorbeeldopdrachten om te plakken: `docs/modding.md`.

## Wat lastig bleek (lees dit voor je begint)

- **Hex-coördinaten.** We gebruiken axiale coördinaten (q, r) in de engine en "odd-r"-offset (kolom, rij) in scenario's en op het scherm. Gebruik `offsetToAxial` / `axialToOffset` en in tests het hulpje `at(kolom, rij)`. Buren van (kolom, rij) verschillen tussen even en oneven rijen. Reken een testsituatie na voordat je een test schrijft; de meeste fouten in deze sessie zaten in de testopstelling, niet in de regels.
- **Zicht in tests.** Een eenheid ziet maar 2 tot 5 hexen ver. Een aanval op een vijand die je niet ziet, wordt (terecht) geweigerd. Zet zo nodig een verkenningseenheid in de test.
- **Snelheid.** De AI berekent veel mogelijke zetten. Kopieer de toestand niet onnodig (`structuredClone` van de hele toestand was eerst de grootste vertraging) en gebruik `reachablePaths` (één zoektocht per eenheid) in plaats van per hex opnieuw te zoeken. Een volledig computerspel duurt nu ongeveer 150 ms.
- **Determinisme in de AI.** Bij gelijke scores moet de keuze vast liggen (sorteer op id of hexsleutel). Itereer niet over objecten waarvan de volgorde kan verschillen zonder te sorteren.
- **Balans.** Verander je eenheden of de kaart, meet dan met `scripts/balance.ts`. Doel: blauw (computer) wint ongeveer 60% tegen rood "evenwichtig". Een mens speelt anders dan de computer; dat is niet gemeten.
- **Waar ligt een plek op de kaart?** Kolom en rij staan bij `placeNames` in het scenario, en in het spel ziet u ze als u met de muis over een hex gaat (tooltip "(kolom,rij)"). De kaart in het scenario is tekst: rij 0 bovenaan, kolom 0 links.
- **Nieuw terrein met een eigen patroon** (bossymbooltjes, golfjes): voeg de naam toe aan `pattern` in `types.ts`, aan `PATTERN_ID` en een `<pattern>` in `web/src/map/HexMap.tsx`. Alleen een kleur kan ook; dan is `data/terrains.ts` genoeg.
- **Teksten die regels noemen.** De omschrijvingen in `data/unitTypes.ts` (bijvoorbeeld "kan niet door een rivier") en de briefing in het scenario zijn gewone tekst. Pas ze aan als je de regels verandert. De terreinregels voor het taalmodel worden wel automatisch uit de data gemaakt.
- **CSS-klassen.** Gebruik unieke klassenamen (er was een botsing tussen `.staff` voor het paneel en een legenda-icoontje).

## Documentatie en geheugen

- **Logboek:** `docs/LOGBOEK.md`: per sessie wat er gebeurde, met getallen en wat niet gelukt is.
- **Richtinggevende besluiten:** `docs/BESLISSINGEN.md`: de grote keuzes (beurtstructuur, state management, staf-interface) met reden en hoe terug te draaien.
- **Kleine keuzes:** in de pull request onder "Zelf besloten".
- **Ideeën voor later:** `docs/ideeen.md`.
- **Voor spelers en begeleiders:** `README.md`, `docs/modding.md`.

Werk deze bestanden bij als je iets verandert dat erin beschreven staat.
