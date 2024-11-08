const { Pool } = require("pg");

// PostgreSQL configuration
const pool = new Pool({
    user: "bot",
    host: "192.168.1.105",
    database: "adbot_database",
    password: "bot", // Replace with your actual password
    port: 5432,
});

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

/**
 * Retrieves the tournament ID using the AutoDarts match ID.
 */
async function getTournamentIdFromAutodartsMatchId(autodartsMatchId) {
    const query = `SELECT tournament_id FROM Matches WHERE autodarts_match_id = $1`;
    const values = [autodartsMatchId];

    try {
        const result = await pool.query(query, values);
        if (result.rows.length === 0) throw new Error("Tournament not found.");
        return result.rows[0];
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
        return result.rows[0];
    } catch (err) {
        console.error("Failed to retrieve user ID:", err.message);
        throw new Error("Failed to retrieve user ID.");
    }
}

/**
 * Retrieves the Challonge ID using the user ID and tournament ID.
 */
async function getChallongeIdFromUserIdTournamentId(userId, tournamentId) {
    const query = `SELECT challonge_id FROM Participants WHERE user_id = $1 AND tournament_id = $2`;
    const values = [userId, tournamentId];

    try {
        const result = await pool.query(query, values);
        if (result.rows.length === 0)
            throw new Error("Challonge ID not found.");
        return result.rows[0];
    } catch (err) {
        console.error("Failed to retrieve Challonge ID:", err.message);
        throw new Error("Failed to retrieve Challonge ID.");
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
        throw new Error("Failed to retrieve match details.");
    }
}

/**
 * Updates a local match with the provided match information.
 */
async function updateLocalMatch(matchInfo) {
    const query = `
        UPDATE Matches 
        SET winner_id = $1, state = $2, player1_score = $3, player2_score = $4, autodarts_match_id = $5
        WHERE match_id = $6
    `;
    const values = [
        matchInfo.winnerChallongeId,
        matchInfo.state,
        matchInfo.scores_csv[0],
        matchInfo.scores_csv[1],
        matchInfo.autodarts_match_id,
        matchInfo.matchId,
    ];

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
        return result.rows[0];
    } catch (err) {
        console.error("Failed to retrieve active tournament:", err.message);
        throw new Error("Failed to retrieve active tournament.");
    }
}

async function getParticipantDataFromTournamentUserId(tournamentId, userId) {
    const query = `
        SELECT *
        FROM Participants P
        WHERE P.tournament_id = $1 AND P.user_id = $2
    `;
    const values = [tournamentId, userId];

    try {
        const result = await pool.query(query, values);
        if (result.rows.length === 0) throw new Error("Participant not found.");
        return result.rows[0];
    } catch (err) {
        console.error("Failed to retrieve participant data:", err.message);
        throw new Error("Failed to retrieve participant data.");
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

async function getNameFromChallongeId(challongeId) {
    //user_id is the name
    const query = `SELECT user_id FROM Participants WHERE challonge_id = $1`;
    const values = [challongeId];

    try {
        const result = await pool.query(query, values);
        if (result.rows.length === 0) throw new Error("User not found.");
        return result.rows[0];
    } catch (err) {
        console.error("Failed to retrieve user name:", err.message);
        throw new Error("Failed to retrieve user name.");
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

        for (const participant of participants.rows) {
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
                const matchExists = await client.query(
                    `SELECT 1 FROM Matches WHERE challonge_match_id = $1 AND tournament_id = $2`,
                    [challongeMatchId, tournamentId]
                );

                if (matchExists.rowCount === 0) {
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
    } finally {
        await pool.end();
    }
}

const upsertUser = async (
    discordId,
    userTag,
    autodartUsername,
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
                 VALUES ($1, $2, $3, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $4, $5)`,
                [
                    discordId,
                    userTag,
                    autodartUsername,
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
    console.log("Upserting participant:", userId, tournamentId, challongeId);
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

const fetchTournamentsFromDatabase2 = async () => {
    try {
        const client = await pool.connect();
        const result = await client.query(`SELECT name FROM Tournaments`);
        client.release();
        return result.rows;
    } catch (error) {
        console.error("Error fetching tournaments:", error);
        throw new Error("Failed to fetch tournaments.");
    }
};

module.exports = {
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
};
