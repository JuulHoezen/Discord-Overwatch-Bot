# Gateway-versie van de Overwatch-bot

De bot als gewoon Node-proces dat zelf verbinding maakt met Discord (discord.js).
Handig tijdens ontwikkelen, maar het proces moet blijven draaien: zet je pc uit,
dan antwoordt de bot niet meer. Voor "altijd aan zonder eigen machine" gebruik je
de Cloudflare-variant in [../worker/README.md](../worker/README.md) — die draait
dezelfde commands.

```bash
npm install
copy .env.sample .env      # APP_ID, DISCORD_TOKEN (+ optioneel guild- en kanaal-ID)
npm run deploy             # slash commands registreren
npm run bot                # starten
```

Optioneel in `.env`:

* `DISCORD_GUILD_ID` - commands alleen op die server zetten (verschijnen direct).
* `TRACKER_CHANNEL_ID` - kanaal waar de bot dagelijks de seizoenscountdown plaatst.
* `TRACKER_UUR` - uur van de dag voor die update (standaard 9).

Benodigde rechten: `applications.commands` + `bot` met *Send Messages* en
*Read Message History* in het tracker-kanaal. Guild Members intent is niet nodig.

## Commands

| Command | Wat het doet | Databron |
| --- | --- | --- |
| `/season [nummer]` | Huidig seizoen, looptijd, countdown, voortgang, nieuwe hero's/maps | Overwatch Wiki |
| `/seasons` | Alle seizoenen van de huidige story arc met status | Overwatch Wiki |
| `/event [seizoen] [alles]` | Events per seizoen, met datum waar de wiki die publiceert | Overwatch Wiki |
| `/hero [naam]` | Rol, subrol, hitpoints, abilities, perks (autocomplete) | OverFast API |
| `/map [naam]` | Gamemode, locatie, afbeelding (autocomplete) | OverFast API |
| `/player [battletag]` | Profiel, endorsement en competitive ranks per rol | OverFast API |
| `/owstatus` | Welke bronnen werken en hoe oud de data is | beide |

## Belangrijke beperking: seizoenen en events

Er is **geen officiële Blizzard-API** voor Overwatch-seizoenen of -events. De
OverFast API heeft die endpoints niet. Daarom komen seizoenen en events uit de
**Overwatch Wiki (Fandom, community-data)**, vastgelegd in
`bot/data/seasons.json` door `npm run sync`.

Gevolgen waar de bot eerlijk over is:

* Seizoen 5 van de arc "Reign of Talon" staat in de wiki als
  *6 oktober 2026 - december 2026*. Er is dus geen exacte einddag: de countdown
  rekent met de laatste dag van die maand en het veld heet dan ook
  "Loopt tot (uiterlijk)".
* Van de meeste events publiceert de wiki geen datum. De bot toont dan de
  eventnaam met "datum niet in de bron vermeld" in plaats van een verzonnen datum.
* Wijkt de wiki af van het spel, dan is de wiki fout.

## Onderhoud

```bash
npm run sync            # seizoensdata verversen (schrijft bot/data en worker/seed.js)
npm run smoke           # alle commands testen zonder Discord
npm run whereami        # server- en kanaal-ID's opzoeken
```

Zet `npm run sync` wekelijks in een cron/Taakplanner zolang je de Gateway-versie
gebruikt. Draai je de Worker, dan doet de cron `0 3 * * 0` dat automatisch.

## Bestanden

```
bot/
  index.js              gateway-client, command-router, dagelijkse countdown
  deploy-commands.js    slash commands registreren (JSON uit shared/)
  node-store.js         dataset uit bot/data/seasons.json
  sync.js               wiki -> bot/data/seasons.json (+ worker/seed.js)
  lib/inspect.js        hulpscript voor guild- en kanaal-ID's
  data/seasons.json     gegenereerde dataset
  test/smoke.js         rooktest zonder Discord
```

De commands en de datalaag staan in `../shared/` en worden door de Gateway-versie
én de Worker gebruikt.
