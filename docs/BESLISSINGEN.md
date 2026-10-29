# Richtinggevende besluiten

Grote keuzes die de rest van het project bepalen. Per besluit: wat, waarom, gevolgen, en hoe terug te draaien.
Kleine keuzes staan in de pull request onder "Zelf besloten".

---

## B1. Beurtstructuur: beide kanten plannen tegelijk, daarna gelijktijdige uitvoering (WEGO)

_29 oktober 2026. Besloten door: Ebbe (fase 0)._

**Wat.** Blauw en rood geven tegelijk orders. Als beide klaar zijn, voert de engine alles tegelijk uit in vaste fasen (`packages/engine/src/rules/resolveTurn.ts`):

1. vuur (artillerie vuurt op de hex die het koos, vóór de beweging);
2. beweging per tik (elke tik zet elke bewegende eenheid één stap);
3. gevecht (alleen als het doelwit na de beweging nog naast de aanvaller staat);
4. herstel naast logistiek;
5. doelen (wie erop staat, neemt ze in);
6. einde of volgende beurt.

**Waarom.** Ebbe: "juist dat je tegelijk moet uitvoeren omdat je dan ook moet nadenken over wat de tegenstander doet." Om-en-om spelen (mijn aanbeveling in fase 0) was eenvoudiger, maar mist dat denkwerk.

**Hoe we de complexiteit beheersbaar hielden.**

- Botsingen worden met eenvoudige, uitlegbare regels opgelost:
  - twee vijanden naar dezelfde hex: beide stoppen (contact);
  - een eigen eenheid in de weg: wachten, met voorrang op volgorde van id;
  - naast een vijand komen: stoppen.
- Een aanval die niet meer kan, gaat niet door, met een melding ("doelwit trok weg").
- De beurt wordt alleen in één bestand afgewikkeld, met tests per situatie.

**Gevolgen.** De AI plant zonder te weten wat de speler doet (eerlijk). Het beurtverslag is belangrijker, omdat er veel tegelijk gebeurt.

**Terugdraaien.** Om-en-om kan met dezelfde engine: `endTurn` zou dan direct alleen de orders van één kant uitvoeren. Dat betekent `resolveTurn` per kant aanroepen en de tests in `resolveTurn.test.ts` aanpassen. Ongeveer een halve dag werk.

---

## B2. State management: pure engine, toestand als JSON, dunne Zustand-store

_29 oktober 2026. Door Ebbe aan Claude gelaten ("kies wat het beste is")._

**Wat.**

- De engine heeft één ingang: `applyAction(state, action)`. De oude toestand verandert nooit.
- De toestand is gewone JSON, inclusief de stand van de toevalsgenerator. Kaart en catalogus worden in kopieën gedeeld (ze veranderen niet tijdens een spel).
- De web-app bewaart in één Zustand-store: de huidige toestand, de lijst van acties sinds de start, en interface-zaken (selectie, meldingen, debug).
- De web-app mag alleen importeren uit `@wargame/engine`. Een ESLint-regel bewaakt dat; een test en een ESLint-regel bewaken ook dat de engine niets uit React, de browser of Node importeert.

**Waarom.**

- Eén plek voor regels.
- Determinisme en naspelen zijn "gratis".
- Het after-action report komt uit dezelfde geschiedenis.
- De web-app kan geen regel per ongeluk dupliceren.

**Terugdraaien.** Zustand vervangen door `useReducer` raakt alleen `packages/web/src/store/` en `staff/staffStore.ts`.

---

## B3. AI-staf: gestructureerde voorstellen die de engine valideert

_29 oktober 2026. Besloten door: Ebbe (optie 2 uit fase 0)._

**Wat.**

- Beide staf-modi (scripted en openrouter) leveren hetzelfde: tekst plus voorstellen in de vorm van _intenties_, zoals "ga naar (kolom, rij)", "val eenheid X aan", "vuur op (kolom, rij)" of "verdedig".
- De engine maakt van elke intentie een order met pad (`intentToOrder`) en controleert hem (`validateOrder`, `checkProposals`). Ongeldige voorstellen ziet de speler met reden, en ze kunnen niet worden overgenomen.
- De speler bevestigt altijd zelf.
- Het taalmodel krijgt alleen `summarizeForModel(getPlayerView(state, 'blue'))`. De prompt wordt in de engine gebouwd en getest op lekken.

**Waarom intenties en geen paden?** Taalmodellen zijn slecht in hex-paden tekenen. Een bestemming noemen kunnen ze wel, en de engine rekent de route uit.

**Terugdraaien.** Alleen vrije tekst: in `advisors.ts` de voorstellen negeren.

---

## B4. OpenRouter: model via omgevingsvariabele, server als doorgeefluik

_29 oktober 2026. Aanbeveling van Claude; ter bevestiging door Ebbe._

**Wat.**

- Standaardmodel `anthropic/claude-haiku-4.5`, in te stellen via `OPENROUTER_MODEL`.
- De server (`packages/server`) valideert de berichten, zet de sleutel erbij, begrenst het aantal verzoeken per minuut en stuurt door.
- De browser bouwt de berichten met engine-functies, zodat de fog-of-war-controle op één plek staat en getest is.

**Kosten.** Ongeveer $0,006 per vraag, ongeveer $0,10 per spel (zie README).

**Niet geverifieerd.** openrouter.ai was niet bereikbaar vanuit de bouwomgeving. De keten is getest met een nep-model (lokale server die een OpenRouter-antwoord nabootst), niet met het echte model.

---

## B5. Balans van Operatie Grensbrug

_29 oktober 2026. Aanbeveling van Claude._

**Wat.**

- Blauw heeft 9 eenheden: 3 infanterie, 3 pantser, artillerie, verkenning en logistiek.
- Rood heeft 7 eenheden: 3 infanterie, 1 pantser, artillerie, verkenning en logistiek.
- De Grensbrug is bij de start van niemand.
- Een rivier geeft de verdediging x0,7.
- Overwinning: doelwaarde + 0,2 punt per verloren vijandelijk sterktepunt; nodig is 2 punten verschil.

**Hoe gemeten.** Met `scripts/balance.ts`: de computer speelt beide kanten, over 40 seeds.

| Rood        | Blauw wint | Rood wint | Onbeslist |
| ----------- | ---------- | --------- | --------- |
| Evenwichtig | 18 (45%)   | 19        | 3         |
| Aanvallend  | 17         | 9         | 14        |
| Verdedigend | 1          | 39        | 0         |

**Hoe we hier kwamen.**

1. Met 8 tegen 8 en een rivier van x0,5 won blauw-als-computer maar 1 tot 5 van de 40 spellen.
2. Met 9 tegen 7, de Grensbrug neutraal en een rivier van x0,7 was dat 62%.
3. Na het herstellen van een zichtfout (zicht was niet symmetrisch, zie de review in de PR) en van door-eigen-eenheden-bewegen zakte dat naar 25%.
4. Daarom is de tweede rode tankcompagnie vervangen door infanterie.

**Let op.**

- "Verdedigend" is voor de computer-blauw bijna onverslaanbaar. Het staat in het spel aangeduid als de zwaarste tegenstander.
- Alles is gemeten met de computer aan beide kanten, niet met mensen. Een mens bundelt aanvallen anders. Speel het zelf en stel bij in het scenario.

---

## B6. Taal

**Wat.** Identifiers en code in het Engels (Claude werkt daar het betrouwbaarst mee). Commentaar, documentatie, interface en weergavenamen in de data in het Nederlands.
