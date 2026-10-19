# Overwatch Discord-bot

Discord-bot met Overwatch-seizoenen, events, heroes, maps en spelersprofielen.

```bash
npm install
copy .env.sample .env     # vul APP_ID en DISCORD_TOKEN in
npm run deploy            # slash commands registreren
npm run bot               # bot starten
```

| Script | Wat het doet |
| --- | --- |
| `npm run bot` | bot starten (Discord Gateway, geen publieke URL nodig) |
| `npm run bot:dev` | idem met nodemon (herstart bij codewijziging) |
| `npm run deploy` | slash commands registreren bij Discord |
| `npm run sync` | seizoens- en eventdata verversen vanaf de Overwatch Wiki |
| `npm run smoke` | alle commands testen zonder Discord |

Commands: `/season`, `/seasons`, `/event`, `/hero`, `/map`, `/player`, `/owstatus`.

## Belangrijk

Er is **geen officiële Blizzard-API voor Overwatch-seizoenen en -events**. De OverFast API
levert heroes, maps, gamemodes en spelersprofielen; seizoenen en events komen uit de
**Overwatch Wiki (community-data)**. Zie [bot/README.md](bot/README.md) voor de details,
de beperkingen en het onderhoud.

De oude Discord-voorbeeldapp (`app.js`, `examples/`, HTTP-interactions) is uit deze map
verwijderd. Die is desgewenst terug te halen uit de git-historie:

```bash
git restore app.js commands.js game.js utils.js README.md renovate.json examples assets
```

Let op: die voorbeeldapp had `PUBLIC_KEY` in `.env` nodig voor interactie-verificatie.
Dat veld staat niet meer in `.env.sample`.
