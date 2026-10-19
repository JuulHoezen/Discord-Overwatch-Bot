# Live zetten zonder je eigen pc aan te laten staan

**Let op:** wil je het gratis en zonder creditcard, gebruik dan de
Cloudflare-variant in [../worker/README.md](../worker/README.md). Dat is de
route die geen enkele machine nodig heeft. De opties hieronder vragen een
VM/LXC/server (bij een hostingpartij meestal met creditcard).

**Discord host zelf geen bots.** Er is geen knop "deploy naar Discord". Je hebt twee smaken:

1. **Altijd-aan machine** (VPS, LXC, Raspberry Pi, NAS): het bestaande bot-project draait als
   dienst. Geen codewijziging nodig — dit is wat `install.sh` en de Docker-bestanden regelen.
2. **Serverless** (Cloudflare Workers, gratis): dan moet de bot omgebouwd worden van de
   Gateway naar HTTP-interactions met signature-verificatie. Dat is een verbouwing van de
   ingang, niet iets wat je even aanzet. Zeg het als je die route wil, dan bouw ik hem.

## Wat waar kan draaien

| Optie | Kosten | Werk | Opmerking |
| --- | --- | --- | --- |
| Bestaande VM/LXC bij 1KEY | waarschijnlijk niets | 10 min | verreweg de makkelijkste als jullie infra hebben |
| Oracle Cloud Always Free (Ampere A1) | gratis | 20 min | altijd-gratis VM, wel creditcard en soms gedoe met regio-capaciteit |
| Google Cloud e2-micro free tier | gratis | 20 min | gratis in een paar Amerikaanse regio's |
| Hetzner Cloud (CX22) | ca. €4/mnd | 10 min | in Duitsland/Finland, dus netjes binnen de EU |
| Fly.io | ca. €2-3/mnd | 10 min | gebruikt de `Dockerfile`; zet auto-stop uit, anders valt de verbinding weg |
| Raspberry Pi / NAS thuis of op kantoor | stroom | 15 min | prima voor één bot |

Voor een bot die alleen af en toe een bericht stuurt is de kleinste VM (1 vCPU, 512 MB-1 GB)
ruim genoeg.

## Route A — Linux-server met systemd (aanbevolen)

Eenmalig op een verse Debian/Ubuntu-server:

```bash
sudo apt update && sudo apt install -y git
sudo git clone https://github.com/JuulHoezen/Discord-Overwatch-Bot.git /opt/overwatch
cd /opt/overwatch
sudo bash deploy/install.sh
```

Het script installeert Node.js 22 als dat nodig is, maakt de gebruiker `owbot`, installeert
alleen productie-afhankelijkheden, zet de systemd-dienst `overwatch-bot` aan en zet een
wekelijkse sync in `/etc/cron.d/overwatch-sync`.

Daarna nog de sleutels erin (het script heeft een lege `.env` uit `.env.sample` gemaakt):

```bash
sudo nano /opt/overwatch/.env        # APP_ID, DISCORD_TOKEN, DISCORD_GUILD_ID, TRACKER_CHANNEL_ID
sudo chmod 600 /opt/overwatch/.env
sudo systemctl restart overwatch-bot
journalctl -u overwatch-bot -f       # live logs; je hoort "Ingelogd als ..." te zien
```

`install.sh` is aan te passen met omgevingsvariabelen, bijvoorbeeld
`sudo APP_DIR=/srv/overwatch SYNC_CRON="30 3 * * 1" bash deploy/install.sh`.

### Updates uitrollen

```bash
cd /opt/overwatch
sudo git pull
sudo npm ci --omit=dev
sudo systemctl restart overwatch-bot
```

Draait je repo privé? Dan heeft de server een deploy key of token nodig:

```bash
ssh-keygen -t ed25519 -f /root/.ssh/owbot -N ""
# zet /root/.ssh/owbot.pub als Deploy key (read-only) op de GitHub-repo
GIT_SSH_COMMAND="ssh -i /root/.ssh/owbot" sudo git clone git@github.com:JuulHoezen/Discord-Overwatch-Bot.git /opt/overwatch
```

## Route B — Docker

Op de server, in de projectmap:

```bash
docker compose up -d --build
docker compose logs -f
```

De `Dockerfile` gebruikt `node:22-alpine` en installeert alleen productie-dependencies
(geen nodemon, dus ook de audit-meldingen verdwijnen). `.env` gaat via `env_file` mee en
`./bot/data` is als volume gemount, zodat een sync bewaard blijft bij een rebuild.

Wekelijkse sync vanaf de host:

```cron
0 4 * * 0 cd /opt/overwatch && docker compose run --rm bot node bot/lib/sync.js
```

Let op: de Docker-bestanden zijn op deze machine **niet gebouwd of getest** (er staat geen
Docker op). `install.sh` en de bot zelf zijn dat wel.

## Als je de serverless route wil

Dan verandert het volgende:

* De bot luistert niet meer op de Gateway maar op een HTTPS-endpoint dat Discord aanroept
  (`/interactions`), met verificatie van de `X-Signature-Ed25519`-header.
* De slash commands worden als HTTP-interactions afgehandeld; de seizoensdata gaat in KV of
  in D1 in plaats van in `bot/data/seasons.json`.
* De dagelijkse countdown wordt een cron trigger in plaats van een `setTimeout`.

Voordeel: gratis, geen machine. Nadeel: geen Gateway, dus geen guild-events of presences, en
de antwoorden moeten binnen 3 seconden klaar zijn (voor `/player` en `/hero` is dat krap maar
haalbaar met cache).
