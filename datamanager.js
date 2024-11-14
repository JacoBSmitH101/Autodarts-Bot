const sqlite3 = require("sqlite3").verbose();
dbFilePath = "./data.db";

/**
 * Retrieves the tournament ID by its name.
 *
 * @param {string} tournamentName - The name of the tournament.
 * @returns {Promise<Object>} A promise that resolves to the tournament ID.
 */
async function getTournamentIdByName(tournamentName) {
    const db = new sqlite3.Database(dbFilePath);
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT tournament_id FROM Tournaments WHERE name = ?`,
            [tournamentName],
            (err, row) => {
                db.close();
                if (err) {
                    console.error("Error querying database:", err.message);
                    reject(new Error("Failed to retrieve tournament ID."));
                } else if (!row) {
                    reject(new Error("Tournament not found."));
                } else {
                    resolve(row);
                }
            }
        );
    });
}

/**
 * Retrieves match details using the AutoDarts match ID.
 *
 * @param {number} autodartsMatchId - The AutoDarts match ID.
 * @returns {Promise<Object>} A promise that resolves to the match details.
 */
async function getMatchFromAutodartsMatchId(autodartsMatchId) {
    const db = new sqlite3.Database(dbFilePath);
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT * FROM Matches WHERE autodarts_match_id = ?`,
            [autodartsMatchId],
            (err, row) => {
                db.close();
                if (err) return reject("Failed to retrieve match details.");
                resolve(row);
            }
        );
    });
}

/**
 * Retrieves all matches for a given tournament ID.
 *
 * @param {number} tournamentId - The ID of the tournament.
 * @returns {Promise<Array>} A promise that resolves to an array of matches.
 */
async function getAllMatchesFromTournamentId(tournamentId) {
    const db = new sqlite3.Database(dbFilePath);
    return new Promise((resolve, reject) => {
        db.all(
            "SELECT * FROM matches WHERE tournament_id = ?",
            [tournamentId],
            (err, rows) => {
                db.close();
                if (err) return reject(err);
                resolve(rows);
            }
        );
    });
}

/**
 * Retrieves the tournament ID using the AutoDarts match ID.
 *
 * @param {number} autodartsMatchId - The AutoDarts match ID.
 * @returns {Promise<Object>} A promise that resolves to the tournament ID.
 */
async function getTournamentIdFromAutodartsMatchId(autodartsMatchId) {
    const db = new sqlite3.Database(dbFilePath);
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT tournament_id FROM Matches WHERE autodarts_match_id = ?`,
            [autodartsMatchId],
            (err, row) => {
                db.close();
                if (err) return reject("Failed to retrieve tournament ID.");
                resolve(row);
            }
        );
    });
}

/**
 * Retrieves the user ID using the AutoDarts ID.
 *
 * @param {number} autodartsId - The AutoDarts ID.
 * @returns {Promise<Object>} A promise that resolves to the user ID.
 */
async function getUserIdFromAutodartsId(autodartsId) {
    const db = new sqlite3.Database(dbFilePath);
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT user_id FROM Users WHERE autodarts_id = ?`,
            [autodartsId],
            (err, row) => {
                db.close();
                if (err) return reject("Failed to retrieve user ID.");
                resolve(row);
            }
        );
    });
}

/**
 * Retrieves the Challonge ID using the user ID and tournament ID.
 *
 * @param {number} userId - The user ID.
 * @param {number} tournamentId - The tournament ID.
 * @returns {Promise<Object>} A promise that resolves to the Challonge ID.
 */
async function getChallongeIdFromUserIdTournamentId(userId, tournamentId) {
    const db = new sqlite3.Database(dbFilePath);
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT challonge_id FROM Participants WHERE user_id = ? AND tournament_id = ?`,
            [userId, tournamentId],
            (err, row) => {
                db.close();
                if (err) return reject("Failed to retrieve user ID.");
                resolve(row);
            }
        );
    });
}

/**
 * Retrieves a local match using the players' Challonge IDs and tournament ID.
 *
 * @param {number} player1_challonge_id - The Challonge ID of player 1.
 * @param {number} player2_challonge_id - The Challonge ID of player 2.
 * @param {number} tournament_id - The ID of the tournament.
 * @returns {Promise<Object>} A promise that resolves to the match details.
 */
async function getLocalMatchFromPlayersChallongeIdTournamentId(
    player1_challonge_id,
    player2_challonge_id,
    tournament_id
) {
    const db = new sqlite3.Database(dbFilePath);
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT * FROM Matches
                WHERE tournament_id = ?
                AND ((player1_id = ? AND player2_id = ?)
                OR (player1_id = ? AND player2_id = ?))`,
            [
                tournamentId,
                player1_challonge_id,
                player2_challonge_id,
                player2_challonge_id,
                player1_challonge_id,
            ],
            (err, row) => {
                if (err) return reject("Failed to retrieve match details.");
                resolve(row);
            }
        );
    });
}

/**
 * Updates a local match with the provided match information.
 *
 * @param {Object} matchInfo - The match information.
 * @param {number} matchInfo.winnerChallongeId - The Challonge ID of the winner.
 * @param {string} matchInfo.state - The state of the match.
 * @param {Array<number>} matchInfo.scores_csv - The scores of the match.
 * @param {number} matchInfo.matchId - The ID of the match.
 * @param {Object} matchInfo.db_match - The database match object.
 * @returns {Promise<void>} A promise that resolves when the match is updated.
 */
async function updateLocalMatch(matchInfo) {
    const db = new sqlite3.Database(dbFilePath);
    return new Promise((resolve, reject) => {
        db.run(
            `UPDATE Matches 
            SET winner_id = ?, state = ?, player1_score = ?, player2_score = ?, autodarts_match_id = ?
            WHERE match_id = ?`,
            [
                matchInfo.winnerChallongeId,
                matchInfo.state,
                match.scores_csv[0],
                match.scores_csv[2],
                match.matchId,
                match.db_match.match_id,
            ],
            (err) => {
                if (err) {
                    console.error("Error updating match:", err);
                    return interaction.reply("Failed to update match.");
                }
            }
        );
    });
}

/**
 * Updates the statistics for a user in the database.
 *
 * @param {number} user_id - The ID of the user.
 * @param {number} match_id - The ID of the match.
 * @param {number} tournament_id - The ID of the tournament.
 * @param {Object} stats - The statistics to update.
 * @param {number} stats.average - The average score.
 * @param {number} stats.averageUntil170 - The average score until 170.
 * @param {number} stats.first9Average - The average score for the first 9 darts.
 * @param {number} stats.checkoutPercent - The checkout percentage.
 * @param {number} stats.dartsThrown - The number of darts thrown.
 * @param {number} stats.checkoutsHit - The number of checkouts hit.
 * @param {number} stats.plus60 - The number of scores 60+.
 * @param {number} stats.plus100 - The number of scores 100+.
 * @param {number} stats.plus140 - The number of scores 140+.
 * @param {number} stats.plus170 - The number of scores 170+.
 * @param {number} stats.total180 - The number of scores 180.
 * @returns {Promise<void>} A promise that resolves when the stats are updated.
 */
async function updateStats(user_id, match_id, tournament_id, stats) {
    const db = new sqlite3.Database(dbFilePath);
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT OR REPLACE INTO Stats (user_id, match_id, tournament_id, average, average_until_170, first_9_average, checkout_percent, darts_thrown, best_checkout, points_60_plus, points_100_plus, points_140_plus, points_170_plus, points_180)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                user_id,
                match_id,
                tournament_id,
                stats.average,
                stats.averageUntil170,
                stats.first9Average,
                stats.checkoutPercent,
                stats.dartsThrown,
                stats.checkoutsHit,
                stats.plus60,
                stats.plus100,
                stats.plus140,
                stats.plus170,
                stats.total180,
            ],
            (err) => {
                if (err) {
                    console.error("Error adding stats:", err);
                    return interaction.reply("Failed to add stats.");
                }
            }
        );
    });
}

/**
 * Inserts a new tournament into the database.
 *
 * @param {Object} tournament - The tournament details.
 * @param {number} tournament.id - The ID of the tournament.
 * @param {string} tournament.name - The name of the tournament.
 * @param {string} tournament.state - The state of the tournament.
 * @param {string} [tournament.start_at] - The start date of the tournament.
 * @param {string} [tournament.completed_at] - The end date of the tournament.
 * @returns {Promise<void>} A promise that resolves when the tournament is inserted.
 */
async function insertNewTournament(tournament) {
    const db = new sqlite3.Database(dbFilePath);
    const sql = `
                INSERT INTO Tournaments (tournament_id, challonge_id, name, status, start_date, end_date, created_at)
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `;

    const tournamentData = [
        tournament.id,
        tournament.id, // Challonge ID
        tournament.name,
        tournament.state,
        tournament.start_at ? tournament.start_at.split("T")[0] : null, // Only date portion
        tournament.completed_at ? tournament.completed_at.split("T")[0] : null, // Only date portion
    ];

    db.run(sql, tournamentData, function (err) {
        if (err) {
            console.error("Database insertion error:", err.message);
        }
        console.log(
            `Tournament ${tournament.name} added with ID ${tournament.id}`
        );
    });
}
async function confirmMatch(autodartsMatchId, playerIndex) {
    const db = new sqlite3.Database(dbFilePath);
    return new Promise((resolve, reject) => {
        db.run(
            `UPDATE Matches SET player${
                playerIndex + 1
            }_confirmed = 1 WHERE autodarts_match_id = ?`,
            [autodartsMatchId],
            (err) => {
                db.close();
                if (err) return reject("Failed to confirm match.");
                resolve();
            }
        );
    });
}

async function rejectMatch(autodartsMatchId, playerIndex) {
    const db = new sqlite3.Database(dbFilePath);
    return new Promise((resolve, reject) => {
        db.run(
            `UPDATE Matches SET player${
                playerIndex + 1
            }_confirmed = -1 WHERE autodarts_match_id = ?`,
            [autodartsMatchId],
            (err) => {
                db.close();
                if (err) return reject("Failed to reject match.");
                resolve();
            }
        );
    });
}
async function getActiveTournamentId() {
    const db = new sqlite3.Database(dbFilePath);
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT tournament_id FROM Tournaments WHERE active = 1`,
            (err, row) => {
                db.close();
                if (err) return reject("Failed to retrieve active tournament.");
                resolve(row);
            }
        );
    });
}
module.exports = {
    getTournamentIdByName,
    getAllMatchesFromTournamentId,
    getTournamentIdFromAutodartsMatchId,
    getUserIdFromAutodartsId,
    getChallongeIdFromUserIdTournamentId,
    getLocalMatchFromPlayersChallongeIdTournamentId,
    updateLocalMatch,
    updateStats,
    insertNewTournament,
    getMatchFromAutodartsMatchId,
    confirmMatch,
    rejectMatch,
    getActiveTournamentId,
};
