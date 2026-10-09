# CleanQuest — prvé vydanie na GitHub Pages

CleanQuest je dostupný na [https://patus112.github.io/cleanquest/](https://patus112.github.io/cleanquest/). Prvé testovacie vydanie bolo schválené používateľom a publikované 9. októbra 2026 z commitu `0f3111f`. [Build, všetky kontroly a deploy prešli](https://github.com/patus112/cleanquest/actions/runs/37917411857). **Ďalší push a publikovanie naďalej vyžadujú schválenie používateľa.**

## Už dokončené nastavenie — 9. októbra 2026

- Na používateľom potvrdenom účte `patus112` bolo vytvorené verejné repo [patus112/cleanquest](https://github.com/patus112/cleanquest) a nahraných 72 projektových súborov vrátane testov, ikon a dokumentácie.
- Miestny `origin` smeruje na `https://github.com/patus112/cleanquest.git`.
- Repository variable **VITE_BASE_PATH** má hodnotu **`/cleanquest/`**.
- Pages používajú **GitHub Actions**, povinné HTTPS a prostredie **github-pages**. Verejná stránka, všetkých 7 HTML assetov, manifest, ikony a service worker odpovedajú správne.
- Po schválenom prvom nasadení bola repository variable **CLEANQUEST_DEPLOY_APPROVED** vrátená na **`false`**. Web zostáva dostupný; ďalší workflow vykoná kontroly bez publikovania, kým sa nové vydanie neschváli.
- Používateľské databázy a osobné zálohy neboli nahrané ani prepísané. Existujúce iné repozitáre sa nemenili.

Zdrojový kód bol nahraný cez GitHub konektor overený na účte `patus112`; lokálny Git bol prepojený s rovnakou históriou bez prepisovania pracovných súborov. Lokálny `gh` CLI pri poslednej kontrole stále používal účet `gmcsered`; pred budúcim pushom použi schválené pripojenie s právom zápisu do nového repa a over jeho účet. Neuploaduj kód cez nesprávny účet ani nepridávaj kvôli tomu ďalších spolupracovníkov.

## Pred prechodom z miestneho testovania

V existujúcej aplikácii otvor **Profil → Zálohovanie a obnova → Exportovať zálohu** a skutočne ulož ZIP mimo aplikácie. Záloha obsahuje aj fotografie. Over, že súbor nájdeš v Súboroch alebo na počítači. Až potom potvrď **Zálohu mám bezpečne uloženú**.

Miestna adresa `127.0.0.1` a budúca HTTPS adresa GitHub Pages majú samostatné úložiská. Publikovaná aplikácia nezačne automaticky s údajmi miestneho testovania. Pôvodnú inštaláciu zachovaj, kým na novej adrese neoveríš obnovenie zálohy vrátane fotiek, DA a peňaženky.

## Lokálne kontroly pred každým vydaním

Použi Node.js 22:

```sh
npm ci
npm run check
npx playwright install chromium webkit
npm run e2e
```

`check` spúšťa typy, lint, Vitest, build a automatickú validáciu produkčných ciest/manifestu/ikon/cache. E2E spustí statický testovací server na `127.0.0.1:4174/cleanquest/`, používa oddelené testovacie databázy a nezasahuje do otvorenej aplikácie na porte 4173. Produkciu lokálne otvoríš pomocou `npm run preview` na `http://127.0.0.1:4173/cleanquest/`.

## Ďalšie vydanie po schválení

1. Účet a cieľové repo sú potvrdené: **patus112/cleanquest**. Pred pushom over správne prihlásenie a zachovaj existujúci `origin`. Nemeň iný projekt ani koreňový web `patus112.github.io`.
2. Po schválení vytvor nový commit zdrojov na vetve **main**. Pushni zdroje vrátane `package-lock.json` a `.github/workflows/pages.yml`. Nepushuj `node_modules`, `dist`, osobné ZIP zálohy ani fotografie používateľa. Push vykoná kontroly; deploy zostane vypnutý, kým sa nepovolí schválené vydanie.
3. V repozitári otvor **Settings → Pages → Build and deployment → Source → GitHub Actions**. Takto sa povoľuje nasadzovanie Vite buildu cez Actions. [Oficiálny návod Vite](https://vite.dev/guide/static-deploy.html#github-pages).
4. Otvor **Settings → Secrets and variables → Actions → Variables**. Nastav repository variable **VITE_BASE_PATH** na **`/cleanquest/`**. Rovnaký predvolený základ je už v konfigurácii; explicitná hodnota uľahčí kontrolu. Žiadne API kľúče ani backend secrets aplikácia nepotrebuje.
5. Po schválení publikovania zmeň existujúcu repository variable **CLEANQUEST_DEPLOY_APPROVED** na **`true`**. V **Settings → Environments → github-pages** over povolenie vetvy `main`; ak účet podporuje požadovaných schvaľovateľov, môžeš pridať aj túto kontrolu.
6. Otvor **Actions → Build and deploy CleanQuest → Run workflow**, vyber **main** a spusti. Job **check** musí prejsť typmi, lintom, testami, buildom a oboma mobilnými prehliadačmi. Job **deploy** potom publikuje iba `dist/`. Workflow má `pages: write`, `id-token: write`, väzbu `needs: check` a prostredie `github-pages` podľa [požiadaviek GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
7. Až po úspešnom jobe **deploy** otvor výslednú **HTTPS** adresu z jeho výstupu. Over `/cleanquest/`, `/cleanquest/#/profile` a `/cleanquest/#/tasks?tab=rooms`, ich obnovenie a assety bez 404. Pokračuj podľa [návodu na iPhone](IPHONE_TESTING.md).

Premenná `CLEANQUEST_DEPLOY_APPROVED=true` povoľuje aj automatické nasadenia ďalších pushov na `main`. Pre jednorazovo schválené vydanie ju po úspešnom nasadení vráť na **`false`**, ako pri prvom vydaní. Trvalo ju zapni iba po schválení takého režimu, prípadne použi ochranu prostredia. Skutočný vzdialený workflow bol úspešne overený pri prvom vydaní.

## Iné repo alebo vlastná doména

Pre projektové repo s iným názvom nastav základ `/<nazov-repa>/`. Pre samostatný web na vlastnej doméne nastav **VITE_BASE_PATH=`/`**, znova zostav a nakonfiguruj doménu, DNS a HTTPS v príslušnom repozitári. Root build bol lokálne overený. [Vite vysvetľuje rozdiel medzi projektovým a koreňovým základom](https://vite.dev/guide/static-deploy.html#github-pages).

Zmenu domény alebo pôvodu vykonaj až po exporte zálohy; úložisko sa automaticky nepresunie. Na GitHub účte môžu viaceré projektové weby zdieľať pôvod `USERNAME.github.io`; CleanQuest používa databázu `cleanquest`. Tento MVP neplánuje dve nezávislé CleanQuest inštancie na rôznych cestách toho istého pôvodu. Ostatné repozitáre ani ich Pages konfigurácia sa pri tomto vydaní nemenia.

## Aktualizácie a návrat verzie

Nové assety majú verziované názvy. Service worker pripraví novú cache a aplikácia ponúkne **Aktualizovať**; akceptuj až po dokončení úprav a ukladaní. Aktualizácia čistí staré aplikačné cache, nevymazáva domov z IndexedDB. Takýto režim zodpovedá [Vite PWA prompt stratégii](https://vite-pwa-org.netlify.app/guide/prompt-for-update.html).

Pred vydaním, ktoré mení databázovú schému, ulož aktuálnu zálohu. Návrat staršieho buildu nemusí vedieť čítať novšiu databázu; nevymazávaj údaje ako prvý pokus o opravu. Uchovaj poslednú funkčnú zálohu a rieš prípadnú migráciu. Žiadny rollback ani nové publikovanie sa nevykonáva bez schválenia.
