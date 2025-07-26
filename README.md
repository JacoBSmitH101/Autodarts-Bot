# Autodarts Discord Bot

This Discord bot bridges Autodarts live match data and Challonge tournaments so you can manage darts tournaments right from Discord. Built with Node.js (discord.js) and PostgreSQL.

## Key functions
- Register and manage Challonge tournaments via slash commands.
- Submit and view match results and statistics; get live match updates.
- Organize players: sign ups, drop outs and forfeits.
- See seeds, standings, and other tournament data.

## Limitations
- Early development: features are incomplete/unstable.
- Only Challonge tournaments are supported and results must still be entered on Challonge.
- Requires manual setup of a `.env` with Discord token, Autodarts credentials, Challonge API key and PostgreSQL details.
