# Overwatch Discord-bot

Discord-bot met Overwatch-seizoenen, events, heroes, maps en spelersprofielen.

**Draait gratis op Cloudflare Workers** (geen creditcard, geen machine die aan
moet blijven) of als gewone bot via de Discord Gateway.

```bash
npm install
copy .env.sample .env     # vul APP_ID en DISCORD_TOKEN in
npm run deploy            # slash commands registreren bij Discord
```

| Route | Commands | Draaien |
| --- | --- | --- |
| Cloudflare Worker (aanbevolen, gratis) | dezelfde 7 | zie [worker/README.md](worker/README.md) |
| Gateway-bot (lokaal of op een server) | dezelfde 7 | `npm run bot`, of [deploy/README.md](deploy/README.md) |

Commands: `/season`, `/seasons`, `/event`, `/hero`, `/map`, `/player`, `/owstatus`.

| Script | Wat het doet |
| --- | --- |
| `npm run worker:deploy` | uitrollen naar Cloudflare |
| `npm run worker:dev` | worker lokaal draaien op localhost:8787 |
| `npm run smoke:worker` | worker testen zonder Cloudflare of Discord |
| `npm run bot` | Gateway-versie starten |
| `npm run deploy` | slash commands registreren |
| `npm run sync` | seizoensdata verversen vanaf de Overwatch Wiki |
| `npm run smoke` | alle commands testen zonder Discord |
| `npm run whereami` | server- en kanaal-ID's opzoeken voor .env |

## Mappen

```
shared/     de commands en datalaag - door beide versies gebruikt
bot/        Gateway-versie (discord.js), sync-CLI en de countdown-taak
worker/     Cloudflare Worker: HTTP-interactions + crons
deploy/     systemd/Docker voor als je hem op een eigen server zet
```

## Belangrijk

Er is **geen officiële Blizzard-API voor Overwatch-seizoenen en -events**. De
OverFast API levert heroes, maps, gamemodes en spelersprofielen; seizoenen en
events komen uit de **Overwatch Wiki (community-data)**. Zie
[bot/README.md](bot/README.md) voor de details en de beperkingen.

De oude Discord-voorbeeldapp die in deze map zat (`app.js`, `examples/`,
`assets/`) staat nog in de git-historie, maar wordt nergens meer gebruikt.
