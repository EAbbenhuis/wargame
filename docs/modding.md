# Het spel aanpassen met Claude Code: tien opdrachten

Deze gids is voor mensen die niet programmeren. U typt (of plakt) een opdracht in Claude Code, Claude past het spel aan, en u ziet het resultaat in de browser.

## Voorbereiding (eenmalig)

1. Open een terminal in de map van het spel en start het spel: `npm run dev`. Open http://localhost:5173 in de browser.
2. Start in een tweede terminal Claude Code in dezelfde map: `claude`.
3. Laat het spel openstaan. Na een aanpassing ververst de browser vaak vanzelf; zo niet, druk op F5.

**Tips**

- Plak de opdracht precies zoals hieronder. Meer uitleg mag altijd.
- Vraag aan het eind: _"Draai de tests en vertel me in gewone taal wat je hebt veranderd."_
- Niet goed? Zeg _"Draai dat terug"_. Alles staat in git.
- Snel testen zonder te spelen: knop **debug** rechtsboven (spring naar een beurt, fog of war uit).

De opdrachten lopen op van makkelijk naar moeilijk. De tijden zijn een schatting voor iemand die het voor het eerst doet, inclusief kijken in het spel.

---

### 1. Kleur van de vijand (± 3 minuten)

```text
Maak de vijandelijke eenheden rood-oranje in plaats van rood, op de kaart en in de legenda.
```

Waarschijnlijk geraakt: `packages/web/src/map/UnitCounter.tsx` (SIDE_COLORS), `packages/web/src/styles.css`.
Controle: start een spel; vijanden zijn rood-oranje.

### 2. Sneller pantser (± 3 minuten)

```text
Geef pantser 6 bewegingspunten in plaats van 5.
```

Waarschijnlijk geraakt: `packages/engine/src/data/unitTypes.ts`.
Controle: selecteer een pantsereenheid; het gele bereik is groter.

### 3. Langer spel (± 3 minuten)

```text
Laat Operatie Grensbrug 15 beurten duren in plaats van 12, en pas de briefing aan.
```

Waarschijnlijk geraakt: `packages/engine/src/data/scenarios/grensbrug.ts`.
Controle: rechtsboven staat "Beurt 1 van 15".

### 4. Nieuw terrein: moeras (± 8 minuten)

```text
Voeg een terreinsoort "moeras" toe: te voet kost het 3 bewegingspunten, voertuigen kunnen er niet door,
verdediging x0,8, en het blokkeert het zicht niet. Geef het een eigen kleur. Leg een moerasgebied van
een paar hexen aan ten zuiden van Merelbos in Operatie Grensbrug.
```

Waarschijnlijk geraakt: `packages/engine/src/data/terrains.ts`, `packages/engine/src/data/scenarios/grensbrug.ts`, misschien `packages/web/src/map/HexMap.tsx` (patroon).
Controle: het moeras staat op de kaart; pantser kan er niet in (geen geel bereik).

### 5. Nieuwe AI-houding (± 5 minuten)

```text
Voeg een nieuwe houding voor de tegenstander toe: "Voorzichtig". Die blijft dicht bij de doelen,
graaft graag in, gaat uit de buurt van vijandelijke dreiging en valt alleen aan bij grote overmacht.
```

Waarschijnlijk geraakt: `packages/engine/src/data/postures.ts`.
Controle: op het startscherm staat de nieuwe houding.

### 6. Nieuwe gevechtsregel (± 10 minuten)

```text
Voeg een gevechtsregel toe: artillerie die naast de vijand staat, verdedigt slecht
(verdediging x0,5). Schrijf eerst een test.
```

Waarschijnlijk geraakt: `packages/engine/src/rules/combatModifiers.ts`, een test in `packages/engine/src/rules/combat.test.ts`.
Controle: `npm test` is groen; in het beurtverslag staat de regel bij een gevecht.

### 7. Nieuw staf-commando (± 10 minuten)

```text
Voeg een staf-commando toe: als ik vraag "hoeveel tijd hebben we nog?" zegt de staf
hoeveel beurten er nog over zijn en welke doelen we nog moeten nemen.
```

Waarschijnlijk geraakt: een nieuw bestand in `packages/engine/src/staff/commands/`, de lijst in `commands/index.ts`, een test in `staff/staff.test.ts`.
Controle: stel de vraag in het stafpaneel.

### 8. Tweede scenario (± 15 minuten)

```text
Maak een tweede scenario "Operatie Noorderbrug": dezelfde kaart, maar blauw begint in het noorden,
er zijn twee doelen (Noorderbrug en Ostervaal), en het duurt 10 beurten. Maak het kiesbaar op het startscherm.
```

Waarschijnlijk geraakt: nieuw bestand in `packages/engine/src/data/scenarios/`, `packages/engine/src/data/scenarios/index.ts`.
Controle: op het startscherm kun je kiezen; `npm test` controleert dat elk scenario laadt.

### 9. Regen vermindert het zicht (± 15 minuten)

```text
Laat regen het zicht verminderen: in beurt 5 tot en met 8 regent het. Dan ziet iedere eenheid
1 hex minder ver (minimaal 1). Toon "Regen" bij het beurtnummer. Leg de regenbeurten vast in het
scenario, schrijf eerst een test, en zorg dat de staf het ook weet.
```

Waarschijnlijk geraakt: `packages/engine/src/types.ts` (scenario/toestand), `packages/engine/src/data/scenarios/grensbrug.ts`, `packages/engine/src/game.ts`, `packages/engine/src/rules/vision.ts`, `packages/engine/src/view.ts`, `packages/web/src/panels/CommandPanel.tsx`, tests.
Controle: spring met het debugmenu naar beurt 5; het zicht is kleiner.

### 10. Drones die de fog of war opheffen (± 20 minuten)

```text
Voeg drones toe: een nieuw eenheidstype "Drone" voor blauw. Een drone beweegt 8 hexen over elk
terrein (ook over rivieren), ziet 6 hexen ver en kijkt over bos, steden en heuvels heen. Een drone
kan niet aanvallen, en houdt geen doel bezet. Geef blauw in Operatie Grensbrug één drone.
Schrijf eerst tests.
```

Waarschijnlijk geraakt: `packages/engine/src/data/unitTypes.ts`, `packages/engine/src/data/terrains.ts` (bewegingsklasse 'air'), `packages/engine/src/types.ts` (nieuwe eigenschap, bijvoorbeeld "kijkt overal overheen"), `packages/engine/src/rules/vision.ts`, `packages/engine/src/rules/resolveTurn.ts` (doelen), het scenario, tests.
Controle: selecteer de drone, vlieg naar de overkant van de rivier; veel meer vijanden worden zichtbaar.

---

## Als het misgaat

- **Rode foutmelding in de browser of een lege pagina?** Zeg tegen Claude: _"Het spel laadt niet meer, dit staat in beeld: …"_ en plak de tekst.
- **Tests falen?** Zeg: _"De tests falen. Los het op zonder de test aan te passen, tenzij de test zelf fout is. Leg uit wat er mis was."_
- **Helemaal vast?** Zeg: _"Zet alles terug naar de laatste commit."_

## Uitkomst van de proeven

Twee van deze opdrachten zijn letterlijk uitgeprobeerd in een aparte branch. Zie de pull request en `docs/LOGBOEK.md` voor hoe dat ging.
