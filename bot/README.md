# Overwatch-bot (bot/)

Discord-bot met Overwatch-seizoenen, events, heroes, maps en spelersprofielen.

Draait via de **Discord Gateway** (`discord.js`), dus geen publieke URL of ngrok nodig.
De HTTP-interactions voorbeeldapp in de hoofdmap (`app.js`, `npm start`) blijft gewoon werken.

## Wat de bot laat zien

| Command | Wat het doet | Databron |
| --- | --- | --- |
| `/season [nummer]` | Huidig seizoen, looptijd, countdown tot het einde, voortgangsbalk, nieuwe hero's/maps | Overwatch Wiki |
| `/seasons` | Alle seizoenen van de huidige story arc met status | Overwatch Wiki |
| `/event [seizoen] [alles]` | Events per seizoen, met datum waar de wiki die publiceert | Overwatch Wiki |
| `/hero [naam]` | Rol, subrol, hitpoints, abilities, perks (met autocomplete) | OverFast API |
| `/map [naam]` | Gamemode, locatie, afbeelding (met autocomplete) | OverFast API |
| `/player [battletag]` | Profiel, endorsement en competitive ranks per rol | OverFast API |
| `/owstatus` | Welke bronnen werken en hoe oud de data is | beide |

## Belangrijke beperking: seizoenen en events

Er is **geen officiële Blizzard-API** voor Overwatch-seizoenen of -events. De OverFast API
(heroes, maps, spelers) heeft die endpoints niet. Daarom komen seizoenen en events uit de
**Overwatch Wiki (Fandom, community-data)** en worden ze in `bot/data/seasons.json` gezet
door `npm run sync`.

Gevolgen waar de bot eerlijk over is:

* Seizoen 5 van de arc "Reign of Talon" staat in de wiki als *6 oktober 2026 - december 2026*.
  Er is dus geen exacte einddag: de countdown rekent met de laatste dag van die maand en het
  embed-veld heet dan ook "Loopt tot (uiterlijk)".
* Van de meeste events publiceert de wiki geen datum. De bot toont dan de eventnaam met
  "datum niet in de bron vermeld" in plaats van een verzonnen datum.
* Wijkt de wiki af van het spel, dan is de wiki fout. Voor beslissingen: check het spel of
  de officiële Overwatch-news-pagina.

## Installeren

```bash
npm install
copy .env.sample .env      # vul DISCORD_TOKEN en APP_ID in
npm run deploy             # slash commands registreren (met DISCORD_GUILD_ID direct zichtbaar)
npm run bot                # bot starten
```

Optioneel in `.env`:

* `DISCORD_GUILD_ID` - commands alleen op die server zetten (verschijnen direct).
* `TRACKER_CHANNEL_ID` - kanaal waar de bot dagelijks de seizoenscountdown plaatst/ververst.
* `TRACKER_UUR` - uur van de dag voor die update (standaard 9).

Benodigde bot-permissies: `applications.commands` + `bot` met *Send Messages* en
*Read Message History* in het tracker-kanaal. Guild Members intent is niet nodig.

## Onderhoud

```bash
npm run sync    # seizoensdataset verversen vanaf de Overwatch Wiki
npm run smoke   # alle commands testen zonder Discord (data-laag)
```

Zet `npm run sync` in een wekelijkse taak (cron/Taakplanner): de wiki wordt bijgewerkt zodra
Blizzard een nieuw seizoen of de exacte einddatum aankondigt. De sync doet rustig aan
(1 request per seconde) en gebruikt alleen de MediaWiki API.

`npm run smoke` is de snelle controle: het draait elke command met een nep-interaction en
print de embed-velden, inclusief de datumberekening van het huidige seizoen.

## Bestanden

```
bot/
  index.js              gateway-client, command-router, dagelijkse countdown
  deploy-commands.js    slash commands registreren
  lib/overfast.js       OverFast API-client met cache (heroes, maps, spelers)
  lib/sync.js           wiki -> data/seasons.json
  lib/store.js          dataset inlezen
  lib/season.js         huidig seizoen, vensters, countdown, voortgang
  lib/embed.js          embeds en bronvermelding
  lib/format.js         Nederlandse datums, duur, voortgangsbalk
  commands/             één bestand per slash command
  data/seasons.json     gegenereerd door npm run sync
  test/smoke.js         rooktest zonder Discord
```

## Nog te doen (niet gebouwd)

* Discord *scheduled events* aanmaken voor seizoensstart/einde (vereist `Manage Events`).
* Notificatie bij een nieuw seizoen: de bot kan bij het starten vergelijken met de vorige dataset.
* Spelerstats per hero tonen (`/players/{id}/stats` van OverFast) - nu alleen profiel en ranks.
