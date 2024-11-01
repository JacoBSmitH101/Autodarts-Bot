const { default: axios } = require("axios");
const { EmbedBuilder, hyperlink, hideLinkEmbed } = require("discord.js")
const sqlite3 = require("sqlite3").verbose();

class MatchHandler {
    constructor(client) {
        //will store objects with:
        // {
        //     matchId: "xxx",
        //     live_discord_interaction: null,
        //     challonge_match_id: "xxx",
        //     challonge_tournament_id: "xxx",
        // }
        this.ongoing_matches = [];
        this.client = client;
    }

    async match_update(message, tournamentId) {
        //example message:
        // {
        //     channel: 'autodarts.matches',
        //     topic: 'e1fe54a4-a490-4a00-b044-6db05461ae72.state',
        //     data: {
        //       chalkboards: [ [Object] ],
        //       createdAt: '2024-11-01T17:38:03.017763769Z',
        //       finished: false,
        //       gameFinished: false,
        //       gameScores: [ 481 ],
        //       gameWinner: -1,
        //       host: {
        //         avatarUrl: 'https://gravatar.com/avatar/4d1948cf7119b42303e2db099be1efcd',
        //         average: 32.85029069767442,
        //         country: 'gb',
        //         id: 'bb229295-742d-429f-bbbf-fe4a179ef537',
        //         name: 'yakoob19',
        //         userSettings: [Object]
        //       },
        //       id: 'e1fe54a4-a490-4a00-b044-6db05461ae72',
        //       leg: 1,
        //       player: 0,
        //       players: [ [Object] ],
        //       round: 1,
        //       scores: [ [Object] ],
        //       set: 1,
        //       settings: {
        //         baseScore: 501,
        //         bullMode: '25/50',
        //         gameId: '00000000-0000-0000-0000-000000000000',
        //         inMode: 'Straight',
        //         maxRounds: 80,
        //         outMode: 'Double'
        //       },
        //       state: { checkoutGuide: null },
        //       stats: [ [Object] ],
        //       turnBusted: false,
        //       turnScore: 20,
        //       turns: [ [Object] ],
        //       type: 'Local',
        //       variant: 'X01',
        //       winner: -1
        //     }
        //   }
        const matchId = message.data.id;
        //associate this match with a match in the database via player ids
        const players = message.data.players;
        //first check if the match is already being tracked
        const match = this.ongoing_matches.find(match => match.matchId === matchId);
        if (match) {
            //update the match
            //TODO
            console.log(message)

            this.updateMatch(matchId, message);
        } else {
            //add the match
            console.log(message.data.scores)
            this.addMatch(matchId, message);
        }
        //TODO in actual implementation, will ensure that both players in game have a match against eachother, for testing just check if it is me
    }
    async updateMatch(matchId, message) {
        //basically just edit the interaction message with the new scores
        const match = this.ongoing_matches.find(match => match.matchId === matchId);
        const player1_score = message.data.gameScores[0];
        const player2_score = message.data.gameScores[1];
        const player1_legs = message.data.scores[0].legs
        const player2_legs = message.data.scores[1].legs
        const player1_name = message.data.players[0].name;
        const player2_name = message.data.players[1].name;
        const matchUrl = `https://play.autodarts.io/matches/${matchId}`;
        
        const interaction = match.live_discord_interaction;

        if (message.data.winner !== -1) {
            // Match is finished
            const embed = new EmbedBuilder()
                .setTitle("🎯 League Match Finished")
                .setDescription(`The match has concluded!`)
                .setColor(0xff0000) // Red color for finished match
                .setTimestamp()
                .addFields(
                    // Player names and match status
                    { name: `${player1_name}`, value: `${player1_score}`, inline: true },
                    { name: "VS", value: `${player1_legs} - ${player2_legs}`, inline: true },
                    { name: `${player2_name}`, value: `${player2_score}`, inline: true }, 
                    { name: "Match concluded!", value: `[View match on Autodarts](${matchUrl})`, inline: false }
                )

            // Update message
            interaction.edit({ embeds: [embed] });
            console.log(this.client.keycloakClient.accessToken)
            //get stats
            setTimeout(this.checkIfMatchFinished, 30000, matchId, this.client);

            return;
        } 

        if (interaction) {
            const embed = new EmbedBuilder()
            .setTitle("🎯 League Match In Progress")
            .setDescription(`Follow the live score and progress!`)
            .setColor(0x00ff00) // Green color for active match
            .setTimestamp()
            .addFields(
                // Player names and match status
                { name: `${player1_name}`, value: `${player1_score}`, inline: true },
                { name: " VS ", value: `${player1_legs} - ${player2_legs}`, inline: true },
                { name: `${player2_name}`, value: `${player2_score}`, inline: true }, 
                { name: "Follow along!", value: `[Watch match on Autodarts](${matchUrl})`, inline: false }
            )

            // Update message
            interaction.edit({ embeds: [embed] });
        } else {
            console.log("Interaction not found");
        }
        
    }
    async addMatch(matchId, message, tournamentId) {
        console.log(message)
        if (message.data.variant != "X01") {return}
        const players = message.data.players;
        //TODO associate with challonge match id
        this.ongoing_matches.push({
            matchId: matchId,
            players: players,
            live_discord_interaction: null,
            challonge_tournament_id: tournamentId,
            challonge_match_id: null
        });

        //get player names
        const player1_name = players[0].name;
        const player2_name = players[1].name;

        //get player scores
        const player1_score = message.data.gameScores[0];
        const player2_score = message.data.gameScores[1];

        const player1_legs = message.data.scores[0].legs
        const player2_legs = message.data.scores[1].legs

        //get match state
        let matchState = "In Progress";
        let matchDate = new Date().toLocaleDateString();
        
        const matchUrl = `https://play.autodarts.io/matches/${matchId}`;
        const link = hyperlink("Goto match", matchUrl);
        //create interaction and store it in live_discord_interaction
        const channel = this.client.channels.cache.get("1295486855378108515");
        if (channel) {
            const embed = new EmbedBuilder()
            .setTitle("🎯 League Match In Progress")
            .setDescription(`Follow the live score and progress!`)
            .setColor(0x00ff00) // Green color for active match
            .setTimestamp()
            .addFields(
                // Player names and match status
                { name: `${player1_name}`, value: `${player1_score}`, inline: true },
                { name: " VS ", value: `${player1_legs} - ${player2_legs}`, inline: true },
                { name: `${player2_name}`, value: `${player2_score}`, inline: true }, 
                { name: "Follow along!", value: `[Watch match on Autodarts](${matchUrl})`, inline: false }
            )
        
            // Send message and update ongoing match with Discord message object
            const message = await channel.send({ embeds: [embed] });
            this.ongoing_matches.find(match => match.matchId === matchId).live_discord_interaction = message;
        } else {
            console.log("Channel not found");
        }
        
    }
    async processFinishedMatch(matchId, stats, client) {
        //get match 
        const match = this.ongoing_matches.find(match => match.matchId === matchId);
        const db = new sqlite3.Database("./data.db", (err) => {
            if (err) {
                console.error("Database connection error:", err.message);
                return interaction.reply("Failed to connect to the database.");
            }
        });

        const player1_id = stats.players[0].id;
        const player2_id = stats.players[1].id;

        //use user table to get user_ids
        const player1_user_id = await new Promise((resolve, reject) => {
            db.get(
                `SELECT user_id FROM Users WHERE autodarts_id = ?`,
                [player1_id],
                (err, row) => {
                    if (err)
                        return reject(
                            "Failed to retrieve player1's user_id."
                        );
                    resolve(row ? row.user_id : null);
                }
            );
        });
        const player2_user_id = await new Promise((resolve, reject) => {
            db.get(
                `SELECT user_id FROM Users WHERE autodarts_id = ?`,
                [player2_id],
                (err, row) => {
                    if (err)
                        return reject(
                            "Failed to retrieve player2's user_id."
                        );
                    resolve(row ? row.user_id : null);
                }
            );
        });

        //use participants table to get challonge_ids using user_ids and tournament_id
        const player1_challonge_id = await new Promise((resolve, reject) => {
            db.get(
                `SELECT challonge_id FROM Participants WHERE user_id = ? AND tournament_id = ?`,
                [player1_user_id, match.challonge_tournament_id],
                (err, row) => {
                    if (err)
                        return reject(
                            "Failed to retrieve player1's challonge_id."
                        );
                    resolve(row ? row.challonge_id : null);
                }
            );
        });
        const player2_challonge_id = await new Promise((resolve, reject) => {
            db.get(
                `SELECT challonge_id FROM Participants WHERE user_id = ? AND tournament_id = ?`,
                [player2_user_id, match.challonge_tournament_id],
                (err, row) => {
                    if (err)
                        return reject(
                            "Failed to retrieve player2's challonge_id."
                        );
                    resolve(row ? row.challonge_id : null);
                }
            );
        });
        
        //use matches table to get challonge_match_id using challonge_ids and tournament_id
        //keep in mind that it is possible player1_id in the match is player_2 that we are using here
        let db_match = await new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM Matches 
                WHERE tournament_id = ? 
                AND ((player1_id = ? AND player2_id = ?) 
                OR (player1_id = ? AND player2_id = ?))`,
                [
                    match.challonge_tournament_id,
                    player1_challonge_id,
                    player2_challonge_id,
                    player2_challonge_id,
                    player1_challonge_id,
                ],
                (err, row) => {
                    if (err)
                        return reject("Failed to retrieve match details.");
                    resolve(row);
                }
            );
        });

        const winnderIndex = stats.winner; //0 is player1, 1 is player2
        const winnerId = winnderIndex === 0 ? player1_user_id : player2_user_id;
        const winnerChallongeId = winnderIndex === 0 ? player1_challonge_id : player2_challonge_id;

        //update match in database (winner_id, state, player1_score, player2_score(use legs), autodarts_match_id)
        db.run(
            `UPDATE Matches 
            SET winner_id = ?, state = ?, player1_score = ?, player2_score = ?, autodarts_match_id = ?
            WHERE match_id = ?`,
            [winnerId, "completed", stats.scores[0].legs, stats.scores[1].legs, matchId, db_match.match_id],
            (err) => {
                if (err) {
                    console.error("Error updating match:", err);
                    return interaction.reply("Failed to update match.");
                }
            }
        );

        //need to create scores-csv for challonge, will just be eg 4-3. got to organise based on if db_match.player1_id is player1_id or not
        //first check if db_match.player1_id player1_challonge_id
        let scores_csv;
        if (db_match.player1_id === player1_challonge_id) {
            scores_csv = `${stats.scores[0].legs}-${stats.scores[1].legs}`;
        } else {
            scores_csv = `${stats.scores[1].legs}-${stats.scores[0].legs}`;
        }

        //set winner_id 
        let winner_id;
        if (stats.winner === 0) {
            winner_id = db_match.player1_id;
        } else {
            winner_id = db_match.player2_id;
        }



        //update challonge
        const api_url = `https://api.challonge.com/v1/tournaments/${match.challonge_tournament_id}/matches/${db_match.match_id}.json`;
        const params = {
            api_key: process.env.API_KEY
        }
        const data = {
            match: {
                scores_csv: score_csv,
                winner_id: winner_id
            }
        }

        try {
            const response = await axios.put(api_url, data, { params });
            if (response.status === 200) {
                console.log("Challonge match updated");
            }
        }
        catch (error) {
            console.error("Error updating challonge match:", error);
        }



    }
    async checkIfMatchFinished(matchId, client) { 
        //when not using a matchmode as a draw can happen in the league but not with autodarts
        //, there is no event when the match is manually ended
        //this will be called 30 seconds after the last update involving a leg winner to check if the match is finished
        const matchStatsUrl = `https://api.autodarts.io/as/v0/matches/${matchId}/stats`;
            const headers = {
                Authorization: `Bearer ${client.keycloakClient.accessToken}`
            }
        let stats;
        try {
            stats = await axios.get(matchStatsUrl, { headers });
            console.log(stats.data)
        } catch (error) {
            console.error("Match not finished:");
            return;
        }
        //if it makes it here, the match is finished
        this.processFinishedMatch(matchId, stats, client);
        //example stats object:
        // {
        //     id: '63a752fb-a94d-49f9-947c-6f3b1146d32d',
        //     createdAt: '2024-11-01T19:56:23.90161Z',
        //     finishedAt: '2024-11-01T19:57:54.740281Z',
        //     host: {
        //       id: 'bb229295-742d-429f-bbbf-fe4a179ef537',
        //       name: 'yakoob19',
        //       avatarUrl: 'https://gravatar.com/avatar/4d1948cf7119b42303e2db099be1efcd',
        //       userSettings: {
        //         showCheckoutGuide: true,
        //         countEachThrow: true,
        //         showChalkboard: false,
        //         showAnimations: true,
        //         caller: '',
        //         callScores: true,
        //         callCheckouts: true
        //       },
        //       country: 'gb',
        //       average: 33.23438685208597
        //     },
        //     scores: [ { sets: 0, legs: 0 }, { sets: 0, legs: 2 } ],
        //     variant: 'X01',
        //     players: [
        //       {
        //         id: '9c442b73-408a-438e-a15a-01b25becaaa3',
        //         index: 0,
        //         userId: 'bb229295-742d-429f-bbbf-fe4a179ef537',
        //         name: 'yakoob19',
        //         avatarUrl: 'https://gravatar.com/avatar/4d1948cf7119b42303e2db099be1efcd',
        //         hostId: 'bb229295-742d-429f-bbbf-fe4a179ef537',
        //         host: [Object],
        //         boardId: '22c910e2-0f19-4c65-9098-40edd2befaa0',
        //         cpuPPR: null
        //       },
        //       {
        //         id: '215b12a0-d314-4700-bfbe-a2344e30a1bf',
        //         index: 1,
        //         userId: null,
        //         name: 'Bot Level 11',
        //         avatarUrl: '',
        //         hostId: 'bb229295-742d-429f-bbbf-fe4a179ef537',
        //         host: [Object],
        //         cpuPPR: 120
        //       }
        //     ],
        //     targetSets: null,
        //     targetLegs: null,
        //     hostId: 'bb229295-742d-429f-bbbf-fe4a179ef537',
        //     winner: 1,
        //     games: [
        //       {
        //         id: 'f074b99b-dca4-4d10-aca7-fca512888895',
        //         matchId: '63a752fb-a94d-49f9-947c-6f3b1146d32d',
        //         createdAt: '2024-11-01T19:56:29.063113Z',
        //         finishedAt: '2024-11-01T19:57:37.941494Z',
        //         set: 0,
        //         leg: 0,
        //         variant: 'X01',
        //         winner: 0,
        //         winnerPlayerId: '215b12a0-d314-4700-bfbe-a2344e30a1bf',
        //         scores: [Array],
        //         turns: [Array],
        //         settings: [Object]
        //       },
        //       {
        //         id: 'dc98fb96-608a-4e3f-ad32-4443f0972261',
        //         matchId: '63a752fb-a94d-49f9-947c-6f3b1146d32d',
        //         createdAt: '2024-11-01T19:57:37.941494Z',
        //         finishedAt: '2024-11-01T19:57:54.740281Z',
        //         set: 0,
        //         leg: 1,
        //         variant: 'X01',
        //         winner: 1,
        //         winnerPlayerId: '215b12a0-d314-4700-bfbe-a2344e30a1bf',
        //         scores: [Array],
        //         turns: [Array],
        //         settings: [Object]
        //       }
        //     ],
        //     duration: '1m31s',
        //     totalLegs: 2,
        //     totalSets: 1,
        //     settings: {
        //       baseScore: 121,
        //       bullMode: '25/50',
        //       gameId: '00000000-0000-0000-0000-000000000000',
        //       inMode: 'Straight',
        //       maxRounds: 80,
        //       outMode: 'Double'
        //     },
        //     matchStats: [
        //       {
        //         setsWon: 0,
        //         set: 0,
        //         legsWon: 0,
        //         gameId: '00000000-0000-0000-0000-000000000000',
        //         playerId: '9c442b73-408a-438e-a15a-01b25becaaa3',
        //         dartsThrown: 12,
        //         average: 53,
        //         first9Average: 53,
        //         checkouts: 3,
        //         checkoutPoints: 0,
        //         less60: 2,
        //         plus60: 2,
        //         plus100: 0,
        //         plus140: 0,
        //         plus170: 0,
        //         total180: 0,
        //         score: 0,
        //         first9Score: 0,
        //         averageUntil170: 0,
        //         dartsUntil170: 0,
        //         scoreUntil170: 0,
        //         checkoutsHit: 0,
        //         checkoutPercent: 0,
        //         checkoutPointsAverage: 0
        //       },
        //       {
        //         setsWon: 0,
        //         set: 0,
        //         legsWon: 2,
        //         gameId: '00000000-0000-0000-0000-000000000000',
        //         playerId: '215b12a0-d314-4700-bfbe-a2344e30a1bf',
        //         dartsThrown: 12,
        //         average: 60.5,
        //         first9Average: 60.5,
        //         checkouts: 5,
        //         checkoutPoints: 40,
        //         less60: 3,
        //         plus60: 2,
        //         plus100: 0,
        //         plus140: 0,
        //         plus170: 0,
        //         total180: 0,
        //         score: 0,
        //         first9Score: 0,
        //         averageUntil170: 0,
        //         dartsUntil170: 0,
        //         scoreUntil170: 0,
        //         checkoutsHit: 2,
        //         checkoutPercent: 0.4,
        //         checkoutPointsAverage: 0
        //       }
        //     ],
        //     setStats: null,
        //     legStats: [
        //       {
        //         stats: [Array],
        //         playerIndices: [Array],
        //         winner: 1,
        //         set: 1,
        //         leg: 1
        //       },
        //       {
        //         stats: [Array],
        //         playerIndices: [Array],
        //         winner: 1,
        //         set: 1,
        //         leg: 2
        //       }
        //     ]
        //   }

    }
}

module.exports = MatchHandler;