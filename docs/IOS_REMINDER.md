# Denné pripomenutie na iPhone

CleanQuest neposiela push notifikácie a nemá server, ktorý by ťa mohol osloviť. Pripomenutie v aplikácii sa ukáže, keď ju otvoríš alebo keď sa k nej vrátiš. Ak chceš každý deň v zvolenom čase otvoriť stránku, môžeš si to nastaviť sama v aplikácii Skratky. CleanQuest túto automatizáciu nevytvorí a nevypne.

## Čo sa ukáže v aplikácii

Jedno pokojné pripomenutie, iba ak je čo povedať:

- otvorené kroky na dnes, vrátane tých z tohto týždňa, ktoré ešte čakajú
- pripravený ďalší krok prania, rovnako ako doterajšie upozornenie na pranie
- pripomenutie zálohy, ak od poslednej potvrdenej zálohy uplynul zvolený čas a údaje sa zmenili

**Dnes nie** ho skryje do ďalšieho dňa v časovom pásme domácnosti. Toto skrytie je len v tomto prehliadači a nemení odloženie zálohy. **O týždeň** odloží iba riadok zálohy o sedem dní. Pripomenutie sa nezobrazí cez otvorený krok ani iné okno. Zatvorená aplikácia sama nič neohlási.

## Denné otvorenie cez Skratky

Postup je všeobecný. Názvy a poloha ovládania sa líšia podľa verzie iOS a jazyka systému. Vychádza z aktuálneho [návodu Apple na pridanie automatizácie](https://support.apple.com/guide/shortcuts/add-automations-apdfbdbd7123/ios), z [popisu spúšťača Time of Day](https://support.apple.com/guide/shortcuts/event-triggers-apd932ff833f/ios) a z [popisu akcie, ktorá otvára adresu](https://support.apple.com/guide/shortcuts/share-actions-apdaf74d75a5/ios). Staršie systémy mali osobnú automatizáciu na samostatnej karte; tam Apple opisuje voľbu Ask Before Running v [návode pre iOS 16](https://support.apple.com/guide/shortcuts/enable-or-disable-a-personal-automation-apd602971e63/6.0/ios/16.0).

1. Otvor aplikáciu **Skratky** a vytvor novú skratku, alebo otvor existujúcu.
2. Do zoznamu akcií vyhľadaj otvorenie webovej adresy. Apple ju v súčasnom návode nazýva **Open URLs** a inde **Open URL**. Použi akciu, ktorú tvoja verzia skutočne ponúka, a vlož adresu `https://patus112.github.io/cleanquest/`. Ak je CleanQuest pridaný na plochu a Skratky ponúkajú jeho otvorenie, môžeš namiesto adresy použiť túto voľbu.
3. Pri úprave skratky pridaj automatizáciu. Aktuálny návod Apple hovorí: klepni na **Edit**, potom na **Automation**, a vyber spúšťač, napríklad **Time of Day**. Nastav čas a opakovanie. Apple pri tomto spúšťači popisuje konkrétny čas, východ alebo západ slnka a opakovanie denne, v zvolené dni týždňa, alebo raz za mesiac.
4. Ak nechceš automatizáciu zakaždým potvrdzovať, aktuálny návod odkazuje na súkromie skratky a voľbu **Allow Running When Locked**. **Time of Day** je v zozname spúšťačov, ktoré vedia bežať bez pýtania. Starší návod namiesto toho ukazuje **Ask Before Running** a potvrdenie **Don’t Ask**. Ak vo svojej verzii ani jednu voľbu nevidíš, nechaj potvrdenie zapnuté. Klepnutím sa CleanQuest aj tak otvorí.
5. Apple dopĺňa, že niektoré akcie treba povoliť samostatne. Tento návod nesľubuje, že sa stránka otvorí, kým je telefón zamknutý.

Skratka beží v iOS, nie v CleanQuest. Zapnutie, vypnutie aj zmazanie nájdeš v aplikácii Skratky. Po otvorení adresy alebo ikony z plochy ukáže CleanQuest to isté pripomenutie ako pri bežnom spustení.
