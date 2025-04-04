const { Pool } = require("pg");
const axios = require("axios");
const { only } = require("node:test");
const { ChannelType, ThreadAutoArchiveDuration } = require("discord.js");
const { match } = require("assert");
const { table } = require("table");
const { fetchTournamentsFromDatabase, getLeagueStandings } = require("./util");
const { chownSync } = require("fs");
// PostgreSQL configuration
require("dotenv").config();
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
const getAllParticipants = async (tournamentId) => {
    const query = `SELECT * FROM Participants WHERE tournament_id = $1`;
    const values = [tournamentId];

    try {
        const result = await pool.query(query, values);
        return result.rows;
    } catch (err) {
        console.error("Failed to retrieve participants:", err.message);
        throw new Error("Failed to retrieve participants.");
    }
};
//recrate this function with pg
const getSortedParticipants = async (tournamentId) => {
    const query = `
        SELECT U.autodarts_name, U.avg 
        FROM Participants P
        JOIN Users U ON P.user_id = U.user_id 
        WHERE P.tournament_id = $1 
        ORDER BY avg DESC
    `;
    const values = [tournamentId];

    try {
        const result = await pool.query(query, values);
        return result.rows;
    } catch (err) {
        console.error("Failed to retrieve participants:", err.message);
        throw new Error("Failed to retrieve participants.");
    }
};
/**
 * Retrieves the tournament ID by its name.
 */
async function getTournamentIdByName(tournamentName) {
    const query = `SELECT tournament_id FROM Tournaments WHERE name = $1`;
    const values = [tournamentName];

    try {
        const result = await pool.query(query, values);
        if (result.rows.length === 0) throw new Error("Tournament not found.");
        return result.rows[0].tournament_id;
    } catch (err) {
        console.error("Error querying database:", err.message);
        throw new Error("Failed to retrieve tournament ID.");
    }
}
async function handleDropOutMidTournament(tournamentName, discordId) {
    try {
        // Step 1: Retrieve tournament_id and participant details
        const tournamentRow = await getTournamentIdByName(tournamentName);

        if (!tournamentRow) {
            return interaction.reply("Tournament not found in the database.");
        }

        const participantRow = await getParticipantDataFromTournamentUserId(
            tournamentRow,
            discordId
        );

        if (!participantRow) {
            return interaction.reply(
                "You are not registered in this tournament."
            );
        }

        const challongeParticipantId = participantRow.participant_id;

        // Step 2: Remove participant from Challonge
        const apiUrl = `https://api.challonge.com/v1/tournaments/${tournamentRow}/participants/${challongeParticipantId}.json`;
        const params = { api_key: process.env.API_KEY };
        await axios.delete(apiUrl, { params });

        if (tournamentRow.status == "started") {
            //challonge will handle granting wins to the other player
            //TODO
        }

        // Step 3: Remove participant from the local database
        try {
            await removeParticipantFromTournament(tournamentRow, discordId);
            //create an embed
            const embed = new EmbedBuilder()
                .setTitle("Dropped out from the tournament")
                .setDescription(
                    `You have successfully dropped out from the tournament **${tournamentName}**.`
                )
                .setFooter({ text: "Tournament ID: " + tournamentRow })
                .setColor(0xff0000);

            return interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error("Database error:", error.message);
            return interaction.reply(
                "Failed to drop out from the tournament in the database."
            );
        }
    } catch (error) {
        console.error("Error dropping out mid-tournament:", error);
        return interaction.reply("Failed to drop out mid-tournament.");
    }
}
/**
 * Retrieves match details using the AutoDarts match ID.
 */
async function getMatchFromAutodartsMatchId(autodartsMatchId) {
    const query = `SELECT * FROM Matches WHERE autodarts_match_id = $1`;
    const values = [autodartsMatchId];

    try {
        const result = await pool.query(query, values);
        if (result.rows.length === 0) throw new Error("Match not found.");
        return result.rows[0];
    } catch (err) {
        console.error("Failed to retrieve match details:", err.message);
        throw new Error("Failed to retrieve match details.");
    }
}

async function getChallongeTournamentURL(tournamentId) {
    const url = `https://api.challonge.com/v1/tournaments/${tournamentId}.json`;
    const params = { api_key: process.env.API_KEY };

    try {
        const response = await axios.get(url, { params });
        return response.data.tournament.full_challonge_url;
    } catch (error) {
        console.error("Error fetching tournament URL:", error);
        throw new Error("Failed to fetch tournament URL.");
    }
}

/**
 * Retrieves all matches for a given tournament ID.
 */
async function getAllMatchesFromTournamentId(tournamentId) {
    const query = `SELECT * FROM Matches WHERE tournament_id = $1`;
    const values = [tournamentId];

    try {
        const result = await pool.query(query, values);
        return result.rows;
    } catch (err) {
        console.error("Error querying matches:", err.message);
        throw err;
    }
}

async function updateTournamentStatus(tournamentId, status) {
    const query = `UPDATE Tournaments SET status = $1 WHERE tournament_id = $2`;
    const values = [status, tournamentId];

    try {
        await pool.query(query, values);
    } catch (err) {
        console.error("Error updating tournament status:", err.message);
        throw new Error("Failed to update tournament status.");
    }
}

/**
 * Retrieves the tournament ID using the AutoDarts match ID.
 */
async function getTournamentIdFromAutodartsMatchId(autodartsMatchId) {
    const query = `SELECT tournament_id FROM Matches WHERE autodarts_match_id = $1`;
    const values = [autodartsMatchId];

    try {
        const result = await pool.query(query, values);
        if (result.rows.length === 0) throw new Error("Tournament not found.");
        return result.rows[0].tournament_id;
    } catch (err) {
        console.error("Failed to retrieve tournament ID:", err.message);
        throw new Error("Failed to retrieve tournament ID.");
    }
}

/**
 * Retrieves the user ID using the AutoDarts ID.
 */
async function getUserIdFromAutodartsId(autodartsId) {
    const query = `SELECT user_id FROM Users WHERE autodarts_id = $1`;
    const values = [autodartsId];

    try {
        const result = await pool.query(query, values);
        if (result.rows.length === 0) return null;
        return result.rows[0].user_id;
    } catch (err) {
        console.error("Failed to retrieve user ID:", err.message);
        console.error("Failed to retrieve user ID.");
    }
}

/**
 * Retrieves the Challonge ID using the user ID and tournament ID.
 */
async function getChallongeIdFromUserIdTournamentId(userId, tournamentId) {
    console.log(
        "Fetching Challonge ID for user",
        userId,
        "and tournament",
        tournamentId
    );
    const query = `SELECT challonge_id FROM Participants WHERE user_id = $1 AND tournament_id = $2`;
    //const query =
    //"SELECT challonge_id FROM Participants WHERE user_id = '1299435641171607553' AND tournament_id = 15362165";
    const values = [userId, tournamentId];

    //check if tournament id is actually an object as some may pass in as {"tounament_id": 1234} if so, extract the id

    if (typeof tournamentId === "object") {
        tournamentId = tournamentId.tournament_id;
    }

    //console log query put values in it to test
    try {
        //const result = await pool.query(query, values);
        const result = await pool.query(query, values);
        if (result.rows.length === 0)
            throw new Error("Challonge ID not found.");
        return result.rows[0].challonge_id;
    } catch (err) {
        console.error("Failed to retrieve Challonge ID:", err.message);
        return null;
    }
}

/**
 * Retrieves a local match using the players' Challonge IDs and tournament ID.
 */
async function getLocalMatchFromPlayersChallongeIdTournamentId(
    player1_challonge_id,
    player2_challonge_id,
    tournament_id
) {
    const query = `
        SELECT * FROM Matches
        WHERE tournament_id = $1
        AND ((player1_id = $2 AND player2_id = $3)
        OR (player1_id = $3 AND player2_id = $2))
    `;
    const values = [tournament_id, player1_challonge_id, player2_challonge_id];

    try {
        const result = await pool.query(query, values);
        if (result.rows.length === 0) throw new Error("Match not found.");
        return result.rows[0];
    } catch (err) {
        console.error("Failed to retrieve match details:", err.message);
        return null;
    }
}

/**
 * Updates a local match with the provided match information.
 */
async function updateLocalMatch(matchInfo) {
    console.log("Updating match:", matchInfo);
    const query = `
        UPDATE Matches 
        SET winner_id = $1, state = $2, player1_score = $3, player2_score = $4, autodarts_match_id = $5
        WHERE match_id = $6
    `;
    const values = [
        matchInfo.winnerChallongeId,
        matchInfo.state,
        matchInfo.scores_csv[0],
        matchInfo.scores_csv[2],
        matchInfo.matchId,
        matchInfo.db_match.match_id,
    ];
    console.log("Values:", values);

    try {
        await pool.query(query, values);
    } catch (err) {
        console.error("Error updating match:", err.message);
        throw new Error("Failed to update match.");
    }
}

/**
 * Updates the statistics for a user in the database.
 */
async function updateStats(user_id, match_id, tournament_id, stats) {
    const query = `
        INSERT INTO Stats (
            user_id, match_id, tournament_id, average, average_until_170, first_9_average, checkout_percent,
            darts_thrown, best_checkout, points_60_plus, points_100_plus, points_140_plus, points_170_plus, points_180
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (user_id, match_id, tournament_id) DO UPDATE 
        SET average = EXCLUDED.average, average_until_170 = EXCLUDED.average_until_170, 
            first_9_average = EXCLUDED.first_9_average, checkout_percent = EXCLUDED.checkout_percent,
            darts_thrown = EXCLUDED.darts_thrown, best_checkout = EXCLUDED.best_checkout,
            points_60_plus = EXCLUDED.points_60_plus, points_100_plus = EXCLUDED.points_100_plus,
            points_140_plus = EXCLUDED.points_140_plus, points_170_plus = EXCLUDED.points_170_plus,
            points_180 = EXCLUDED.points_180;
    `;
    const values = [
        user_id,
        match_id,
        tournament_id,
        stats.average,
        stats.averageUntil170,
        stats.first9Average,
        stats.checkoutPercent,
        stats.dartsThrown,
        stats.bestCheckout,
        stats.plus60,
        stats.plus100,
        stats.plus140,
        stats.plus170,
        stats.total180,
    ];

    try {
        await pool.query(query, values);
    } catch (err) {
        console.error("Error updating stats:", err.message);
        throw new Error("Failed to add stats.");
    }
}

/**
 * Inserts a new tournament into the database.
 */
async function insertNewTournament(tournament) {
    const query = `
        INSERT INTO Tournaments (tournament_id, challonge_id, name, status, start_date, end_date, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
    `;
    const values = [
        tournament.id,
        tournament.id, // Challonge ID
        tournament.name,
        tournament.state,
        tournament.start_at ? tournament.start_at.split("T")[0] : null,
        tournament.completed_at ? tournament.completed_at.split("T")[0] : null,
    ];

    try {
        await pool.query(query, values);
        console.log(
            `Tournament ${tournament.name} added with ID ${tournament.id}`
        );
    } catch (err) {
        console.error("Database insertion error:", err.message);
    }
}

/**
 * Confirms a match for a player.
 */
async function confirmMatch(autodartsMatchId, playerIndex) {
    const query = `UPDATE Matches SET player${
        playerIndex + 1
    }_confirmed = 1 WHERE autodarts_match_id = $1`;
    const values = [autodartsMatchId];

    try {
        await pool.query(query, values);
    } catch (err) {
        console.error("Failed to confirm match:", err.message);
        throw new Error("Failed to confirm match.");
    }
}

/**
 * Rejects a match for a player.
 */
async function rejectMatch(autodartsMatchId, playerIndex) {
    const query = `UPDATE Matches SET player${
        playerIndex + 1
    }_confirmed = -1 WHERE autodarts_match_id = $1`;
    const values = [autodartsMatchId];

    try {
        await pool.query(query, values);
    } catch (err) {
        console.error("Failed to reject match:", err.message);
        throw new Error("Failed to reject match.");
    }
}

/**
 * Retrieves the active tournament ID.
 */
async function getActiveTournamentId() {
    const query = `SELECT tournament_id FROM Tournaments WHERE active = 1`;

    try {
        const result = await pool.query(query);
        if (result.rows.length === 0)
            throw new Error("Active tournament not found.");
        return result.rows[0].tournament_id;
    } catch (err) {
        console.error("Failed to retrieve active tournament:", err.message);
        throw new Error("Failed to retrieve active tournament.");
    }
}

async function getParticipantDataFromTournamentUserId(tournamentId, userId) {
    //make userId an integer
    if (process.env.DEBUG == "true") {
        console.log(
            "Fetching participant data for tournament",
            tournamentId,
            "and user",
            userId
        );
    }
    const query = `
        SELECT *
        FROM Participants P
        WHERE P.tournament_id = $1 AND P.user_id = $2
    `;
    const values = [tournamentId, userId];

    try {
        const result = await pool.query(query, values);
        if (result.rows.length === 0) return null;
        return result.rows[0];
    } catch (err) {
        console.error("Failed to retrieve participant data:", err.message);
        throw new Error("Failed to retrieve participant data.");
    }
}
async function removeParticipantFromTournament(tournamentId, userId) {
    const query = `DELETE FROM Participants WHERE tournament_id = $1 AND user_id = $2`;
    const values = [tournamentId, userId];

    try {
        await pool.query(query, values);
    } catch (err) {
        console.error("Failed to remove participant:", err.message);
        throw new Error("Failed to remove participant.");
    }
}
async function getAllMatchesForPlayer(playerId, tournamentId) {
    //example from sqlite3
    // let matches = await new Promise((resolve, reject) => {
    //     db.all(
    //         `SELECT M.match_id, M.player1_id, M.player2_id, M.winner_id, M.state,
    //                         M.player1_score, M.player2_score, M.suggested_play_order, M.group_id,
    //                         U1.autodarts_name AS player1_name, U1.discord_tag AS discord1_tag, U2.discord_tag as discord2_tag, U2.autodarts_name AS player2_name
    //                  FROM Matches M
    //                  JOIN Participants P1 ON M.player1_id = P1.challonge_id
    //                  JOIN Participants P2 ON M.player2_id = P2.challonge_id
    //                  JOIN Users U1 ON P1.user_id = U1.user_id
    //                  JOIN Users U2 ON P2.user_id = U2.user_id
    //                  WHERE M.tournament_id = ? AND (M.player1_id = ? OR M.player2_id = ?)
    //                  ORDER BY M.suggested_play_order ASC`, // Order by suggested_play_order directly in SQL
    //         [tournamentId, matchPlayerId, matchPlayerId],
    //         (err, rows) => {
    //             if (err) {
    //                 console.error("Error fetching matches:", err);
    //                 reject("Failed to retrieve matches.");
    //             }
    //             resolve(rows);
    //         }
    //     );
    // });
    //do this but with pg
    const query = `
        SELECT M.match_id, M.player1_id, M.player2_id, M.winner_id, M.state, 
        M.player1_score, M.player2_score, M.suggested_play_order, M.group_id,
        U1.autodarts_name AS player1_name, U1.discord_tag AS discord1_tag, U2.discord_tag as discord2_tag, U2.autodarts_name AS player2_name
        FROM Matches M
        JOIN Participants P1 ON M.player1_id = P1.challonge_id
        JOIN Participants P2 ON M.player2_id = P2.challonge_id
        JOIN Users U1 ON P1.user_id = U1.user_id
        JOIN Users U2 ON P2.user_id = U2.user_id
        WHERE M.tournament_id = $1 AND (M.player1_id = $2 OR M.player2_id = $2)
        ORDER BY M.suggested_play_order ASC
    `;
    const values = [tournamentId, playerId];

    try {
        const result = await pool.query(query, values);
        return result.rows;
    } catch (err) {
        console.error("Error querying matches:", err.message);
        throw err;
    }
}

async function getNameFromChallongeId(challongeIds) {
    // Ensure challongeIds is an array and cast to integers
    const normalizedIds = Array.isArray(challongeIds)
        ? challongeIds.map((id) => parseInt(id, 10))
        : [parseInt(challongeIds, 10)];

    const query = `
        SELECT p.challonge_id, u.discord_tag
        FROM Participants p
        INNER JOIN Users u ON p.user_id = u.user_id
        WHERE p.challonge_id = ANY($1::integer[])
    `;

    try {
        const result = await pool.query(query, [normalizedIds]);
        return Object.fromEntries(
            result.rows.map((row) => [row.challonge_id, row.discord_tag])
        );
    } catch (err) {
        console.error("Failed to retrieve user names:", err.message);
        throw new Error("Failed to retrieve user names.");
    }
}
async function updateParticipantMatchPlayerIdsAndMatches(tournamentId) {
    console.log(`Fetching participants for tournament ${tournamentId}`);

    try {
        const client = await pool.connect();

        // Fetch all participants in the tournament
        const participants = await client.query(
            `SELECT participant_id, user_id FROM Participants WHERE tournament_id = $1`,
            [tournamentId]
        );

        console.log(participants.rows);

        // First loop to update the Participants table
        for (const participant of participants.rows) {
            const { user_id, participant_id } = participant;
            console.log(
                `Updating participant ${participant_id} for user ${user_id}`
            );

            const apiUrl = `https://api.challonge.com/v1/tournaments/${tournamentId}/participants/${participant_id}.json`;
            const params = { api_key: process.env.API_KEY, include_matches: 1 };

            // Fetch participant's data
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
            let matchPlayerId =
                Object.keys(playerIdCount).length === 1
                    ? Object.keys(playerIdCount)[0]
                    : Object.keys(playerIdCount).reduce((a, b) =>
                          playerIdCount[a] > playerIdCount[b] ? a : b
                      );

            console.log(`Match-specific player ID: ${matchPlayerId}`);

            // Update participant's match-specific Challonge ID in Participants table
            await client.query(
                `UPDATE Participants SET challonge_id = $1, group_id = $2 WHERE user_id = $3 AND tournament_id = $4`,
                [matchPlayerId, group_id, user_id, tournamentId]
            );
        }

        // Second loop to process matches for each participant in the Matches table
        for (const participant of participants.rows) {
            const { participant_id } = participant;

            const apiUrl = `https://api.challonge.com/v1/tournaments/${tournamentId}/participants/${participant_id}.json`;
            const params = { api_key: process.env.API_KEY, include_matches: 1 };

            // Fetch participant's matches data
            const response = await axios.get(apiUrl, { params });
            const matches = response.data.participant.matches;
            const group_id = matches[0].match.group_id;
            // Process each match
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
                const matchExists = await client.query(
                    `SELECT 1 FROM Matches WHERE challonge_match_id = $1 AND tournament_id = $2`,
                    [challongeMatchId, tournamentId]
                );

                if (matchExists.rowCount === 0) {
                    // Insert the match if it doesn't exist
                    await client.query(
                        `INSERT INTO Matches (match_id, tournament_id, player1_id, player2_id, winner_id, challonge_match_id, state, player1_score, player2_score, updated_at, suggested_play_order, group_id)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
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
                        ]
                    );
                    console.log(
                        `Added match ${challongeMatchId} to Matches table for tournament ${tournamentId}.`
                    );
                } else {
                    // Update the match if it exists
                    await client.query(
                        `UPDATE Matches SET player1_id = $1, player2_id = $2, winner_id = $3, state = $4, player1_score = $5, player2_score = $6, updated_at = $7, suggested_play_order = $8, group_id = $9 
                 WHERE challonge_match_id = $10 AND tournament_id = $11`,
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
                        ]
                    );
                    console.log(
                        `Updated match ${challongeMatchId} in Matches table for tournament ${tournamentId}.`
                    );
                }
            }
        }

        console.log(
            "All participants and matches have been updated successfully."
        );
    } catch (error) {
        console.error("Error updating participants and matches:", error);
    }
}

const upsertUser = async (
    discordId,
    userTag,
    autodartUsername,
    challonge_id,
    average,
    profileUrl
) => {
    try {
        const client = await pool.connect();
        const result = await client.query(
            `SELECT * FROM Users WHERE user_id = $1`,
            [discordId]
        );

        if (result.rows.length === 0) {
            // User does not exist; insert into Users table
            await client.query(
                `INSERT INTO Users (user_id, discord_tag, autodarts_name, challonge_id, created_at, updated_at, avg, autodarts_id)
                 VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $5, $6)`,
                [
                    discordId,
                    userTag,
                    autodartUsername,
                    challonge_id,
                    average,
                    profileUrl.split("/").pop(),
                ]
            );
        } else {
            // User exists; update the autodarts_name
            await client.query(
                `UPDATE Users 
                 SET autodarts_name = $1, avg = $2, updated_at = CURRENT_TIMESTAMP
                 WHERE user_id = $3`,
                [autodartUsername, average, discordId]
            );
        }

        client.release();
    } catch (error) {
        console.error("Error upserting user:", error);
        throw new Error("Failed to upsert user.");
    }
};
const upsertParticipant = async (userId, tournamentId, challongeId) => {
    try {
        const client = await pool.connect();
        const result = await client.query(
            `SELECT * FROM Participants WHERE user_id = $1 AND tournament_id = $2`,
            [userId, tournamentId]
        );

        if (result.rows.length === 0) {
            // Participant does not exist; insert into Participants table
            await client.query(
                `INSERT INTO Participants (participant_id, user_id, tournament_id, challonge_id, joined_at)
                 VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
                [challongeId, userId, tournamentId, challongeId]
            );
        } else {
            // Participant exists; update the challonge_id
            await client.query(
                `UPDATE Participants 
                 SET challonge_id = $1
                 WHERE user_id = $2 AND tournament_id = $3`,
                [challongeId, userId, tournamentId]
            );
        }

        client.release();
    } catch (error) {
        console.error("Error upserting participant:", error);
        throw new Error("Failed to upsert participant.");
    }
};

const fetchTournamentsFromDatabase2 = async (active) => {
    try {
        let query = `SELECT name FROM Tournaments`;
        if (active) {
            query += ` WHERE active = 1`;
        }
        const result = await pool.query(query); // No explicit connect/release needed
        return result.rows;
    } catch (error) {
        console.error("Error fetching tournaments:", error);
        throw new Error("Failed to fetch tournaments.");
    }
};
const fetchAllTourneys = async (onlyActive = false) => {
    try {
        let query = `SELECT * FROM Tournaments`;
        if (onlyActive) {
            query += ` WHERE active = 1`;
        }
        const result = await pool.query(query);
        return result.rows;
    } catch (error) {
        console.error("Error fetching tournaments:", error);
        throw new Error("Failed to fetch tournaments.");
    }
};

async function getTournamentStatus(tournamentId) {
    const query = `SELECT status FROM Tournaments WHERE tournament_id = $1`;
    const values = [tournamentId];

    try {
        const result = await pool.query(query, values);
        if (result.rows.length === 0) throw new Error("Tournament not found.");
        return result.rows[0].status;
    } catch (err) {
        console.error("Error querying database:", err.message);
        throw new Error("Failed to retrieve tournament status.");
    }
}
async function getDivisionNumbers(tournamentId) {
    //get all the group_ids from matches table for the tournament
    const query = `SELECT DISTINCT group_id FROM Matches WHERE tournament_id = $1 ORDER BY group_id`;
    const values = [tournamentId];

    try {
        const result = await pool.query(query, values);
        if (result.rows.length === 0) throw new Error("No groups found.");
        //[{ group_id: 5915608 }, { group_id: 5915607 }];
        //now create an object which will be key group_id and value will be the number of the group
        //lowest number is division 1

        let divisionNumbers = {};
        let i = 1;
        result.rows.forEach((group) => {
            divisionNumbers[group.group_id] = i;
            i++;
        });
        return divisionNumbers;
    } catch (err) {
        console.error("Error querying database:", err.message);
        throw new Error("Failed to retrieve groups.");
    }
}
const getTournamentStatusForUser = async (userId) => {
    const query = `
        SELECT * 
        FROM Participants 
        JOIN Tournaments 
        ON Participants.tournament_id = Tournaments.tournament_id 
        WHERE Participants.user_id = $1 
        AND Tournaments.active = 1
    `;
    const values = [userId];

    try {
        const result = await pool.query(query, values);
        //get all tournaments and then return an object with tournament_id: signed_up boolean
        let tournaments = {};
        result.rows.forEach((tournament) => {
            tournaments[tournament.tournament_id] = true;
        });
        //then get all tournaments from the database
        const allTournaments = await fetchAllTourneys((onlyActive = true));
        allTournaments.forEach((tournament) => {
            if (!tournaments[tournament.tournament_id]) {
                tournaments[tournament.tournament_id] = false;
            }
        });
        return tournaments;
    } catch (err) {
        console.error("Error querying database:", err.message);
        throw new Error("Failed to retrieve tournaments.");
    }
};
const getTournamentNameById = async (tournamentId) => {
    const query = `SELECT name FROM Tournaments WHERE tournament_id = $1`;
    const values = [tournamentId];

    try {
        const result = await pool.query(query, values);
        if (result.rows.length === 0) throw new Error("Tournament not found.");
        return result.rows[0].name;
    } catch (err) {
        console.error("Error querying database:", err.message);
        throw new Error("Failed to retrieve tournament name.");
    }
};
const isTournamentActive = async (tournamentId) => {
    const query = `SELECT active FROM Tournaments WHERE tournament_id = $1`;
    const values = [tournamentId];

    try {
        const result = await pool.query(query, values);
        if (result.rows.length === 0) throw new Error("Tournament not found.");
        return result.rows[0].active;
    } catch (err) {
        console.error("Error querying database:", err.message);
        throw new Error("Failed to retrieve tournament status.");
    }
};
const getUserIdFromChallongeId = async (challongeId) => {
    const query = `SELECT user_id FROM Participants WHERE challonge_id = $1`;
    const values = [challongeId];

    try {
        const result = await pool.query(query, values);
        if (result.rows.length === 0) return null;
        return result.rows[0].user_id;
    } catch (err) {
        console.error("Failed to retrieve user ID:", err.message);
        throw new Error("Failed to retrieve user ID.");
    }
};
const getAverageFromChallongeId = async (challongeId) => {
    const query = `SELECT avg FROM Users WHERE user_id = (SELECT user_id FROM Participants WHERE challonge_id = $1)`;
    const values = [challongeId];

    try {
        const result = await pool.query(query, values);
        if (result.rows.length === 0) return null;
        return result.rows[0].avg;
    } catch (err) {
        console.error("Failed to retrieve user ID:", err.message);
        throw new Error("Failed to retrieve user ID.");
    }
};
async function findThreadByMatchId(guild, matchId) {
    try {
        // Fetch all channels in the guild
        const channels = await guild.channels.fetch();

        // Filter for GuildForum channels
        const forumChannels = channels.filter(
            (channel) => channel.type === ChannelType.GuildForum
        );

        if (forumChannels.size === 0) {
            console.log("No forum channels found in this guild.");
            return null;
        }
        for (const [channelId, forumChannel] of forumChannels) {
            // Fetch active threads in the forum channel
            const threads = await forumChannel.threads.fetchActive();

            if (threads.size === 0) {
                continue;
            }

            // Search through threads for the match ID
            for (const [threadId, thread] of threads.threads) {
                const foundMatchId = thread.name.match(/\[ID:(\d+)\]/)?.[1];
                if (foundMatchId == matchId) {
                    return thread; // Return the found thread
                }
            }
        }

        // If no match is found
        return null;
    } catch (error) {
        console.error("Error finding forum thread by match ID:", error);
        return null;
    }
}
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createTournamentChannels(
    tournamentId,
    interaction,
    divisionChannels,
    client
) {
    const fixtureThreads = [];

    try {
        // Fetch tournament matches
        const matches = await getAllMatchesFromTournamentId(tournamentId);
        // We get each group from the matches (e.g., "Group A", "Group B" if that's how your DB stores it)
        const groups = new Set(matches.map((match) => match.group_id));
        // Get the division number for each group
        const divisionNumbers = await getDivisionNumbers(tournamentId);

        for (const group of groups) {
            try {
                // Determine the division number from your logic
                const division = divisionNumbers[group];
                // Get the existing channel for this division
                const channelId = divisionChannels[division];
                console.log(channelId);
                const channel = await client.channels.cache.get(channelId);
                if (!channel) {
                    console.warn(
                        `No channel provided for division ${division}. Skipping...`
                    );
                    continue;
                }

                // Sort group matches by suggested play order
                const groupMatches = matches
                    .filter((match) => match.group_id === group)
                    .sort(
                        (a, b) =>
                            b.suggested_play_order - a.suggested_play_order
                    );

                for (const match of groupMatches) {
                    await delay(2000);
                    const suggestedPlayOrder = match.suggested_play_order;
                    const player1Name = await getNameFromChallongeId(
                        match.player1_id
                    );
                    const player2Name = await getNameFromChallongeId(
                        match.player2_id
                    );
                    const player1DiscordId = await getUserIdFromChallongeId(
                        match.player1_id
                    );
                    const player2DiscordId = await getUserIdFromChallongeId(
                        match.player2_id
                    );

                    // Create thread in the division channel
                    const thread = await channel.threads.create({
                        name: `Round ${suggestedPlayOrder}: ${
                            Object.values(player1Name)[0]
                        } vs ${Object.values(player2Name)[0]} [ID:${
                            match.match_id
                        }]`,
                        autoArchiveDuration: ThreadAutoArchiveDuration.OneHour, // 1 day = 1440 mins (or 4320 for 3 days, etc.)
                        type: ChannelType.PublicThread,
                        reason: `Thread for match #${match.match_id}`,
                        message: {
                            content: `Thread for match between ${player1Name} and ${player2Name}. Organize your match here!`,
                        },
                    });

                    // Add both players to the thread (if you want private threads, adjust accordingly)
                    try {
                        //await thread.members.add(player1DiscordId);
                        //await thread.members.add(player2DiscordId);
                        // if (player1DiscordId == 414395899570290690) {
                        //     await thread.members.add(player1DiscordId);
                        // }
                        // if (player2DiscordId == 414395899570290690) {
                        //     await thread.members.add(player2DiscordId);
                        // }
                    } catch (addErr) {
                        console.error("Error adding user to thread: ", addErr);
                    }

                    console.log(
                        `Created thread: ${thread.name} in channel: ${channel.name}`
                    );
                    fixtureThreads.push(thread);
                }
            } catch (error) {
                console.error(
                    `Error creating threads for group ${group}:`,
                    error
                );
            }
        }
    } catch (error) {
        console.error("Error creating tournament threads:", error);
    }

    return fixtureThreads;
}
async function calculateStandings(
    tournamentId,
    mobileView = false,
    division = null,
    raw = false
) {
    // Initialize standings
    const standings = { tournamentId, groups: {} };

    // Fetch tournament data
    // const [matches, tournamentUrl] = await Promise.all([
    //     getAllMatchesFromTournamentId(tournamentId),
    //     getChallongeTournamentURL(tournamentId),
    // ]);
    //do the above without the url
    const matches = await getAllMatchesFromTournamentId(tournamentId);

    // Preload player names
    const playerIds = [
        ...new Set(
            matches.flatMap((match) => [match.player1_id, match.player2_id])
        ),
    ];
    const playerNames = await getNameFromChallongeId(playerIds);

    // Process matches by group
    const matchesByGroup = matches.reduce((acc, match) => {
        if (!match.group_id) return acc;
        acc[match.group_id] = acc[match.group_id] || [];
        acc[match.group_id].push(match);
        return acc;
    }, {});
    for (const [groupId, groupMatches] of Object.entries(matchesByGroup)) {
        standings.groups[groupId] = standings.groups[groupId] || {
            standings: {},
        };

        for (const match of groupMatches) {
            const {
                player1_id,
                player2_id,
                winner_id,
                player1_score,
                player2_score,
                state,
            } = match;
            const players = [player1_id, player2_id];

            players.forEach((playerId) => {
                if (!standings.groups[groupId].standings[playerId]) {
                    const playerName = playerNames[playerId];
                    standings.groups[groupId].standings[playerId] = {
                        rank: 0,
                        name: playerName.substring(0, 12).padEnd(12, " "),
                        wins: 0,
                        losses: 0,
                        draws: 0,
                        points: 0,
                        played: 0,
                    };
                }
            });

            // Update standings
            standings.groups[groupId].standings[player1_id].points +=
                player1_score;
            standings.groups[groupId].standings[player2_id].points +=
                player2_score;

            if (state === "complete" || state === "forfeited") {
                if (winner_id == null || winner_id == "tie") {
                    standings.groups[groupId].standings[player1_id].draws++;
                    standings.groups[groupId].standings[player2_id].draws++;
                    standings.groups[groupId].standings[player1_id].points++;
                    standings.groups[groupId].standings[player2_id].points++;
                } else {
                    const winner =
                        standings.groups[groupId].standings[winner_id];
                    const loser =
                        standings.groups[groupId].standings[
                            player1_id === winner_id ? player2_id : player1_id
                        ];
                    winner.wins++;
                    loser.losses++;
                    winner.points += 2;
                }
                standings.groups[groupId].standings[player1_id].played++;
                standings.groups[groupId].standings[player2_id].played++;
                if (player1_id == 32074493 || player2_id == 32074493) {
                    console.log(match);
                    console.log(standings.groups[groupId].standings[32074493]);
                }
            }
        }
    }
    if (raw) return standings;
    // Generate tables
    const tables = [];
    for (const groupId in standings.groups) {
        const group = standings.groups[groupId];
        const sortedStandings = Object.values(group.standings).sort(
            (a, b) => b.points - a.points
        );

        const tableData = [
            ["Pos", "Name", "Pld", "Pts"],
            ...sortedStandings.map((player, index) => [
                index + 1,
                player.name,
                player.played,
                player.points,
            ]),
        ];

        tables.push(`Group ${groupId}\n\`\`\`${table(tableData)}\`\`\``);
    }
    tournamentUrl = "You can also view on challonge";
    return { embedTitle: "Standings for Tournament", tables, tournamentUrl };
}
async function saveAdStats(match_id, tournament_id, stats) {
    //in ad_stats table. match_id and tournament_id are primary keys

    const query = `
        INSERT INTO ad_stats (
            match_id, tournament_id, stats_data )
        VALUES ($1, $2, $3)
        ON CONFLICT (match_id, tournament_id) DO UPDATE
        SET stats_data = EXCLUDED.stats_data
    `;
    const values = [match_id, tournament_id, stats];

    try {
        await pool.query(query, values);
    } catch (err) {
        console.error("Error saving stats:", err.message);
        throw new Error("Failed to save stats.");
    }
}

async function getAdStats(match_id, tournament_id) {
    const query = `SELECT stats_data FROM ad_stats WHERE match_id = $1 AND tournament_id = $2`;
    const values = [parseInt(match_id, 10), parseInt(tournament_id, 10)]; // Explicitly ensure integers

    try {
        const result = await pool.query(query, values);
        if (result.rows.length === 0) return null;
        return result.rows[0].stats_data;
    } catch (err) {
        console.error("Error fetching stats:", err.message);
        throw new Error("Failed to fetch stats.");
    }
}
async function getMatchFromMatchId(matchId) {
    const query = `SELECT * FROM Matches WHERE match_id = $1`;
    const values = [matchId];

    try {
        const result = await pool.query(query, values);
        if (result.rows.length === 0) return null;
        return result.rows[0];
    } catch (err) {
        console.error("Error fetching match:", err.message);
        throw new Error("Failed to fetch match.");
    }
}
async function createNewLiveMatch(
    match_id,
    tournament_id,
    player1_id,
    player2_id,
    autodarts_match_id,
    match_channel_interaction_id
) {
    const query = `
        INSERT INTO live_matches (match_id, tournament_id, player1_id, player2_id, autodarts_match_id, match_channel_interaction_id)
        VALUES ($1, $2, $3, $4, $5, $6)
    `;
    const values = [
        match_id,
        tournament_id,
        player1_id,
        player2_id,
        autodarts_match_id,
        match_channel_interaction_id,
    ];

    try {
        await pool.query(query, values);
    } catch (err) {
        console.error("Error creating live match:", err.message);
        throw new Error("Failed to create live match.");
    }
}
async function getLiveMatchDataFromAutodartsMatchId(autodartsMatchId) {
    const query = `SELECT * FROM live_matches WHERE autodarts_match_id = $1`;
    const values = [autodartsMatchId];
    //
    try {
        const result = await pool.query(query, values);
        if (result.rows.length === 0) return null;
        return result.rows[0];
    } catch (err) {
        console.error("Error fetching live match:", err.message);
        //throw new Error("Failed to fetch live match.");
    }
}
async function updateLiveMatchStatus(autodartsMatchId, status) {
    const query = `UPDATE live_matches SET status = $1 WHERE autodarts_match_id = $2`;
    const values = [status, autodartsMatchId];

    try {
        await pool.query(query, values);
    } catch (err) {
        console.error("Error updating live match status:", err.message);
    }
}
async function getLiveMatchStatus(autodartsMatchId) {
    const query = `SELECT status FROM live_matches WHERE autodarts_match_id = $1`;
    const values = [autodartsMatchId];

    try {
        const result = await pool.query(query, values);
        if (result.rows.length === 0) return null;
        return result.rows[0].status;
    } catch (err) {
        console.error("Error fetching live match status:", err.message);
        //throw new Error("Failed to fetch live match status.");
    }
}
async function updateLiveInteraction(autodartsMatchId, interactionId) {
    const query = `UPDATE live_matches SET live_status_interaction_id = $1 WHERE autodarts_match_id = $2`;
    const values = [interactionId, autodartsMatchId];

    try {
        await pool.query(query, values);
    } catch (err) {
        console.error("Error updating live interaction:", err.message);
        throw new Error("Failed to update live interaction.");
    }
}
async function getAllLiveMatches() {
    const query = `SELECT * FROM live_matches`;

    try {
        const result = await pool.query(query);
        return result.rows;
    } catch (err) {
        console.error("Error fetching live matches:", err.message);
        return []; // Return an empty array instead of throwing
    }
}
async function getLocalMatchFromMatchId(matchId) {
    const query = `SELECT * FROM Matches WHERE match_id = $1`;
    const values = [matchId];

    try {
        const result = await pool.query(query, values);
        if (result.rows.length === 0) return null;
        return result.rows[0];
    } catch (err) {
        console.error("Error fetching match:", err.message);
        throw new Error("Failed to fetch match.");
    }
}
async function deleteLiveMatch(autodartsMatchId) {
    const query = `DELETE FROM live_matches WHERE autodarts_match_id = $1`;
    const values = [autodartsMatchId];

    try {
        await pool.query(query, values);
    } catch (err) {
        console.error("Error deleting live match:", err.message);
    }
}
async function getParticipantDivisionNumber(participant_id) {
    const query = `SELECT p.participant_id,
       (grp.key)::int AS group_number
FROM participants p
JOIN tournaments t 
  ON p.tournament_id = t.tournament_id
CROSS JOIN LATERAL jsonb_each_text(t.groups) AS grp(key, val)
WHERE p.participant_id = $1
  AND (grp.val)::int = p.group_id;`;
    const values = [participant_id];
    try {
        const result = await pool.query(query, values);
        if (result.rows.length === 0) return null;
        return result.rows[0].group_number;
    } catch (err) {
        console.error("Error fetching division number:", err.message);
    }
}
async function getParticipantDivisionNumberFromUserId(user_id, tournament_id) {
    const query = `SELECT (grp.key)::int AS group_number
FROM participants p
JOIN tournaments t 
  ON p.tournament_id = t.tournament_id
CROSS JOIN LATERAL jsonb_each_text(t.groups) AS grp(key, val)
WHERE p.participant_id = (
    SELECT participant_id
    FROM participants
    WHERE user_id = $1 AND tournament_id = $2
)
  AND (grp.val)::int = p.group_id;

`;
    const values = [user_id, tournament_id];
    try {
        const result = await pool.query(query, values);
        if (result.rows.length === 0) return null;
        return result.rows[0].group_number;
    } catch (err) {
        console.error("Error fetching division number:", err.message);
    }
}
async function saveStandingsSnapshot(tournamentId, standings) {
    const query = `
        INSERT INTO standings_history (tournament_id, standings)
        VALUES ($1, $2)
    `;
    const values = [tournamentId, standings];

    try {
        await pool.query(query, values);
    } catch (err) {
        console.error("Error saving standings snapshot:", err.message);
        throw new Error("Failed to save standings snapshot.");
    }
}
async function forfeitAllGames(tournamentId, userId) {
    // Updated query to set winner, score, and state
    const query = `
        UPDATE Matches
        SET 
            winner_id = CASE
                WHEN player1_id = $2 THEN player2_id
                WHEN player2_id = $2 THEN player1_id
                ELSE winner_id
            END,
            player1_score = CASE
                WHEN player1_id = $2 THEN 0
                WHEN player2_id = $2 THEN 4
                ELSE player1_score
            END,
            player2_score = CASE
                WHEN player2_id = $2 THEN 0
                WHEN player1_id = $2 THEN 4
                ELSE player2_score
            END,
            state = 'forfeited'
        WHERE tournament_id = $1
        AND state = 'open'
        AND (player1_id = $2 OR player2_id = $2)
    `;

    const values = [tournamentId, userId]; // Only 2 parameters needed now

    try {
        const result = await pool.query(query, values);
        console.log(
            `Forfeited ${result.rowCount} games for user ${userId} in tournament ${tournamentId}.`
        );
    } catch (err) {
        console.error("Error forfeiting games:", err.message);
        throw new Error("Failed to forfeit games.");
    }
}

module.exports = {
    deleteLiveMatch,
    forfeitAllGames,
    saveStandingsSnapshot,
    getLocalMatchFromMatchId,
    getAllLiveMatches,
    updateLiveInteraction,
    getLiveMatchStatus,
    updateLiveMatchStatus,
    getParticipantDivisionNumber,
    getParticipantDivisionNumberFromUserId,
    getLiveMatchDataFromAutodartsMatchId,
    getAdStats,
    calculateStandings,
    saveAdStats,
    createTournamentChannels,
    getAverageFromChallongeId,
    getTournamentIdByName,
    getMatchFromAutodartsMatchId,
    getAllMatchesFromTournamentId,
    getTournamentIdFromAutodartsMatchId,
    getUserIdFromAutodartsId,
    getChallongeIdFromUserIdTournamentId,
    getLocalMatchFromPlayersChallongeIdTournamentId,
    updateLocalMatch,
    updateStats,
    insertNewTournament,
    confirmMatch,
    rejectMatch,
    getActiveTournamentId,
    getParticipantDataFromTournamentUserId,
    getAllMatchesForPlayer,
    getNameFromChallongeId,
    updateParticipantMatchPlayerIdsAndMatches,
    upsertUser,
    fetchTournamentsFromDatabase2,
    upsertParticipant,
    removeParticipantFromTournament,
    getSortedParticipants,
    getChallongeTournamentURL,
    updateTournamentStatus,
    getTournamentStatus,
    getDivisionNumbers,
    getAllParticipants,
    getTournamentStatusForUser,
    getTournamentNameById,
    getUserIdFromChallongeId,
    findThreadByMatchId,
    getMatchFromMatchId,
    createNewLiveMatch,
};
