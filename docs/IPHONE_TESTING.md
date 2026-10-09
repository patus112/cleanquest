# CleanQuest — inštalácia a prvý test na iPhone

Použi schválenú **HTTPS** adresu vydania, napr. `https://USERNAME.github.io/cleanquest/`, v bežnom Safari. Adresa `127.0.0.1` na iPhone označuje samotný telefón, nie vývojový počítač. Cieľ prvého manuálneho testu je iOS 17 alebo novší; konkrétny iPhone zatiaľ nebol testovaný.

Pri skúšobnom otvorení cez miestnu Wi-Fi HTTP adresu funguje vytvorenie domova aj zápis dokončení. Taká adresa však neposkytuje bezpečný kontext potrebný na offline balík PWA a kontrolné súčty ZIP záloh. Inštaláciu, offline správanie a úplné ZIP zálohovanie testuj na HTTPS adrese; cez Wi-Fi HTTP používaj skúšobný domov. Oprava tlačidla nevyžaduje vymazanie údajov ani zmenu aktuálnej adresy — obnov tú istú stránku.

## Pridať na plochu

1. Otvor adresu v **Safari** a nechaj aplikáciu úplne načítať online.
2. Otvor **Zdieľať**; podľa rozloženia Safari môže byť v ponuke stránky alebo priamo na lište.
3. Vyber **Pridať na plochu**. Ak položka chýba, nájdi ju cez **Upraviť akcie**.
4. Ak Safari ponúka **Otvoriť ako webovú aplikáciu**, zapni túto možnosť. Názov ponechaj **CleanQuest** a klepni **Pridať**.
5. Spusti ikonu z plochy. Online počkaj na správu **CleanQuest je pripravený na použitie bez internetu.** Pred prvým offline testom skontroluj aj opätovné online otvorenie z ikony.

Názvy a poloha ovládania sa môžu líšiť podľa verzie a jazyka systému. Postup vychádza z [návodu Apple pre Safari](https://support.apple.com/guide/iphone/bookmark-a-website-iph42ab2f3a7/ios).

## Existujúci domov a záloha

Pred zmenou adresy alebo inštalácie exportuj ZIP z pôvodnej aplikácie cez **Profil → Zálohovanie a obnova**. Vyber **Zdieľať / uložiť súbor → Uložiť do Súborov**, ak je dostupné, alebo **Stiahnuť ZIP**. V aplikácii **Súbory** nájdi skutočný súbor; môže byť v iCloud Drive alebo Na mojom iPhone podľa tvojej voľby. Až potom potvrď **Zálohu mám bezpečne uloženú**. Zrušené zdieľanie ani príprava ZIP nie sú uloženou zálohou.

Na novej HTTPS adrese alebo po spustení z plochy nepredpokladaj automatické prenesenie pôvodných údajov. Ak sa zobrazí prázdne nastavenie, použi dostupnú obnovu zo zálohy. Import najprv zobrazí náhľad; existujúci domov nahradí až po výslovnom potvrdení. Pred nahradením exportuj aj aktuálny domov. Porovnaj miestnosti, fotky, úlohy, DA, peňaženku a nastavenia. Pôvodnú inštaláciu zachovaj, kým kontrola neprejde.

ZIP zahŕňa fotografie miestností, predmetov, problémov a projektu. Obsahuje súkromné domáce údaje, preto ho ukladaj na zvolené bezpečné miesto a nepridávaj ho do verejného repozitára. Aplikácia sama nevykonáva zálohu do iCloudu. Podrobný formát a validácia sú v [BACKUPS.md](BACKUPS.md).

## Čo znamená miestne úložisko na iOS

**Údaje sú uložené v tomto zariadení. Ak stratíš telefón alebo vymažeš údaje aplikácie, bez zálohy ich nemusí byť možné obnoviť.**

WebKit môže odstrániť webové údaje pri nedostatku miesta, prekročení spoločných limitov alebo dlhej neaktivite. Aplikácia žiada trvalé úložisko, kde je dostupné, ale iOS nemusí žiadosť povoliť. Odhad voľného miesta nie je garantovaná kapacita; uloženie na plochu nenahrádza export ZIP. Tieto obmedzenia popisuje [WebKit Storage Policy](https://webkit.org/blog/14403/updates-to-storage-policy/).

Zálohuj po podstatných zmenách a pred vymazaním údajov Safari, zmenou domény či opätovnou inštaláciou. Ponechaj posledné funkčné ZIP súbory aj mimo telefónu. Pripomienky aplikácie sú miestne, predvolene po siedmich dňoch so zmenami; nepredstavujú automatickú zálohu. Správanie natívneho zdieľania, odobratie úložiska systémom a samostatný režim treba overiť na konkrétnom zariadení.

## Kontrolný zoznam prvého testu

Použi skúšobný domov alebo novú testovaciu inštaláciu. Test vymazania a obnovy nerob na jedinej kópii svojho skutočného domova.

- [ ] Spusti z ikony; skontroluj názov, ikonu, spodnú navigáciu, bezpečné okraje a formuláre pri otvorenej klávesnici.
- [ ] Vytvor vlastný domov, miestnosť a predmet; pridaj fotku a úlohu **Utrieť reproduktory zhora**, 3 minúty, každých 7 dní.
- [ ] Dokonči jeden malý krok. Zavri a znova otvor aplikáciu; dokončenie, DA a ďalší termín zostávajú uložené.
- [ ] Po príprave offline balíka zapni režim lietadlo. Znovu otvor aplikáciu z ikony, dokonči krok a over ho po ďalšom otvorení.
- [ ] Vyber päťminútový blok; dokonči denný plán, potom dve extra úlohy. Extra kroky nemenia DA ani odmeny a tretí nie je dostupný.
- [ ] V skúšobnom domove over hlavnú a samostatnú bonusovú odmenu, čiastočné čerpanie a vrátenie dokončenia.
- [ ] Exportuj ZIP do Súborov; otestuj aj zrušenie zdieľania. Zrušenie nesmie potvrdiť uloženie zálohy.
- [ ] V oddelenej testovacej inštalácii obnov ZIP; porovnaj aj fotky, históriu, DA a peňaženku. Poškodený ZIP musí odmietnuť bez zmeny aktuálnych údajov.
- [ ] Over presúvanie predmetov prstom, uloženie/zrušenie rozloženia a čitateľnosť pri väčšom texte, svetlej téme, obmedzení pohybu a VoiceOver.
- [ ] Po ďalšom schválenom vydaní otvor online, prijmi **Aktualizovať** a over zachovanie domova a offline otvorenie novej verzie.

Do výsledkov zapíš model iPhone, verziu iOS, Safari alebo spustenie z plochy, konkrétny krok a výsledok. Upozornenia na pranie sú dostupné počas používania aplikácie; zavretá aplikácia nesľubuje budík ani push notifikáciu.
