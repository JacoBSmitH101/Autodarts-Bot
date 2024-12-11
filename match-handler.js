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
    getDivisionNumbers,
    findThreadByMatchId,
    saveAdStats,
    getLiveMatchDataFromAutodartsMatchId,
    updateLiveMatchStatus,
    getLiveMatchStatus,
    updateLiveInteraction,
    getLocalMatchFromMatchId,
    deleteLiveMatch,
} = require("./datamanager");
const { match } = require("assert");
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
        if (process.env.DEBUG === "true") {
            //console.log(message);
        }
        if (message.data.event === "finish") {
            //match is finished, no need to check if it is finished
            if (process.env.DEBUG === "true") {
                console.log("Match is finished");
            }
            this.matchFinished(message.data.id, this.client);
        }
        // if (message.data.event === "delete") {
        //     //match is finished, no need to check if it is finished
        //     if (process.env.DEBUG === "true") {
        //         console.log("Match is deleted");
        //     }
        //     //remove match from ongoing_matches
        //     this.handleDeleteMatch(message.data.id, this.client);
        // }
        // if (message.data.event === "start") {
        //     //match is starting, no need to check if it is finished
        //     if (process.env.DEBUG === "true") {
        //         console.log("Match is starting");
        //     }
        // }
    }
    async lobby_event(message) {
        //for each message.players check the .userId which is  player1_autodarts_id and player2_autodarts_id.
        //first get the lobby data from the database using the lobby_id
        const lobbyId = message.data.id;
        const match_data = await getLiveMatchDataFromAutodartsMatchId(lobbyId);

        let player1_in = false;
        let player2_in = false;
        if (!message.data.players) {
            return;
        }
        //do the loop
        for (let i = 0; i < message.data.players.length; i++) {
            const player = message.data.players[i];
            const player_id = player.userId;
            if (
                !match_data ||
                !match_data.player1_autodarts_id ||
                !match_data.player2_autodarts_id
            ) {
                return;
            }
            if (player_id == match_data.player1_autodarts_id) {
                player1_in = true;
            }
            if (player_id == match_data.player2_autodarts_id) {
                player2_in = true;
            }
            if (!player1_in && !player2_in) {
                await this.client.keycloakClient.removePlayerFromLobby(
                    lobbyId,
                    i
                );
            }
        }

        //if neither are in, then do a delete api call
        //example delete url https://api.autodarts.io/gs/v0/lobbies/ca8043e3-d9de-4d14-8d17-2da2d38e57c4/players/by-index/1
        //loop through each player in the lobby with a for i = 0 loop and if they arent one of the players, delete them
        for (let i = 0; i < message.data.players.length; i++) {
            const player = message.data.players[i];
            const player_id = player.userId;
            if (player_id != match_data.player1_autodarts_id) {
                if (player_id != match_data.player2_autodarts_id) {
                    await this.client.keycloakClient.removePlayerFromLobby(
                        lobbyId,
                        i
                    );
                }
            }
        }

        //if both, then follow up on the interaction found with match_channel_interaction_id
        if (player1_in && player2_in) {
            const channel = this.client.channels.cache.get(
                match_data.match_channel_interaction_id
            );
            if (channel) {
                const embed = new EmbedBuilder()
                    .setTitle(`🎯 All players in!`)
                    .setDescription(`Press the button below to begin`)
                    .setColor(0x00ff00) // Green color for active match
                    .setTimestamp();

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`start_autoMatch_${lobbyId}`)
                        .setLabel("Start Match")
                        .setStyle(ButtonStyle.Success)
                );

                // follow up to the interaction_id with the embed and button
                //get the original interaction
                const interaction = await channel.messages.fetch(
                    match_data.match_channel_interaction_id
                );
                const status = await getLiveMatchStatus(lobbyId);
                if (status == "waiting for players") {
                    await interaction.reply({
                        embeds: [embed],
                        components: [row],
                    });
                    await updateLiveMatchStatus(lobbyId, "start offered");
                }
            } else {
                console.log("Channel not found");
            }
        }
    }

    async match_update(message, tournamentId) {
        const matchId = message.data.id;
        //associate this match with a match in the database via player ids

        this.handleMatchUpdate(matchId, message, tournamentId);
    }

    async handleMatchUpdate(matchId, message, tournamentId) {
        const liveMatchData = await getLiveMatchDataFromAutodartsMatchId(
            matchId
        );
        //double check matchId is not already being tracked
        if (message.data.variant != "X01") {
            //bull off

            if (!liveMatchData.live_status_interaction_id) {
                //create nteraction in process.env.LIVE_MATCHES_CHANNEL_ID
                const channel = this.client.channels.cache.get(
                    process.env.LIVE_MATCHES_CHANNEL_ID
                );

                //embed saying Bull up in progress
                const embed = new EmbedBuilder()
                    .setTitle(`🎯 Bull Up In Progress`)
                    .setDescription(`Follow the live score and progress!`)
                    .setColor(0x00ff00) // Green color for active match
                    .setTimestamp()
                    .addFields(
                        // Player names and match status
                        {
                            name: `Bull Up`,
                            value: `In Progress`,
                            inline: true,
                        },
                        {
                            name: "Follow along!",
                            value: `[Watch match on Autodarts](https://play.autodarts.io/matches/${matchId})`,
                            inline: false,
                        }
                    );

                // Send message and update ongoing match with Discord message object
                const message = await channel.send({ embeds: [embed] });
                //set the interaction id in the live match data
                await updateLiveInteraction(matchId, message.id);
            } else {
                const winnerId = message.data.gameWinner;
                if (winnerId == -1) {
                    //no winner so just say in progress
                    const channel = this.client.channels.cache.get(
                        process.env.LIVE_MATCHES_CHANNEL_ID
                    );
                    const interaction = await channel.messages.fetch(
                        liveMatchData.live_status_interaction_id
                    );
                    const embed = new EmbedBuilder()
                        .setTitle(`🎯 Bull Up In Progress`)
                        .setDescription(`Follow the live score and progress!`)
                        .setColor(0x00ff00) // Green color for active match
                        .setTimestamp()
                        .addFields(
                            // Player names and match status
                            {
                                name: `Bull Up`,
                                value: `In Progress`,
                                inline: true,
                            },
                            {
                                name: "Follow along!",
                                value: `[Watch match on Autodarts](https://play.autodarts.io/matches/${matchId})`,
                                inline: false,
                            }
                        );
                    interaction.edit({ embeds: [embed] });

                    return;
                }
                try {
                    const winnerName = message.data.players[winnerId].name;
                    const channel = this.client.channels.cache.get(
                        process.env.LIVE_MATCHES_CHANNEL_ID
                    );

                    //update the live match interaction with the winner
                    const interaction = await channel.messages.fetch(
                        liveMatchData.live_status_interaction_id
                    );
                    const embed = new EmbedBuilder()
                        .setTitle(`🎯 Bull Up Finished`)
                        .setDescription(`Winner: ${winnerName}`)
                        .setColor(0x00ff00) // Green color for active match
                        .setTimestamp()
                        .addFields(
                            // Player names and match status
                            {
                                name: `Bull Up`,
                                value: `Finished`,
                                inline: true,
                            },
                            {
                                name: "Follow along!",
                                value: `[Watch match on Autodarts](https://play.autodarts.io/matches/${matchId})`,
                                inline: false,
                            }
                        );
                    interaction.edit({ embeds: [embed] });
                } catch (error) {
                    //console.log(error);
                }
            }
            return;
        }

        //game has begun
        //get the required data
        const players = message.data.players;

        //we only really need scores and legs and who is throwing
        //then edit the interaction with the new scores
        if (!players[0].name || !message.data.gameScores) {
            //no player names, return
            return;
        }
        try {
            //get player names
            const player1_name = players[0].name;
            const player2_name = players[1].name;

            //get player scores
            const player1_score = message.data.gameScores[0];
            const player2_score = message.data.gameScores[1];

            // //for testing log everything we have
            // console.log(players);
            // console.log(player1_name);
            // console.log(player2_name);
            // console.log(player1_score);
            // console.log(player2_score);
            //index of player throwing
            const player_throwing = message.data.player;

            //get player legs
            const player1_legs = message.data.scores[0].legs;
            const player2_legs = message.data.scores[1].legs;

            //update embed with new scores
            const matchUrl = `https://play.autodarts.io/matches/${matchId}`;
            const link = hyperlink("Goto match", matchUrl);
            //create interaction and store it in live_discord_interaction
            const channel = this.client.channels.cache.get(
                process.env.LIVE_MATCHES_CHANNEL_ID
            );
            //get live interaction from the liveMatchData
            const interaction = await channel.messages.fetch(
                liveMatchData.live_status_interaction_id
            );

            const round = message.data.round;

            //number of items in message.data.turns is the number of throws in the current round
            const throwsThisRound = message.data.turns[0].throws.length || 0;
            //darts thrown is round * 3 + throwsThisRound
            const dartsThrown = (round - 1) * 3 + throwsThisRound;

            //create the embed
            const embed = new EmbedBuilder()
                .setTitle(`🎯 League Match In Progress`)
                .setDescription(`Follow the live score and progress!`)
                .setColor(0x00ff00) // Green color for active match
                .setTimestamp()
                .addFields(
                    // Player names and match status
                    {
                        name: `${
                            player_throwing == 0 ? "*" : ""
                        }${player1_name}`,
                        value: `${player1_score}(${
                            player_throwing == 0 ? dartsThrown : round * 3
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
                            player_throwing == 1 ? "*" : ""
                        }${player2_name}`,
                        value: `${player2_score}(${
                            player_throwing == 1 ? dartsThrown : (round - 1) * 3
                        })`,
                        inline: true,
                    },
                    {
                        name: "Follow along!",
                        value: `[Watch match on Autodarts](${matchUrl})`,
                        inline: false,
                    }
                );

            // Send message and update ongoing match with Discord message object
            interaction.edit({ embeds: [embed] });
        } catch (error) {
            console.log(error);
        }

        // const players = message.data.players;
        // console.log(players);
        // //associate with challonge match id

        // //get user_id from users table using autodarts_id
        // const player1_id = players[0].userId;
        // const player2_id = players[1].userId;

        // const player1_user_id = await getUserIdFromAutodartsId(player1_id);

        // const player2_user_id = await getUserIdFromAutodartsId(player2_id);
        // console.log(tournamentId);
        // console.log(player1_user_id);
        // //use participants table to get challonge_ids using user_ids and tournament_id
        // const player1_challonge_id = await getChallongeIdFromUserIdTournamentId(
        //     player1_user_id,
        //     tournamentId
        // );
        // const player2_challonge_id = await getChallongeIdFromUserIdTournamentId(
        //     player2_user_id,
        //     tournamentId
        // );

        // //then find the match in the matches table using the challonge_ids and tournament_id
        // let db_match = await getLocalMatchFromPlayersChallongeIdTournamentId(
        //     player1_challonge_id,
        //     player2_challonge_id,
        //     tournamentId
        // );

        // this.ongoing_matches.push({
        //     matchId: matchId,
        //     players: players,
        //     live_discord_interaction: null,
        //     challonge_tournament_id: tournamentId,
        //     challonge_match_id: db_match.match_id,
        //     checking: false,
        // });

        // //instead update not add
        // //get player names
        // const player1_name = players[0].name;
        // const player2_name = players[1].name;

        // //get player scores
        // const player1_score = message.data.gameScores[0];
        // const player2_score = message.data.gameScores[1];

        // const player1_legs = message.data.scores[0].legs;
        // const player2_legs = message.data.scores[1].legs;

        // //get match state
        // let matchState = "In Progress";
        // let matchDate = new Date().toLocaleDateString();

        // const matchUrl = `https://play.autodarts.io/matches/${matchId}`;
        // const link = hyperlink("Goto match", matchUrl);
        // //create interaction and store it in live_discord_interaction
        // const channel = this.client.channels.cache.get(
        //     process.env.LIVE_MATCHES_CHANNEL_ID
        // );
        // //currently throwing player is message.data.player 0 for player1 and 1 for player2
        // const throwingPlayer = message.data.player;

        // const divisionNumbers = await getDivisionNumbers(tournamentId);
        // //is an object with group_id: division_number
        // const division = divisionNumbers[db_match.group_id];
        // if (channel) {
        //     const embed = new EmbedBuilder()
        //         .setTitle(`🎯 Division ${division} Match In Progress`)
        //         .setDescription(`Follow the live score and progress!`)
        //         .setColor(0x00ff00) // Green color for active match
        //         .setTimestamp()
        //         .addFields(
        //             // Player names and match status
        //             {
        //                 name: `${
        //                     throwingPlayer == 0 ? "*" : ""
        //                 }${player1_name}`,
        //                 value: `${player1_score}`,
        //                 inline: true,
        //             },
        //             {
        //                 name: " VS ",
        //                 value: `${player1_legs} - ${player2_legs}`,
        //                 inline: true,
        //             },
        //             {
        //                 name: `${
        //                     throwingPlayer == 1 ? "*" : ""
        //                 }${player2_name}`,
        //                 value: `${player2_score}`,
        //                 inline: true,
        //             },
        //             {
        //                 name: "Follow along!",
        //                 value: `[Watch match on Autodarts](${matchUrl})`,
        //                 inline: false,
        //             }
        //         );

        //     // Send message and update ongoing match with Discord message object
        //     const message = await channel.send({ embeds: [embed] });
        //     this.ongoing_matches.find(
        //         (match) => match.matchId === matchId
        //     ).live_discord_interaction = message;
        //     let guild = await this.client.guilds.cache.get(
        //         process.env.AD_GUILD
        //     );
        //     if (process.env.DEBUG === "true") {
        //         guild = await this.client.guilds.cache.get(
        //             process.env.GUILD_ID
        //         );
        //     }
        //     const matchChannel = await findThreadByMatchId(
        //         guild,
        //         db_match.match_id
        //     );
        //     if (process.env.DEBUG === "true") {
        //         console.log(matchChannel);
        //     }
        //     //just say match begun
        //     const embed2 = new EmbedBuilder()
        //         .setTitle(`🎯 Match Started`)
        //         .setDescription(
        //             `Match between ${player1_name} and ${player2_name} has begun!`
        //         )
        //         .setColor(0x00ff00) // Green color for active match
        //         .setTimestamp();

        //     // Send message and update ongoing match with Discord message object
        //     matchChannel.send({ embeds: [embed2] });
        // } else {
        //     console.log("Channel not found");
        // }

        //mark as underway on challonge
        // const api_url = `https://api.challonge.com/v1/tournaments/${tournamentId}/matches/${db_match.match_id}/mark_as_underway.json`;
        // const params = {
        //     api_key: process.env.API_KEY,
        // };
        // try {
        //     const response = await axios.put(api_url, {}, { params });
        //     if (response.status === 200) {
        //         console.log("Challonge match marked as underway");
        //     }
        // } catch (error) {
        //     console.error("Error marking challonge match as underway:", error);
        // }
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
        let winnerId = winnderIndex === 0 ? player1_user_id : player2_user_id;
        let winnerChallongeId =
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

        //if one player has 4 legs and the other 3, the players played wrong so correct to 3-3
        if (
            (stats.scores[0].legs === 4 && stats.scores[1].legs === 3) ||
            (stats.scores[0].legs === 3 && stats.scores[1].legs === 4)
        ) {
            scores_csv = "3-3";
        }

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

        // ! update challonge
        // const api_url = `https://api.challonge.com/v1/tournaments/${match.challonge_tournament_id}/matches/${db_match.match_id}.json`;
        // const params = {
        //     api_key: process.env.API_KEY,
        // };
        // const data = {
        //     match: {
        //         scores_csv: scores_csv,
        //         winner_id: winnerChallongeId,
        //     },
        // };

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

        const player1_legs = stats.matchStats[0].legsWon;
        const player2_legs = stats.matchStats[1].legsWon;

        //if one player has 4 and the other 3, the players played the incorrrect game length so dont add to stats

        // if (
        //     (player1_legs === 4 && player2_legs === 3) ||
        //     (player1_legs === 3 && player2_legs === 4)
        // ) {
        //     await updateStats(
        //         statsPlayer1_user_id,
        //         db_match.match_id,
        //         match.challonge_tournament_id,
        //         statsPlayer1
        //     );
        //     await updateStats(
        //         statsPlayer2_user_id,
        //         db_match.match_id,
        //         match.challonge_tournament_id,
        //         statsPlayer2
        //     );
        // }

        //now insert into ad_stats table with match_id as db_match.match_id, tournament id and then all the stats object in stats_data

        await saveAdStats(
            db_match.match_id,
            match.challonge_tournament_id,
            stats
        );
    }
    async handleDeleteMatch(matchId, client) {
        //basically just update hte live_discord_interaction message to say the match is deleted with a red color
        const match = this.ongoing_matches.find(
            (match) => match.matchId === matchId
        );
        try {
            const interaction = match.live_discord_interaction;
            const embed = new EmbedBuilder()
                .setTitle("🎯 League Match Aborted")
                .setDescription(`This match has been aborted.`)
                .setColor(0xff0000) // Red color for finished match
                .setTimestamp();

            interaction.edit({ embeds: [embed] });
        } catch {}
        //remove match from ongoing_matches
        setTimeout(() => {
            this.ongoing_matches = this.ongoing_matches.filter(
                (match) => match.matchId !== matchId
            );
        }, 30000);
    }
    async markMatchRejected(db_match) {
        let match = this.ongoing_matches.find(
            (match) => match.matchId === db_match.autodarts_match_id
        );

        const interaction = match.live_discord_interaction;

        const embed = new EmbedBuilder()
            .setTitle("🎯 League Match Rejected")
            .setDescription(`This match has been rejected.`)
            .setColor(0xff0000) // Red color for finished match
            .setTimestamp();

        interaction.edit({ embeds: [embed] });
    }
    async matchFinished(matchId, client) {
        //when not using a matchmode as a draw can happen in the league but not with autodarts
        //, there is no event when the match is manually ended
        //this will be called 30 seconds after the last update involving a leg winner to check if the match is finished
        if (process.env.DEBUG === "true") {
            console.log("Checking if match is finished");
        }
        await updateLiveMatchStatus(matchId, "finished");
        const matchStatsUrl = `https://api.autodarts.io/as/v0/matches/${matchId}/stats`;
        const headers = {
            Authorization: `Bearer ${client.keycloakClient.accessToken}`,
        };
        let stats;
        let match = await getLiveMatchDataFromAutodartsMatchId(matchId);
        try {
            stats = await axios.get(matchStatsUrl, { headers });
            const interaction = //get the interaction
                this.client.channels.cache
                    .get(process.env.LIVE_MATCHES_CHANNEL_ID)
                    .messages.cache.get(match.live_status_interaction_id);
            //embed saying match has finished and make sure score and average is displayed
            //make it appealing as well

            const player1_legs = stats.data.matchStats[0].legsWon;
            const player2_legs = stats.data.matchStats[1].legsWon;

            const player1_average = stats.data.matchStats[0].average.toFixed(2);
            const player2_average = stats.data.matchStats[1].average.toFixed(2);

            const player1_name = stats.data.players[0].name;
            const player2_name = stats.data.players[1].name;
            let winner, winner_legs, winner_average;
            if (player1_legs > player2_legs) {
                winner = player1_name;
                winner_legs = player1_legs;
                winner_average = player1_average;
            } else if (player2_legs > player1_legs) {
                winner = player2_name;
                winner_legs = player2_legs;
                winner_average = player2_average;
            } else {
                winner = "It's a draw!";
            }

            const matchSummaryEmbed = new EmbedBuilder()
                .setColor(player1_legs === player2_legs ? "#ffaa00" : "#00ff00") // Yellow for draw, green for a win
                .setTitle("🎯 Match Finished!")
                .setDescription(
                    winner === "It's a draw!"
                        ? "The match ended in a **draw**! Here are the final stats:"
                        : `The match is over, and **${winner}** is the winner! 🏆`
                )
                .addFields(
                    {
                        name: `🏆 ${player1_name}`,
                        value: `**Legs Won:** ${player1_legs}\n**Average:** ${player1_average}`,
                        inline: true,
                    },
                    {
                        name: `🏆 ${player2_name}`,
                        value: `**Legs Won:** ${player2_legs}\n**Average:** ${player2_average}`,
                        inline: true,
                    }
                )
                .setFooter({
                    text: "Thanks for following this match!",
                    iconURL: "https://example.com/logo.png", // Replace with a relevant image URL
                })
                .setTimestamp();

            await interaction.edit({ embeds: [matchSummaryEmbed] });
            let scores_csv;

            //use participants table to get challonge_ids using user_ids and tournament_id

            const db_match = await getLocalMatchFromMatchId(match.match_id);

            const player1_id = stats.data.players[0].userId;
            const player2_id = stats.data.players[1].userId;

            //use user table to get user_ids
            const player1_user_id = await getUserIdFromAutodartsId(player1_id);
            const player2_user_id = await getUserIdFromAutodartsId(player2_id);
            const player1_challonge_id =
                await getChallongeIdFromUserIdTournamentId(
                    player1_user_id,
                    db_match.tournament_id
                );
            const player2_challonge_id =
                await getChallongeIdFromUserIdTournamentId(
                    player2_user_id,
                    db_match.tournament_id
                );
            console.log(`Player 1: ${player1_challonge_id}`);
            console.log(`Player 2: ${player2_challonge_id}`);
            if (!player1_challonge_id || !player2_challonge_id) {
                console.error("Player challonge ids not found");
            }
            //db match player order is used here
            scores_csv =
                db_match.player1_id === player1_challonge_id
                    ? `${stats.data.scores[0].legs}-${stats.data.scores[1].legs}`
                    : `${stats.data.scores[1].legs}-${stats.data.scores[0].legs}`;

            let winnerIndex = stats.data.winner; //0 is player1, 1 is player2
            let winnerId =
                winnerIndex === 0 ? player1_user_id : player2_user_id;
            let winnerChallongeId =
                winnerIndex === 0 ? player1_challonge_id : player2_challonge_id;

            if (stats.data.scores[0].legs === stats.data.scores[1].legs) {
                winnerId = null;
                winnerChallongeId = null;
            }
            const matchInfo = {
                matchId: matchId,
                db_match: db_match,
                scores_csv: scores_csv,
                winnerChallongeId: winnerChallongeId,
                state: "complete",
            };
            await updateLocalMatch(matchInfo);

            //set db.match.player1_score to the appropriate value depending on who is player 1

            db_match.player1_score =
                db_match.player1_id === player1_challonge_id
                    ? stats.data.scores[0].legs
                    : stats.data.scores[1].legs;
            db_match.player2_score =
                db_match.player1_id === player1_challonge_id
                    ? stats.data.scores[1].legs
                    : stats.data.scores[0].legs;

            await saveAdStats(
                db_match.match_id,
                db_match.tournament_id,
                stats.data
            );
            await deleteLiveMatch(matchId);

            const api_url = `https://api.challonge.com/v1/tournaments/${db_match.tournament_id}/matches/${db_match.match_id}.json`;
            const params = { api_key: process.env.API_KEY };

            winnerIndex =
                db_match.player1_score > db_match.player2_score
                    ? 0
                    : db_match.player1_score < db_match.player2_score
                    ? 1
                    : null;
            winnerChallongeId =
                winnerIndex !== null
                    ? winnerIndex === 0
                        ? db_match.player1_id
                        : db_match.player2_id
                    : "tie";
            scores_csv = `${db_match.player1_score}-${db_match.player2_score}`;
            console.log(winnerChallongeId);
            const data = {
                match: {
                    scores_csv: scores_csv,
                    winner_id: winnerChallongeId,
                },
            };

            try {
                const response = await axios.put(api_url, data, {
                    params,
                });
                if (response.status === 200) {
                    console.log("Challonge match updated");
                }
                //sent update in the match channel to say the match has been added to challonge
                let guild;
                if (process.env.DEBUG === "true") {
                    guild = await client.guilds.cache.get(process.env.GUILD_ID);
                } else {
                    guild = await client.guilds.cache.get(process.env.AD_GUILD);
                }
                const matchPost = await findThreadByMatchId(
                    guild,
                    db_match.match_id
                );
                const embed = new EmbedBuilder()
                    .setTitle(`🎯 Match Finished`)
                    .setDescription(
                        `Your match has been completed and the results have been submitted to Challonge!`
                    )
                    .setColor(0x00ff00) // Green color for active match
                    .setTimestamp();
                matchPost.send({ embeds: [embed] });
            } catch (error) {
                console.error("Error updating challonge match:", error);
            }
        } catch (error) {
            console.error("Match not finished:");
            console.log(error);
            match.checking = true;
            return;
        }
        //if it makes it here, the match is finished

        //check if the match has been played correctly
        //either 3-3 or first to 4
        //if not, mark the match as rejected
    }
}

module.exports = MatchHandler;
