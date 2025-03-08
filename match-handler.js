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
        this.lobbyLocks = {};
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
        const lobbyId = message.data.id;
        //check lobby lock for lobbyId
        if (this.lobbyLocks[lobbyId]) {
            return;
        }
        this.lobbyLocks[lobbyId] = true;
        const match_data = await getLiveMatchDataFromAutodartsMatchId(lobbyId);
        //log the time and message
        // if (process.env.DEBUG === "true") {
        // console.log(`[${new Date().toISOString()}]`, message);

        if (
            !message.data.players ||
            !match_data ||
            message.channel == "autodarts.matches"
        )
            return;

        const {
            player1_autodarts_name,
            player2_autodarts_name,
            match_channel_interaction_id,
        } = match_data;

        if (!player1_autodarts_name || !player2_autodarts_name) {
            this.lobbyLocks[lobbyId] = false;
            return;
        }

        let player1_in = false;
        let player2_in = false;

        // Identify players to keep and remove
        const removalPromises = [];
        message.data.players.forEach((player, index) => {
            const player_id = player.userId;
            const player_name = player.name;
            if (player_name === player1_autodarts_name) {
                player1_in = true;
            } else if (player_name === player2_autodarts_name) {
                player2_in = true;
            } else {
                // Remove non-matching players
                removalPromises.push(
                    this.client.keycloakClient.removePlayerFromLobby(
                        lobbyId,
                        index
                    )
                );
            }
        });

        // Execute all removals concurrently
        await Promise.all(removalPromises);

        // If both players are in, proceed to send the start prompt
        if (player1_in && player2_in) {
            // Early check to prevent duplicate processing
            const status = await getLiveMatchStatus(lobbyId);
            if (status == "start offered") {
                if (process.env.DEBUG === "true") {
                    console.log(
                        `Start already offered for lobby ${lobbyId}. Exiting.`
                    );
                }
                this.lobbyLocks[lobbyId] = false;
                return;
            }

            // Immediately set the match status to "start offered" to prevent reprocessing
            await updateLiveMatchStatus(lobbyId, "start offered");

            const channel = this.client.channels.cache.get(
                match_channel_interaction_id
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

                try {
                    // Fetch the interaction message once
                    const interactionMessage = await channel.messages.fetch(
                        match_channel_interaction_id
                    );
                    if (interactionMessage) {
                        // Check if the start prompt has already been sent
                        const existingStartPrompt =
                            interactionMessage.components.some((row) =>
                                row.components.some(
                                    (button) =>
                                        button.customId ===
                                        `start_autoMatch_${lobbyId}`
                                )
                            );

                        if (!existingStartPrompt) {
                            await interactionMessage.reply({
                                embeds: [embed],
                                components: [row],
                            });
                            if (process.env.DEBUG === "true") {
                                console.log(
                                    `Start prompt sent for lobby ${lobbyId}.`
                                );
                            }
                        } else {
                            if (process.env.DEBUG === "true") {
                                console.log(
                                    `Start prompt already exists for lobby ${lobbyId}.`
                                );
                            }
                        }
                    }
                } catch (error) {
                    console.error(
                        "Failed to fetch or reply to interaction message:",
                        error
                    );
                    // Optionally revert the status if necessary
                    await updateLiveMatchStatus(lobbyId, "active"); // Or another appropriate status
                }
            } else {
                console.log("Channel not found");
            }
        }

        this.lobbyLocks[lobbyId] = false;
    }

    async match_update(message, tournamentId) {
        const matchId = message.data.id;
        //associate this match with a match in the database via player ids

        this.handleMatchUpdate(matchId, message, tournamentId);
    }

    async handleMatchUpdate(matchId, message, tournamentId) {
        try {
            const liveMatchData = await getLiveMatchDataFromAutodartsMatchId(
                matchId
            );

            if (message.data.variant !== "X01") {
                const channel = this.client.channels.cache.get(
                    process.env.LIVE_MATCHES_CHANNEL_ID
                );
                let dbmatch = await getLocalMatchFromMatchId(
                    liveMatchData.match_id
                );
                if (dbmatch.state === "started") {
                    return;
                }

                if (!liveMatchData.live_status_interaction_id) {
                    const embed = new EmbedBuilder()
                        .setTitle(`🎯 Bull Up In Progress`)
                        .setDescription(`Follow the live score and progress!`)
                        .setColor(0x00ff00) // Green color for active match
                        .setTimestamp()
                        .addFields(
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
                    const sentMessage = await channel.send({ embeds: [embed] });
                    await updateLiveInteraction(matchId, sentMessage.id);
                    dbmatch.state = "started";

                    await updateLocalMatch(dbmatch);
                } else {
                    // const interaction = await channel.messages.fetch(
                    //     liveMatchData.live_status_interaction_id
                    // );
                    // const winnerId = message.data.gameWinner;
                    // const embed = new EmbedBuilder()
                    //     .setTitle(
                    //         winnerId === -1
                    //             ? `🎯 Bull Up In Progress`
                    //             : `🎯 Bull Up Finished`
                    //     )
                    //     .setDescription(
                    //         winnerId === -1
                    //             ? `Follow the live score and progress!`
                    //             : `Winner: ${
                    //                   winnerId == -1
                    //                       ? "NA"
                    //                       : message.data.players[winnerId].name
                    //               }`
                    //     )
                    //     .setColor(0x00ff00) // Green color for active match
                    //     .setTimestamp()
                    //     .addFields(
                    //         {
                    //             name: `Bull Up`,
                    //             value:
                    //                 winnerId === -1
                    //                     ? `In Progress`
                    //                     : `Finished`,
                    //             inline: true,
                    //         },
                    //         {
                    //             name: "Follow along!",
                    //             value: `[Watch match on Autodarts](https://play.autodarts.io/matches/${matchId})`,
                    //             inline: false,
                    //         }
                    //     );
                    // await interaction.edit({ embeds: [embed] });
                }
                return;
            }

            const players = message.data.players;
            if (!players[0].name || !message.data.gameScores) {
                return; // Exit if player names or game scores are missing
            }
            if (liveMatchData.status == "bullup") {
                updateLiveMatchStatus(matchId, "in progress");
            }

            const channel = this.client.channels.cache.get(
                process.env.LIVE_MATCHES_CHANNEL_ID
            );
            const interaction = await channel.messages.fetch(
                liveMatchData.live_status_interaction_id
            );
            if (!interaction) {
                return;
            }
            const player_throwing = message.data.player;
            const round = message.data.round;
            const throwsThisRound = message.data.turns[0].throws.length || 0;
            const dartsThrown = (round - 1) * 3 + throwsThisRound;
            const matchUrl = `https://play.autodarts.io/matches/${matchId}`;

            const embed = new EmbedBuilder()
                .setTitle(`🎯 League Match In Progress`)
                .setDescription(`Follow the live score and progress!`)
                .setColor(0x00ff00) // Green color for active match
                .setTimestamp()
                .addFields(
                    {
                        name: `${player_throwing === 0 ? "*" : ""}${
                            players[0].name
                        }`,
                        value: `${message.data.gameScores[0]}(${
                            player_throwing === 0 ? dartsThrown : round * 3
                        })`,
                        inline: true,
                    },
                    {
                        name: "VS",
                        value: `${message.data.scores[0].legs} - ${message.data.scores[1].legs}`,
                        inline: true,
                    },
                    {
                        name: `${player_throwing === 1 ? "*" : ""}${
                            players[1].name
                        }`,
                        value: `${message.data.gameScores[1]}(${
                            player_throwing === 1
                                ? dartsThrown
                                : (round - 1) * 3
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
            await interaction.edit({ embeds: [embed] });
        } catch (error) {
            console.error("Error handling match update:", error);
        }
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
        // Early check to prevent duplicate processing
        const currentStatus = await getLiveMatchStatus(matchId);
        if (currentStatus === "finished") {
            if (process.env.DEBUG === "true") {
                console.log(
                    `Match ${matchId} is already marked as finished. Exiting.`
                );
            }
            return;
        }

        console.log("Match finished");

        // Immediately set the match status to "finished" to prevent reprocessing
        await updateLiveMatchStatus(matchId, "finished");

        // Optional: Implement a simple lock to prevent concurrent executions

        // Implement acquireLock based on your environment
        try {
            if (process.env.DEBUG === "true") {
                console.log("Checking if match is finished");
            }

            const matchStatsUrl = `https://api.autodarts.io/as/v0/matches/${matchId}/stats`;
            const headers = {
                Authorization: `Bearer ${client.keycloakClient.accessToken}`,
            };
            let stats;
            let match = await getLiveMatchDataFromAutodartsMatchId(matchId);
            let matchStatus = await getLocalMatchFromMatchId(match.match_id);
            if (matchStatus.state === "complete") {
                return;
            }
            console.log(match);
            try {
                stats = await axios.get(matchStatsUrl, { headers });
                if (match.live_status_interaction_id == null) {
                    return;
                }
                const interaction = this.client.channels.cache
                    .get(process.env.LIVE_MATCHES_CHANNEL_ID)
                    .messages.cache.get(match.live_status_interaction_id);
                //TODO HERE
                await updateLiveInteraction(matchId, null);
                // Extract match statistics
                const [player1, player2] = stats.data.players;
                const [stats1, stats2] = stats.data.matchStats;

                const player1_legs = stats1.legsWon;
                const player2_legs = stats2.legsWon;

                const player1_average = stats1.average.toFixed(2);
                const player2_average = stats2.average.toFixed(2);

                let winner, winner_legs, winner_average;
                if (player1_legs > player2_legs) {
                    winner = player1.name;
                    winner_legs = player1_legs;
                    winner_average = player1_average;
                } else if (player2_legs > player1_legs) {
                    winner = player2.name;
                    winner_legs = player2_legs;
                    winner_average = player2_average;
                } else {
                    winner = "It's a draw!";
                }

                const matchSummaryEmbed = new EmbedBuilder()
                    .setColor(
                        player1_legs === player2_legs ? "#ffaa00" : "#00ff00"
                    ) // Yellow for draw, green for a win
                    .setTitle("🎯 Match Finished!")
                    .setDescription(
                        winner === "It's a draw!"
                            ? "The match ended in a **draw**! Here are the final stats:"
                            : `The match is over, and **${winner}** is the winner! 🏆`
                    )
                    .addFields(
                        {
                            name: `🏆 ${player1.name}`,
                            value: `**Legs Won:** ${player1_legs}\n**Average:** ${player1_average}`,
                            inline: true,
                        },
                        {
                            name: `🏆 ${player2.name}`,
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

                // Continue with the rest of your logic...

                // Example: Updating Challonge
                const db_match = await getLocalMatchFromMatchId(match.match_id);

                //if (db_match.autodarts_match_id == null) return;

                const player1_user_id = await getUserIdFromAutodartsId(
                    player1.userId
                );
                const player2_user_id = await getUserIdFromAutodartsId(
                    player2.userId
                );

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

                if (!player1_challonge_id || !player2_challonge_id) {
                    console.error("Player Challonge IDs not found");
                }

                const scores_csv =
                    db_match.player1_id === player1_challonge_id
                        ? `${stats.data.scores[0].legs}-${stats.data.scores[1].legs}`
                        : `${stats.data.scores[1].legs}-${stats.data.scores[0].legs}`;

                let winnerIndex = stats.data.winner; // 0 is player1, 1 is player2
                let winnerId =
                    winnerIndex === 0 ? player1_user_id : player2_user_id;
                let winnerChallongeId =
                    winnerIndex === 0
                        ? player1_challonge_id
                        : player2_challonge_id;

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
                const final_scores_csv = `${db_match.player1_score}-${db_match.player2_score}`;

                const data = {
                    match: {
                        scores_csv: final_scores_csv,
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

                    // Send update in the match channel
                    let guild;
                    if (process.env.DEBUG === "true") {
                        guild = await client.guilds.cache.get(
                            process.env.GUILD_ID
                        );
                    } else {
                        guild = await client.guilds.cache.get(
                            process.env.AD_GUILD
                        );
                    }
                    const matchPost = await findThreadByMatchId(
                        guild,
                        db_match.match_id
                    );
                    const embed = new EmbedBuilder()
                        .setTitle(`🎯 Match Finished`)
                        .setDescription(
                            `Your match has been completed and the results have been submitted to Challonge!\nHere is the link to the match: [Autodarts Match](https://play.autodarts.io/history/matches/${db_match.autodarts_match_id})`
                        )
                        .setColor(0x00ff00) // Green color for active match
                        .setTimestamp();
                    await matchPost.send({ embeds: [embed] });
                } catch (error) {
                    console.error("Error updating Challonge match:", error);
                }
            } catch (error) {
                console.error("Match not finished:");
                console.log(error);
                // Revert the status if necessary
                await updateLiveMatchStatus(matchId, "active"); // Or another appropriate status
                return;
            }
        } finally {
            // Release the lock
        }

        // Optionally, you can add additional validation here to ensure the match was processed correctly
        // For example:
        // - Verify the final scores
        // - Ensure data consistency
    }
}

module.exports = MatchHandler;
