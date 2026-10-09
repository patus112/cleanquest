# CleanQuest — pripravenosť prvého testovacieho vydania

Audit a kontroly vykonané **9. októbra 2026**. Výsledok: **pripravené na prvé testovanie na reálnom iPhone po schválenom nasadení**. Žiadny zostávajúci lokálny blokátor sa vo vykonaných kontrolách neprejavil. Inštalácia na fyzickom iPhone a prvý beh GitHub Actions ešte nie sú overené.

## Skutočný stav implementácie

| Oblasť             | Implementované a overené                                                                                                                                 | Obmedzenie / chýbajúca časť                                                                          |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Domácnosť          | Vlastné nastavenie alebo upraviteľná rodinná šablóna; podlažia, miestnosti, plochy, podlahy, okná, textílie, predmety, fotografie a presúvanie predmetov | Mapa je schéma; nemá merané susednosti miestností ani 3D model                                       |
| Úlohy              | 224 šablón podľa inventára; vlastné úlohy, úprava, pauza, duplikácia, rozdelenie, história, konkrétny predmet                                            | Nové úlohy a nastavenia nemenia už uzamknutý týždeň; priamy zápis dokončenia rešpektuje denný limit  |
| Plány              | Malé kroky, rozpočty 5–30 minút, dni oddychu, stabilné týždne, výmena a odklad, kalendárové aj dokončením riadené opakovanie                             | Voľné poznámky o špeciálnych potrebách automaticky nemenia čistiace postupy                          |
| DA ⚡ a odmeny     | Úrovne, úspechy, história a vrátenie dokončenia; €20 za povinný plán, nezávislý bonus 100 DA/€5, virtuálna peňaženka a čiastočné čerpanie                | Žiadne platby; bonus má dve preddefinované varianty                                                  |
| Dobrovoľné kroky   | Najviac dve extra úlohy, spolu najviac 10 minút, bez DA, peňazí a vplyvu na týždenný plán                                                                | Dodatočná energia sa odomyká až po dokončení denného plánu                                           |
| Zlepšenia a pranie | Problémy, upraviteľné návrhy, fotografie, mesačný projekt za 500 DA, nadväzujúca úloha po skutočnom spustení prania                                      | Mesačný projekt si vyberá používateľ; upozornenia fungujú v otvorenej aplikácii                      |
| Údaje              | IndexedDB/Dexie v5, migrácie, transakcie, binárne fotografie, oddelené inštalácie                                                                        | Jeden miestny domov; účty, cloud, synchronizácia a automatická cloudová záloha nie sú implementované |
| Zálohy             | Kompletný ZIP vrátane fotografií, kontrolné súčty, validácia, náhľad a potvrdenie, atomická obnova s kontrolou zápisu                                    | Natívne zdieľanie do Súborov a správa úložiska sa musia overiť na iPhone                             |

## Opravy pre vydanie

- Staré nesplnené týždne blokovali niektoré ponúknuté extra úlohy a náhrady. Rezervácie sa teraz posudzujú v príslušnom týždni; staré záväzky, história a odmeny zostávajú zachované. Dva regresné testy najprv potvrdili chyby a po oprave prešli.
- Build teraz automaticky kontroluje všetky odkazy na assety, manifest, rozmery ikon, Workbox, cache a offline shell pomocou `scripts/verify-build.mjs`.
- E2E používa samostatný statický server na porte 4174 bez SPA presmerovaní. Overuje všetkých päť sekcií cez hash odkazy, obnovenie online/offline, scope service workera a opätovné otvorenie s uloženým dokončením.
- Existujúci Pages workflow má overovanie buildu, mobilné testy, časové limity, záznamy zlyhaní a samostatný schvaľovaním podmienený deploy job.

Pri následnom teste na iPhone sa prejavila chyba vytvorenia domova cez miestnu HTTP adresu. Predchádzajúce testy používali dôveryhodný localhost a túto situáciu nepokrývali. Chyba bola reprodukovaná vo WebKit, opravená kompatibilným generovaním UUID a doplneným hlásením/obnovou po chybe. Nové testy používajú skutočne nezabezpečený pôvod a preverujú vlastný aj pripravený domov, prvé dokončenie a perzistenciu v oboch enginoch. Potvrdenie opravy na používateľovom iPhone zostáva manuálne.

## Vykonané výsledky

| Kontrola                       | Výsledok                                                                                                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript + ESLint            | Prešli                                                                                                                                                        |
| Vitest                         | **159/159** — doména 95, miestnosti 17, IndexedDB 14, zálohy/úložisko 21, React UI 9, identifikátory 3                                                        |
| Playwright                     | **24/24**, mobilné Chromium + WebKit vrátane HTTP cez Wi-Fi                                                                                                   |
| Produkčný build `/cleanquest/` | Prešiel, vrátane generovania service workera a automatického overenia assetov                                                                                 |
| Samostatný build `/`           | Prešiel pri príprave vydania v dočasnom adresári; konfigurácia základu sa opravou LAN nemenila                                                                |
| Záloha + obnova                | Prešli vrátane 15 miestností, 393 úloh, 4 fotopríloh, histórie, 30 DA, zostatku €17,65, nastavení a rozpracovaného projektu; poškodená záloha nezmenila údaje |
| Offline + perzistencia         | Prešli v oboch enginoch; dokončenie, export a obnova bez siete, obnovenie stránok a opätovné otvorenie                                                        |
| Závislosti                     | `npm audit --audit-level=moderate`: 0 známych zraniteľností                                                                                                   |

YAML workflow bol lokálne načítaný a overené boli jeho QA príkazy, Node 22, Pages artifact, povolenia a podmienka schválenia. Miestne odkazy v návodoch aj posledný produkčný balík prešli kontrolou. Skutočný vzdialený beh workflow zostáva neoverený.

Build vypisuje neblokujúce upozornenia na komentáre upstream knižnice Zod. Po opravách nezostali zlyhávajúce automatické kontroly. WebKit testy nie sú testom fyzického iPhone; natívny dialóg zdieľania, VoiceOver, skutočné bezpečné okraje, správanie iOS pri nedostatku miesta a prijatie ďalšej vydanej verzie zostávajú manuálne.

## PWA a GitHub Pages

Manifest v slovenčine má `id`, `start_url` a `scope` `/cleanquest/`, režim `standalone`, ikony 192/512 px, maskovateľnú 512 px ikonu a Apple 180 px ikonu. Service worker je `/cleanquest/sw.js` so scope `/cleanquest/`, cache obsahuje všetky potrebné miestne assety. Nová verzia sa aktivuje tlačidlom **Aktualizovať**; staré cache sa čistia bez vymazania IndexedDB. Reálne prijatie nového vydania na iPhone čaká na manuálny test.

Hash odkazy, napr. `/cleanquest/#/tasks?tab=rooms`, fungujú na statickom hostingu bez serverového presmerovania. HTTPS GitHub Pages je pripravené konfiguráciou, **aplikácia ešte nie je publikovaná**. Schválené verejné repo [patus112/cleanquest](https://github.com/patus112/cleanquest) bolo vytvorené a pripojené ako miestny `origin`. Premenné `VITE_BASE_PATH=/cleanquest/` a `CLEANQUEST_DEPLOY_APPROVED=false` boli uložené a overené. Repo je prázdne, miestny Git nemá commit a kód sa ešte nepushol. Používateľské údaje neboli prepísané; deštruktívne testy bežali iba v oddelených testovacích databázach.

Zostáva: schváliť push/publikovanie → overiť prihlásenie účtom s právom zápisu → commit/push na `main` → zapnúť Pages/GitHub Actions a schválený deploy → overiť HTTPS URL a [iPhone kontrolný zoznam](IPHONE_TESTING.md). Presné nastavenia a postup sú v [návode na vydanie](RELEASE.md).
