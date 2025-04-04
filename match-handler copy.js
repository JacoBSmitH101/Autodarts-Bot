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
        if (process.env.DEBUG === "true") {
            console.log(message);
        }
        if (message.data.event === "finish") {
            //match is finished, no need to check if it is finished
            if (process.env.DEBUG === "true") {
                console.log("Match is finished");
            }
            this.matchFinished(message.data.id, this.client);
        }
        if (message.data.event === "delete") {
            //match is finished, no need to check if it is finished
            if (process.env.DEBUG === "true") {
                console.log("Match is deleted");
            }
            //remove match from ongoing_matches
            this.handleDeleteMatch(message.data.id, this.client);
        }
        if (message.data.event === "start") {
            //match is starting, no need to check if it is finished
            if (process.env.DEBUG === "true") {
                console.log("Match is starting");
            }
        }
    }

    async match_update(message, tournamentId) {
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

        const divisionNumbers = await getDivisionNumbers(tournamentId);
        //is an object with group_id: division_number
        const division = divisionNumbers[db_match.group_id];
        if (channel) {
            const embed = new EmbedBuilder()
                .setTitle(`🎯 Division ${division} Match In Progress`)
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
            const guild = await this.client.guilds.cache.get(
                process.env.AD_GUILD
            );
            const matchChannel = await findThreadByMatchId(
                guild,
                db_match.match_id
            );
            if (process.env.DEBUG === "true") {
                console.log(matchChannel);
            }
            //just say match begun
            const embed2 = new EmbedBuilder()
                .setTitle(`🎯 Match Started`)
                .setDescription(
                    `Match between ${player1_name} and ${player2_name} has begun!`
                )
                .setColor(0x00ff00) // Green color for active match
                .setTimestamp();

            // Send message and update ongoing match with Discord message object
            matchChannel.send({ embeds: [embed2] });
        } else {
            console.log("Channel not found");
        }

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
