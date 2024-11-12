const { default: axios, get } = require("axios");
const {
    EmbedBuilder,
    hyperlink,
    hideLinkEmbed,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require("discord.js");
const {
    getUserIdFromAutodartsId,
    getChallongeIdFromUserIdTournamentId,
    getLocalMatchFromPlayersChallongeIdTournamentId,
    updateLocalMatch,
    updateStats,
} = require("./testdatamanager");
const sqlite3 = require("sqlite3").verbose();

class MatchHandler {
    constructor(client) {
        console.log("MatchHandler initialized");
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

    async match_event(message, tournamentId) {
        //usually only event is finish which is what we want
        //message.data.event will be "finish" once done
        //will also get "start" but no updates in mid match
        //example message:
        //         {
        //   "channel": "autodarts.matches",
        //   "topic": "312ae6dc-96c3-4599-b74c-75fe459ef97b.events",
        //   "data": {
        //     "body": {
        //       "createdAt": "2024-11-12T20:21:17.308170655Z",
        //       "host": {
        //         "avatarUrl": "https://gravatar.com/avatar/e7588cb671c8a650412eeb7f81b254a3",
        //         "average": 109.41118421052632,
        //         "country": "",
        //         "id": "8204cedf-615a-464e-be16-7bbd82c9dc8e",
        //         "name": "jacobsmith31105@gmail.com",
        //         "userSettings": {
        //           "callCheckouts": true,
        //           "callScores": true,
        //           "caller": "",
        //           "countEachThrow": true,
        //           "showAnimations": true,
        //           "showChalkboard": false,
        //           "showCheckoutGuide": true
        //         }
        //       },
        //       "id": "312ae6dc-96c3-4599-b74c-75fe459ef97b",
        //       "players": [
        //         {
        //           "avatarUrl": "https://gravatar.com/avatar/e7588cb671c8a650412eeb7f81b254a3",
        //           "cpuPPR": null,
        //           "host": {
        //             "avatarUrl": "https://gravatar.com/avatar/e7588cb671c8a650412eeb7f81b254a3",
        //             "average": 109.41118421052632,
        //             "country": "",
        //             "id": "8204cedf-615a-464e-be16-7bbd82c9dc8e",
        //             "name": "jacobsmith31105@gmail.com",
        //             "userSettings": {
        //               "callCheckouts": true,
        //               "callScores": true,
        //               "caller": "",
        //               "countEachThrow": true,
        //               "showAnimations": true,
        //               "showChalkboard": false,
        //               "showCheckoutGuide": true
        //             }
        //           },
        //           "hostId": "8204cedf-615a-464e-be16-7bbd82c9dc8e",
        //           "id": "036793a2-7731-40e1-ae56-c32910ea055d",
        //           "index": 0,
        //           "name": "jacobsmith31105@gmail.com",
        //           "user": {
        //             "avatarUrl": "https://gravatar.com/avatar/e7588cb671c8a650412eeb7f81b254a3",
        //             "average": 109.41118421052632,
        //             "country": "",
        //             "id": "8204cedf-615a-464e-be16-7bbd82c9dc8e",
        //             "name": "jacobsmith31105@gmail.com",
        //             "userSettings": {
        //               "callCheckouts": true,
        //               "callScores": true,
        //               "caller": "",
        //               "countEachThrow": true,
        //               "showAnimations": true,
        //               "showChalkboard": false,
        //               "showCheckoutGuide": true
        //             }
        //           },
        //           "userId": "8204cedf-615a-464e-be16-7bbd82c9dc8e"
        //         },
        //         {
        //           "avatarUrl": "https://gravatar.com/avatar/4d1948cf7119b42303e2db099be1efcd",
        //           "boardId": "22c910e2-0f19-4c65-9098-40edd2befaa0",
        //           "boardName": "Bedroom",
        //           "cpuPPR": null,
        //           "host": {
        //             "avatarUrl": "https://gravatar.com/avatar/4d1948cf7119b42303e2db099be1efcd",
        //             "average": 37.47540983606557,
        //             "country": "gb",
        //             "id": "bb229295-742d-429f-bbbf-fe4a179ef537",
        //             "name": "yakoob19",
        //             "userSettings": {
        //               "callCheckouts": true,
        //               "callScores": true,
        //               "caller": "",
        //               "countEachThrow": true,
        //               "showAnimations": true,
        //               "showChalkboard": false,
        //               "showCheckoutGuide": true
        //             }
        //           },
        //           "hostId": "bb229295-742d-429f-bbbf-fe4a179ef537",
        //           "id": "9326d191-0b22-4254-8b58-74a731710dc3",
        //           "index": 1,
        //           "name": "yakoob19",
        //           "user": {
        //             "avatarUrl": "https://gravatar.com/avatar/4d1948cf7119b42303e2db099be1efcd",
        //             "average": 37.47540983606557,
        //             "country": "gb",
        //             "id": "bb229295-742d-429f-bbbf-fe4a179ef537",
        //             "name": "yakoob19",
        //             "userSettings": {
        //               "callCheckouts": true,
        //               "callScores": true,
        //               "caller": "",
        //               "countEachThrow": true,
        //               "showAnimations": true,
        //               "showChalkboard": false,
        //               "showCheckoutGuide": true
        //             }
        //           },
        //           "userId": "bb229295-742d-429f-bbbf-fe4a179ef537"
        //         }
        //       ],
        //       "scores": [
        //         {
        //           "legs": 1,
        //           "sets": 0
        //         },
        //         {
        //           "legs": 0,
        //           "sets": 0
        //         }
        //       ],
        //       "settings": {
        //         "baseScore": 121,
        //         "bullMode": "25/50",
        //         "gameId": "00000000-0000-0000-0000-000000000000",
        //         "inMode": "Straight",
        //         "maxRounds": 80,
        //         "outMode": "Double"
        //       },
        //       "type": "Local",
        //       "variant": "X01"
        //     },
        //     "event": "finish",
        //     "id": "312ae6dc-96c3-4599-b74c-75fe459ef97b"
        //   }
        // }
        console.log(message);
        if (message.data.event === "finish") {
            //match is finished, no need to check if it is finished
            if (process.env.DEBUG === "true") {
                console.log("Match is finished");
            }
            this.checkIfMatchFinished(message.data.id, this.client);
        }
        if (message.data.event === "start") {
            //match is starting, no need to check if it is finished
            if (process.env.DEBUG === "true") {
                console.log("Match is starting");
            }
        }
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
        const match = this.ongoing_matches.find(
            (match) => match.matchId === matchId
        );
        if (match) {
            //update the matc
            this.updateMatch(matchId, message);
        } else {
            //add the match
            console.log(message.data.scores);
            this.addMatch(matchId, message, tournamentId);
        }
    }
    async updateMatch(matchId, message) {
        //basically just edit the interaction message with the new scores
        let match = this.ongoing_matches.find(
            (match) => match.matchId === matchId
        );
        const player1_score = message.data.gameScores[0];
        const player2_score = message.data.gameScores[1];
        const player1_legs = message.data.scores[0].legs;
        const player2_legs = message.data.scores[1].legs;
        const player1_name = message.data.players[0].name;
        const player2_name = message.data.players[1].name;
        const matchUrl = `https://play.autodarts.io/matches/${matchId}`;

        const interaction = match.live_discord_interaction;
        const throwingPlayer = message.data.player;

        const round = message.data.round;
        //number of items in message.data.turns is the number of throws in the current round
        const throwsThisRound = message.data.turns[0].throws.length || 0;
        //darts thrown is round * 3 + throwsThisRound
        const dartsThrown = (round - 1) * 3 + throwsThisRound;
        if (interaction) {
            const embed = new EmbedBuilder()
                .setTitle("🎯 League Match In Progress")
                .setDescription(`Follow the live score and progress!`)
                .setColor(0x00ff00) // Green color for active match
                .setTimestamp()
                .addFields(
                    // Player names and match status
                    {
                        name: `${
                            throwingPlayer == 0 ? "*" : ""
                        }${player1_name}`,
                        value: `${player1_score}(${
                            throwingPlayer == 0 ? dartsThrown : round * 3
                        })`,
                        inline: true,
                    },
                    {
                        name: " VS ",
                        value: `${player1_legs} - ${player2_legs}`,
                        inline: true,
                    },
                    {
                        name: `${
                            throwingPlayer == 1 ? "*" : ""
                        }${player2_name}`,
                        value: `${player2_score}(${
                            throwingPlayer == 1 ? dartsThrown : (round - 1) * 3
                        })`,
                        inline: true,
                    },
                    {
                        name: "Follow along!",
                        value: `[Watch match on Autodarts](${matchUrl})`,
                        inline: false,
                    }
                );

            // Update message
            interaction.edit({ embeds: [embed] });
        } else {
            console.log("Interaction not found");
        }
    }
    async addMatch(matchId, message, tournamentId) {
        //double check matchId is not already being tracked
        if (message.data.variant != "X01") {
            return;
        }
        const players = message.data.players;
        console.log(players);
        //associate with challonge match id

        //get user_id from users table using autodarts_id
        const player1_id = players[0].userId;
        const player2_id = players[1].userId;

        const player1_user_id = await getUserIdFromAutodartsId(player1_id);

        const player2_user_id = await getUserIdFromAutodartsId(player2_id);
        console.log(tournamentId);
        console.log(player1_user_id);
        //use participants table to get challonge_ids using user_ids and tournament_id
        const player1_challonge_id = await getChallongeIdFromUserIdTournamentId(
            player1_user_id,
            tournamentId
        );
        const player2_challonge_id = await getChallongeIdFromUserIdTournamentId(
            player2_user_id,
            tournamentId
        );

        //then find the match in the matches table using the challonge_ids and tournament_id
        let db_match = await getLocalMatchFromPlayersChallongeIdTournamentId(
            player1_challonge_id,
            player2_challonge_id,
            tournamentId
        );

        this.ongoing_matches.push({
            matchId: matchId,
            players: players,
            live_discord_interaction: null,
            challonge_tournament_id: tournamentId,
            challonge_match_id: db_match.match_id,
            checking: false,
        });

        //instead update not add
        //get player names
        const player1_name = players[0].name;
        const player2_name = players[1].name;

        //get player scores
        const player1_score = message.data.gameScores[0];
        const player2_score = message.data.gameScores[1];

        const player1_legs = message.data.scores[0].legs;
        const player2_legs = message.data.scores[1].legs;

        //get match state
        let matchState = "In Progress";
        let matchDate = new Date().toLocaleDateString();

        const matchUrl = `https://play.autodarts.io/matches/${matchId}`;
        const link = hyperlink("Goto match", matchUrl);
        //create interaction and store it in live_discord_interaction
        const channel = this.client.channels.cache.get(
            process.env.LIVE_MATCHES_CHANNEL_ID
        );
        //currently throwing player is message.data.player 0 for player1 and 1 for player2
        const throwingPlayer = message.data.player;
        if (channel) {
            const embed = new EmbedBuilder()
                .setTitle("🎯 League Match In Progress")
                .setDescription(`Follow the live score and progress!`)
                .setColor(0x00ff00) // Green color for active match
                .setTimestamp()
                .addFields(
                    // Player names and match status
                    {
                        name: `${
                            throwingPlayer == 0 ? "*" : ""
                        }${player1_name}`,
                        value: `${player1_score}`,
                        inline: true,
                    },
                    {
                        name: " VS ",
                        value: `${player1_legs} - ${player2_legs}`,
                        inline: true,
                    },
                    {
                        name: `${
                            throwingPlayer == 1 ? "*" : ""
                        }${player2_name}`,
                        value: `${player2_score}`,
                        inline: true,
                    },
                    {
                        name: "Follow along!",
                        value: `[Watch match on Autodarts](${matchUrl})`,
                        inline: false,
                    }
                );

            // Send message and update ongoing match with Discord message object
            const message = await channel.send({ embeds: [embed] });
            this.ongoing_matches.find(
                (match) => match.matchId === matchId
            ).live_discord_interaction = message;
        } else {
            console.log("Channel not found");
        }
    }
    async processFinishedMatch(matchId, stats, client) {
        //get match
        const match = this.ongoing_matches.find(
            (match) => match.matchId === matchId
        );

        const player1_id = stats.players[0].userId;
        const player2_id = stats.players[1].userId;

        //use user table to get user_ids
        const player1_user_id = await getUserIdFromAutodartsId(player1_id);
        const player2_user_id = await getUserIdFromAutodartsId(player2_id);

        //use participants table to get challonge_ids using user_ids and tournament_id
        const player1_challonge_id = await getChallongeIdFromUserIdTournamentId(
            player1_user_id,
            match.challonge_tournament_id
        );
        const player2_challonge_id = await getChallongeIdFromUserIdTournamentId(
            player2_user_id,
            match.challonge_tournament_id
        );

        //use matches table to get challonge_match_id using challonge_ids and tournament_id
        //keep in mind that it is possible player1_id in the match is player_2 that we are using here
        let db_match = await getLocalMatchFromPlayersChallongeIdTournamentId(
            player1_challonge_id,
            player2_challonge_id,
            match.challonge_tournament_id
        );

        const winnderIndex = stats.winner; //0 is player1, 1 is player2
        const winnerId = winnderIndex === 0 ? player1_user_id : player2_user_id;
        const winnerChallongeId =
            winnderIndex === 0 ? player1_challonge_id : player2_challonge_id;

        if (stats.scores[0].legs === stats.scores[1].legs) {
            winnerId = null;
            winnerChallongeId = null;
        }

        //----------------------- confirm with players-----------------------

        let confirmations = {
            player1: false,
            player2: false,
        };

        const sendConfirmationWithButtons = async (
            player,
            playerUser,
            opponentUser,
            stats,
            client
        ) => {
            try {
                // Create an embed with match details
                const opponentDisplayName =
                    opponentUser.globalName || opponentUser.username;

                const embed = new EmbedBuilder()
                    .setTitle("Match Result Confirmation")
                    .setDescription(
                        `Your match against ${opponentDisplayName} has ended with a score of ${stats.scores[0].legs}-${stats.scores[1].legs}. Please confirm if this result is correct and if this was a league match.`
                    )
                    .setColor(0x00ff00);
                // Create buttons for confirm and reject
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(
                            `confirm_autoMatch_${playerUser.id}_${matchId}`
                        )
                        .setLabel("Confirm")
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(
                            `reject_autoMatch_${playerUser.id}_${matchId}`
                        )
                        .setLabel("Reject")
                        .setStyle(ButtonStyle.Danger)
                );

                // Send the embed and buttons to the user in DMs
                const message = await playerUser.send({
                    embeds: [embed],
                    components: [row],
                });
            } catch (error) {
                console.error(
                    "Error sending confirmation with buttons:",
                    error
                );
                return "error"; // Return "error" if DM fails
            }
        };

        console.log(player1_user_id);

        const player1User = await client.users.fetch(player1_user_id);
        const player2User = await client.users.fetch(player2_user_id);
        try {
            sendConfirmationWithButtons(
                "player2",
                player2User,
                player1User,
                stats,
                client
            );
        } catch (error) {
            console.error("Error sending confirmation with buttons:", error);
        }
        try {
            sendConfirmationWithButtons(
                "player1",
                player1User,
                player2User,
                stats,
                client
            );
        } catch (error) {
            console.error("Error sending confirmation with buttons:", error);
        }

        //we will add everything to the local db anyway, then the button handled in the discord bot will add to challonge or remove from local db

        //-----------------------CONFIMED-------------------------------------

        //update match in database (winner_id, state, player1_score, player2_score(use legs), autodarts_match_id)

        let scores_csv;
        //db match player order is used here
        scores_csv =
            db_match.player1_id === player1_challonge_id
                ? `${stats.scores[0].legs}-${stats.scores[1].legs}`
                : `${stats.scores[1].legs}-${stats.scores[0].legs}`;

        const matchInfo = {
            matchId: matchId,
            db_match: db_match,
            scores_csv: scores_csv,
            winnerChallongeId: winnerChallongeId,
            state: "complete",
        };
        await updateLocalMatch(matchInfo);

        //need to create scores-csv for challonge, will just be eg 4-3. got to organise based on if db_match.player1_id is player1_id or not
        //first check if db_match.player1_id player1_challonge_id

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
            api_key: process.env.API_KEY,
        };
        const data = {
            match: {
                scores_csv: scores_csv,
                winner_id: winnerChallongeId,
            },
        };

        // try {
        //     const response = await axios.put(api_url, data, { params });
        //     if (response.status === 200) {
        //         console.log("Challonge match updated");
        //     }
        // } catch (error) {
        //     console.error("Error updating challonge match:", error);
        // }

        //now update stats table, one record for each player
        // user_id, match_id(challonge), tournament_id, average, average_until_170, first_9_average
        // checkout_percent, darts_thrown, best_checkout, points_60_plus, points_100_plus, points_140_plus, points_170_plus, points_180

        //for each player in stats, get their user_id from the user table from autodarts_id
        //then get their challonge_id from the participants table from user_id and tournament_id
        //then add this record to the stats table

        const statsPlayer1_user_id = await getUserIdFromAutodartsId(player1_id);
        const statsPlayer2_user_id = await getUserIdFromAutodartsId(player2_id);

        const statsPlayer1_challonge_id =
            await getChallongeIdFromUserIdTournamentId(
                statsPlayer1_user_id,
                match.challonge_tournament_id
            );
        const statsPlayer2_challonge_id =
            await getChallongeIdFromUserIdTournamentId(
                statsPlayer2_user_id,
                match.challonge_tournament_id
            );

        //add stats to stats table
        const statsPlayer1 = stats.matchStats[0];
        const statsPlayer2 = stats.matchStats[1];
        await updateStats(
            statsPlayer1_user_id,
            db_match.match_id,
            match.challonge_tournament_id,
            statsPlayer1
        );
        await updateStats(
            statsPlayer2_user_id,
            db_match.match_id,
            match.challonge_tournament_id,
            statsPlayer2
        );
    }
    async checkIfMatchFinished(matchId, client) {
        //when not using a matchmode as a draw can happen in the league but not with autodarts
        //, there is no event when the match is manually ended
        //this will be called 30 seconds after the last update involving a leg winner to check if the match is finished
        console.log("Checking if match is finished");
        const matchStatsUrl = `https://api.autodarts.io/as/v0/matches/${matchId}/stats`;
        const headers = {
            Authorization: `Bearer ${client.keycloakClient.accessToken}`,
        };
        let stats;
        let match = this.ongoing_matches.find(
            (match) => match.matchId === matchId
        );
        try {
            const interaction = match.live_discord_interaction;
            const embed = new EmbedBuilder()
                .setTitle("🎯 League Match Finished")
                .setDescription(`Waiting for confirmation from players.`)
                .setColor(0xff0000) // Red color for finished match
                .setTimestamp();
            interaction.edit({ embeds: [embed] });

            stats = await axios.get(matchStatsUrl, { headers });
            console.log(stats.data);
        } catch (error) {
            console.error("Match not finished:");
            console.log(error);
            match.checking = true;
            return;
        }
        //if it makes it here, the match is finished
        this.processFinishedMatch(matchId, stats.data, client);
    }
}

module.exports = MatchHandler;
