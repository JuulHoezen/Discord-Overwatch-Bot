# Cloudflare Worker-versie (gratis, geen machine nodig)

Dit is de bot zonder altijd-aan proces: Discord stuurt de slash commands als
HTTP-request naar deze Worker in plaats van dat jouw proces een verbinding
openhoudt. Gratis tier, **geen creditcard nodig**.

Het is geen tweede codebase: de commands en de datalaag komen uit `shared/`,
exact dezelfde bestanden die de Gateway-versie in `bot/` gebruikt.

## Eenmalig instellen

```bash
# 1. Inloggen bij Cloudflare (gratis account, geen kaart)
npx wrangler login

# 2. Opslag voor de seizoensdata
npx wrangler kv namespace create DATA
#    -> plak de id in wrangler.toml en haal het commentaar bij [[kv_namespaces]] weg

# 3. Geheimen (wrangler vraagt om de waarde)
npx wrangler secret put DISCORD_TOKEN   # Bot-token uit het Developer Portal
npx wrangler secret put PUBLIC_KEY      # General Information > Public Key
npx wrangler secret put CRON_SLEUTEL    # verzin een lang wachtwoord

# 4. Uitrollen
npm run worker:deploy
```

Wrangler print daarna een URL als
`https://overwatch-bot.<jouw-subdomein>.workers.dev`.

```bash
# 5. Zet die URL + /interactions in het Developer Portal:
#    General Information > Interactions Endpoint URL
#    https://overwatch-bot.<jouw-subdomein>.workers.dev/interactions
#
#    Discord stuurt meteen een PING. Verschijnt er geen foutmelding, dan is de
#    URL en de signature-verificatie goedgekeurd. Vergeet niet op te slaan.

# 6. Countdown meteen plaatsen in TRACKER_CHANNEL_ID (niet wachten op de cron)
curl -X POST "https://overwatch-bot.<jouw-subdomein>.workers.dev/cron?taak=tracker" \
     -H "x-cron-sleutel: <CRON_SLEUTEL>"
```

Daarna test je in Discord: `/owstatus` (staan beide databronnen online?) en
`/season`. Je hoeft je pc niet aan te laten.

## Wat er draait

| Route | Wat het doet |
| --- | --- |
| `GET /` | health-check: status, commandlijst, of KV gekoppeld is |
| `POST /interactions` | alle slash commands en autocomplete (Discord roept dit aan) |
| `POST /cron?taak=tracker` | countdown nu verversen (vereist `x-cron-sleutel`) |
| `POST /cron?taak=sync` | seizoensdata nu verversen vanaf de wiki + countdown |
| cron `0 7 * * *` | dagelijkse countdown-update (07:00 UTC = 09:00 in de zomer) |
| cron `0 3 * * 0` | wekelijkse sync van de wiki naar KV |

## Ontwikkelen en testen

```bash
npm run smoke:worker    # 21 checks: signature, PING, commands, autocomplete, crons
npm run worker:dev      # lokale server op http://localhost:8787
```

`smoke:worker` genereert zijn eigen Ed25519-sleutelpaar en doet alsof dat de
public key van je app is, dus de echte signature-verificatie wordt getest.
Verkeer naar discord.com wordt onderschept; OverFast en de wiki gaan echt over
de lijn.

## Grenzen van de gratis tier (en wat ik daarom anders deed)

* 100.000 requests per dag, 5 cron triggers per account — ruim voldoende.
* 10 ms CPU per aanroep. Daarom slaat de cron-sync de eventpagina's over en
  neemt hij bestaande eventdatums over uit de vorige dataset. Loopt de sync
  ooit tegen de CPU-limiet aan, dan zie je dat in het logboek; als alternatief
  draai je `npm run sync` lokaal en commit je `bot/data/seasons.json`
  (dan zit de data in de meegebouwde `worker/seed.js`).
* KV heeft geen last van die CPU-limiet: de wekelijkse sync schrijft de volledige
  dataset (een paar kB).

## De Gateway-versie blijft bestaan

`npm run bot` start nog steeds de discord.js-variant met dezelfde commands. Die
werkt handig tijdens ontwikkelen. Let op: laat niet beide tegelijk het
countdown-bericht beheren, dan zie je ze om de beurt hetzelfde bericht aanpassen.
