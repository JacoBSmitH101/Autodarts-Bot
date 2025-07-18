const axios = require("axios");
const { Pool } = require("pg");
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    ssl: {
        rejectUnauthorized: false,
    },
});
async function add_tournament(serverId, tournamentId) {
    const sqlite3 = require("sqlite3").verbose();
    const db = new sqlite3.Database("./data.db");

    console.log(`Adding tournament ${tournamentId} to server ${serverId}`);

    db.run(`CREATE TABLE IF NOT EXISTS tournaments (
        server_id TEXT,
        tournament_id TEXT,
        name TEXT,
        state TEXT,
        assigned_at INTEGER,
        PRIMARY KEY (server_id, tournament_id)
    )`);

    const timestamp = Date.now();
    let name = "";
    let state = "";
    try {
        // Define the API URL and parameters
        const apiUrl = `https://api.challonge.com/v1/tournaments/${tournamentId}.json`;
        const params = {
            api_key: process.env.API_KEY, // Replace with your actual API key
            state: "in_progress", // Retrieve in-progress tournaments
        };

        const response = await axios.get(apiUrl, { params });

        // Check if there are tournaments to list
        const tournament = response.data;

        name = tournament.tournament.name;
        state = tournament.tournament.state;

        console.log(`Tournament ${tournamentId} found: ${name}`);
        console.log(`Tournament state: ${state}`);
    } catch (error) {
        console.error(error);
        return false;
    }

    db.run(
        `INSERT OR REPLACE INTO tournaments (server_id, tournament_id, name, state, assigned_at) 
        VALUES (?, ?, ?, ?, ?)`,
        [serverId, tournamentId, name, state, timestamp],
        function (err) {
            if (err) {
                console.error("Error adding tournament to DB:", err.message);
                return false;
            } else {
                console.log(
                    `Tournament ${tournamentId} assigned to server ${serverId}`
                );
            }
        }
    );

    db.close();
    return true;
}

const sqlite3 = require("sqlite3").verbose();
const {
    getNameFromChallongeId,
    getAllMatchesFromTournamentId,
    fetchTournamentsFromDatabase2,
} = require("./datamanager");

async function fetchTournamentsFromDatabase(active = true) {
    // console.log(typeof fetchTournamentsFromDatabase2);
    // return await fetchTournamentsFromDatabase2(active);
    try {
        let query = `SELECT name FROM Tournaments`;
        if (active) {
            query += ` WHERE active = 1`;
        }

        const result = await pool.query(query); // No explicit connect/release neededc
        return result.rows;
    } catch (error) {
        console.error("Error fetching tournaments:", error);
        throw new Error("Failed to fetch tournaments.");
    }
}
const { EmbedBuilder } = require("discord.js");

async function handleCancelRemove(interaction) {
    await interaction.update({
        content: "Tournament removal canceled.",
        components: [],
    });
}

async function handleConfirmRemove(interaction, challongeId) {
    const db = new sqlite3.Database("./data.db", (err) => {
        if (err) {
            console.error("Database connection error:", err.message);
            return interaction.update({
                content: "Failed to connect to the database.",
                components: [],
            });
        }
    });

    // Delete the tournament from the database
    const deleteSql = `DELETE FROM Tournaments WHERE challonge_id = ?`;
    db.run(deleteSql, [challongeId], function (err) {
        if (err) {
            console.error("Database deletion error:", err.message);
            return interaction.update({
                content: "Failed to remove the tournament from the database.",
                components: [],
            });
        }
        console.log(`Tournament with Challonge ID ${challongeId} removed`);
        interaction.update({
            content: `Tournament with Challonge ID ${challongeId} has been removed from the database.`,
            components: [],
        });
    });

    db.close((err) => {
        if (err) console.error("Error closing the database:", err.message);
    });
}
async function getTournamentIdByName(tournamentName) {
    const tournamentId = await getTournamentIdByName2(tournamentName);
    return tournamentId;
}
async function getParticipantMapping(tournamentId) {
    const apiUrl = `https://api.challonge.com/v1/tournaments/${tournamentId}/participants.json`;
    const params = { api_key: process.env.API_KEY };

    try {
        const response = await axios.get(apiUrl, { params });
        const participants = response.data;
        // Map `challonge_username` to Discord ID
        const participantMapping = {};

        participants.forEach((participantData) => {
            const name = participantData.participant.display_name;
            console.log(name);
            // Add to mapping if `discordId` is defined
            if (name) {
                participantMapping[name] = name;
            }
        });

        return participantMapping;
    } catch (error) {
        console.error(
            "Error fetching participants from Challonge:",
            error.response ? error.response.data : error.message
        );
        throw new Error("Failed to fetch participants.");
    }
}
const updateParticipantMatchPlayerIdsAndMatches = async (tournamentId) => {
    const db = new sqlite3.Database("./data.db");
    db.all(`SELECT * FROM Users`, [], (err, rows) => {
        if (err) {
            console.error("Error fetching participants:", err.message);
            return;
        }
        console.log(rows);
    });
    try {
        // Fetch all participants in the tournament
        console.log(`Fetching participants for tournament ${tournamentId}`);
        const participants = await new Promise((resolve, reject) => {
            db.all(
                `SELECT participant_id, user_id FROM Participants WHERE tournament_id = ?`,
                [tournamentId],
                (err, rows) => {
                    if (err) {
                        reject("Failed to retrieve participants.");
                        console.error(
                            "Error fetching participants from database:",
                            err.message
                        );
                    } else {
                        resolve(rows);
                    }
                }
            );
        });
        console.log(participants);
        for (const participant of participants) {
            const { user_id, participant_id } = participant;
            console.log(
                `Updating participant ${participant_id} for user ${user_id}`
            );
            const apiUrl = `https://api.challonge.com/v1/tournaments/${tournamentId}/participants/${participant_id}.json`;
            const params = { api_key: process.env.API_KEY, include_matches: 1 };

            const response = await axios.get(apiUrl, { params });
            const matches = response.data.participant.matches;

            // Identify match-specific player ID
            const playerIdCount = {};
            matches.forEach((match) => {
                const { player1_id, player2_id } = match.match;
                playerIdCount[player1_id] =
                    (playerIdCount[player1_id] || 0) + 1;
                playerIdCount[player2_id] =
                    (playerIdCount[player2_id] || 0) + 1;
            });
            const group_id = matches[0].match.group_id;
            if (participant_id == 245565315) {
                console.log(playerIdCount);
            }

            let matchPlayerId =
                Object.keys(playerIdCount).length === 1
                    ? Object.keys(playerIdCount)[0]
                    : Object.keys(playerIdCount).reduce((a, b) =>
                          playerIdCount[a] > playerIdCount[b] ? a : b
                      );
            if (user_id == 2) {
                //set to second key
                matchPlayerId = Object.keys(playerIdCount)[0];
            }
            if (participant_id == 245565315) {
                console.log(user_id);
            }
            console.log(`Match-specific player ID: ${matchPlayerId}`);
            // Update participant's match-specific Challonge ID in Participants table
            await new Promise((resolve, reject) => {
                db.run(
                    `UPDATE Participants SET challonge_id = ?, group_id = ? WHERE user_id = ? AND tournament_id = ?`,
                    [matchPlayerId, group_id, user_id, tournamentId],
                    (err) => {
                        if (err) {
                            console.error(
                                "Error updating challonge_id in Participants table:",
                                err.message
                            );
                            reject("Failed to update participant data.");
                        } else {
                            resolve();
                        }
                    }
                );
            });

            // Step 3: Insert each match into the Matches table if it doesn't exist
            for (const match of matches) {
                const {
                    id: challongeMatchId,
                    player1_id,
                    player2_id,
                    winner_id,
                    state,
                    scores_csv,
                    updated_at,
                    suggested_play_order,
                } = match.match;

                const player1Score = scores_csv
                    ? parseInt(scores_csv.split("-")[0])
                    : null;
                const player2Score = scores_csv
                    ? parseInt(scores_csv.split("-")[1])
                    : null;

                // Check if match exists in the Matches table
                const matchExists = await new Promise((resolve, reject) => {
                    db.get(
                        `SELECT 1 FROM Matches WHERE challonge_match_id = ? AND tournament_id = ?`,
                        [challongeMatchId, tournamentId],
                        (err, row) => {
                            if (err) reject("Error checking match existence.");
                            resolve(!!row);
                        }
                    );
                });

                if (!matchExists) {
                    await new Promise((resolve, reject) => {
                        db.run(
                            `INSERT INTO Matches (match_id, tournament_id, player1_id, player2_id, winner_id, challonge_match_id, state, player1_score, player2_score, updated_at, suggested_play_order, group_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                            [
                                challongeMatchId,
                                tournamentId,
                                player1_id,
                                player2_id,
                                winner_id,
                                challongeMatchId,
                                state,
                                player1Score,
                                player2Score,
                                updated_at,
                                suggested_play_order,
                                group_id,
                            ],
                            (err) => {
                                if (err) {
                                    console.error(
                                        "Error inserting match:",
                                        err.message
                                    );
                                    reject("Failed to insert match.");
                                } else {
                                    resolve();
                                }
                            }
                        );
                    });
                    // console.log(
                    //     `Added match ${challongeMatchId} to Matches table for tournament ${tournamentId}.`
                    // );
                } else {
                    //update instead of insert
                    await new Promise((resolve, reject) => {
                        db.run(
                            `UPDATE Matches SET player1_id = ?, player2_id = ?, winner_id = ?, state = ?, player1_score = ?, player2_score = ?, updated_at = ?, suggested_play_order = ?, group_id = ? WHERE challonge_match_id = ? AND tournament_id = ?`,
                            [
                                player1_id,
                                player2_id,
                                winner_id,
                                state,
                                player1Score,
                                player2Score,
                                updated_at,
                                suggested_play_order,
                                group_id,
                                challongeMatchId,
                                tournamentId,
                            ],
                            (err) => {
                                if (err) {
                                    console.error(
                                        "Error updating match:",
                                        err.message
                                    );
                                    reject("Failed to update match.");
                                } else {
                                    resolve();
                                }
                            }
                        );
                    });
                    // console.log(
                    //     `Updated match ${challongeMatchId} in Matches table for tournament ${tournamentId}.`
                    // );
                }
            }
        }

        console.log(
            "All participants and matches have been updated successfully."
        );
    } catch (error) {
        console.error("Error updating participants and matches:", error);
    } finally {
        db.close((err) => {
            if (err) console.error("Error closing the database:", err.message);
        });
    }
};
async function rejectMatch(interaction) {
    // const scoreEmbed = interaction.message.embeds[0];
    // const updatedEmbed = EmbedBuilder.from(scoreEmbed)
    //     .setTitle("Match Rejected")
    //     .setFooter({
    //         text: "Match Rejected by " + interaction.user.tag,
    //     })
    //     .setColor(0xff0000); // Set color to red for rejection
    // await interaction.update({
    //     embeds: [updatedEmbed],
    //     components: [], // Removes the buttons
    // });
}
async function confirmMatch(interaction, extra) {
    const [matchId, submitterId, opponentId] = extra.split("_");
    const scoreEmbed = interaction.message.embeds[0];
    // [0] - submitter score, [1] - opponent score
    const score = scoreEmbed.fields[2].value.split(" - ");

    // Open a connection to the SQLite database
    const db = new sqlite3.Database("./data.db");

    try {
        // Step 1: Retrieve tournament_id from the Matches table using matchId
        const tournamentId = await new Promise((resolve, reject) => {
            db.get(
                `SELECT tournament_id FROM Matches WHERE match_id = ?`,
                [matchId],
                (err, row) => {
                    if (err) {
                        console.error("Error fetching tournament_id:", err);
                        return reject("Failed to retrieve tournament_id.");
                    }
                    resolve(row ? row.tournament_id : null);
                }
            );
        });

        if (!tournamentId) {
            console.log("Tournament ID not found for the given match.");
            return interaction.reply(
                "Tournament ID not found for the specified match."
            );
        }
        // Step 2: Retrieve challonge_id for submitter and opponent from the Participants table
        const [submitterChallongeId, opponentChallongeId] = await Promise.all([
            new Promise((resolve, reject) => {
                db.get(
                    `SELECT challonge_id FROM Participants WHERE user_id = ? AND tournament_id = ?`,
                    [submitterId, tournamentId],
                    (err, row) => {
                        if (err) {
                            console.error(
                                "Error fetching submitter challonge_id:",
                                err
                            );
                            return reject(
                                "Failed to retrieve submitter's challonge_id."
                            );
                        }
                        resolve(row ? row.challonge_id : null);
                    }
                );
            }),
            new Promise((resolve, reject) => {
                db.get(
                    `SELECT challonge_id FROM Participants WHERE user_id = ? AND tournament_id = ?`,
                    [3 || opponentId, tournamentId],
                    (err, row) => {
                        if (err) {
                            console.error(
                                "Error fetching opponent challonge_id:",
                                err
                            );
                            return reject(
                                "Failed to retrieve opponent's challonge_id."
                            );
                        }
                        resolve(row ? row.challonge_id : null);
                    }
                );
            }),
        ]);

        if (!submitterChallongeId || !opponentChallongeId) {
            console.log(
                "Challonge IDs not found for one or both participants."
            );
            return interaction.reply(
                "Challonge IDs not found for one or both participants."
            );
        }
        const match = await new Promise((resolve, reject) => {
            db.get(
                `SELECT player1_id, player2_id FROM Matches WHERE match_id = ?`,
                [matchId],
                (err, row) => {
                    if (err) {
                        console.error("Error fetching match details:", err);
                        return reject("Failed to retrieve match details.");
                    }
                    resolve(row);
                }
            );
        });

        if (!match) {
            console.log("Match not found.");
            return interaction.reply("Match not found.");
        }
        const isSubmitterPlayer1 = submitterChallongeId === match.player1_id;

        let player1Score, player2Score;

        // Assign scores based on the submitter's position
        if (isSubmitterPlayer1) {
            player1Score = parseInt(score[0], 10); // Submitter's score
            player2Score = parseInt(score[1], 10); // Opponent's score
        } else {
            player1Score = parseInt(score[1], 10); // Opponent's score
            player2Score = parseInt(score[0], 10); // Submitter's score
        }

        const scoresCsv = `${player1Score}-${player2Score}`;
        console.log(`Scores CSV: ${scoresCsv}`);

        let winnerId;
        console.log(`Player 1 Score: ${player1Score}`);
        console.log(`Player 2 Score: ${player2Score}`);
        if (player1Score > player2Score) {
            if (isSubmitterPlayer1) {
                winnerId = submitterChallongeId;
            } else {
                winnerId = opponentChallongeId;
            }
        } else if (player2Score > player1Score) {
            if (isSubmitterPlayer1) {
                winnerId = opponentChallongeId;
            } else {
                winnerId = submitterChallongeId;
            }
        } else {
            winnerId = null; // Draw
        }
        console.log(`Winner ID: ${winnerId}`);
        console.log(`Match ID: ${matchId}`);

        // Update Challonge match
        const apiUrl = `https://api.challonge.com/v1/tournaments/${tournamentId}/matches/${matchId}.json`;
        const params = {
            api_key: process.env.API_KEY,
        };
        const data = {
            match: {
                scores_csv: scoresCsv,
                winner_id: winnerId,
            },
        };

        try {
            const response = await axios.put(apiUrl, data, { params });
            if (response.status === 200) {
                console.log(`Match updated successfully: ${response.data}`);
            } else {
                console.log(
                    `Unexpected response from Challonge: ${response.data}`
                );
                interaction.reply(
                    "Unexpected response from Challonge. Please try again later."
                );
            }
        } catch (error) {
            console.error(
                "Error updating match on Challonge:",
                error.response ? error.response.data : error.message
            );
            interaction.reply(
                "Failed to update match on Challonge. Please try again."
            );
        }
    } catch (error) {
        console.error("An error occurred:", error);
        interaction.reply("An error occurred while retrieving Challonge IDs.");
    } finally {
        db.close();
    }
    //TODO update our database

    const updatedEmbed = EmbedBuilder.from(scoreEmbed)
        .setTitle("Match Confirmed")
        .setFooter({
            text: "Match Confirmed by " + interaction.user.tag,
        })
        .setColor(0x00ff00); // Set color to green for confirmation

    await interaction.update({
        embeds: [updatedEmbed],
        components: [], // Removes the buttons
    });
}

async function getLeagueStandings(tournamentId, tournamentName) {
    let standings = {
        tournamentId,
        tournamentName,
        groups: {},
    };

    const db = new sqlite3.Database("./data.db", (err) => {
        if (err) {
            console.error("Database connection error:", err.message);
            return interaction.reply("Failed to connect to the database.");
        }
    });

    const matches = await getAllMatchesFromTournamentId(tournamentId);

    for (const match of matches) {
        const groupId = match.group_id;
        if (!groupId) continue;

        if (!standings.groups[groupId]) {
            standings.groups[groupId] = { standings: {} };
        }

        const playerIds = [match.player1_id, match.player2_id];
        for (const playerId of playerIds) {
            if (!standings.groups[groupId].standings[playerId]) {
                standings.groups[groupId].standings[playerId] = {
                    rank: 0,
                    name: (await getNameFromChallongeId(playerId))
                        .substring(0, 15)
                        .padEnd(15, " "),
                    wins: 0,
                    losses: 0,
                    draws: 0,
                    points: 0,
                    played: 0,
                };
            }
        }

        const [player1, player2] = playerIds;
        if (match.winner_id === "draw") {
            standings.groups[groupId].standings[player1].draws++;
            standings.groups[groupId].standings[player2].draws++;
            standings.groups[groupId].standings[player1].points++;
            standings.groups[groupId].standings[player2].points++;
            standings.groups[groupId].standings[player1].played++;
            standings.groups[groupId].standings[player2].played++;
        } else if (match.winner_id === player1) {
            standings.groups[groupId].standings[player1].wins++;
            standings.groups[groupId].standings[player2].losses++;
            standings.groups[groupId].standings[player1].points += 3;
            standings.groups[groupId].standings[player1].played++;
            standings.groups[groupId].standings[player2].played++;
        } else if (match.winner_id === player2) {
            standings.groups[groupId].standings[player2].wins++;
            standings.groups[groupId].standings[player1].losses++;
            standings.groups[groupId].standings[player2].points += 3;
            standings.groups[groupId].standings[player2].played++;
            standings.groups[groupId].standings[player1].played++;
        }
    }

    return standings;
}
// Run the function with a specific tournament ID
module.exports = {
    add_tournament,
    fetchTournamentsFromDatabase,
    handleCancelRemove,
    handleConfirmRemove,
    getTournamentIdByName,
    getParticipantMapping,
    rejectMatch,
    confirmMatch,
    updateParticipantMatchPlayerIdsAndMatches,
    getLeagueStandings,
};
