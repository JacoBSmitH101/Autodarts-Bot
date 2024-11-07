const sqlite3 = require("sqlite3").verbose();
dbFilePath = "./data.db";

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

module.exports = {
    getTournamentIdByName,
    getMatchFromAutodartsMatchId,
    getAllMatchesFromTournamentId,
    getTournamentIdFromAutodartsMatchId,
    getUserIdFromAutodartsId,
    getChallongeIdFromUserIdTournamentId,
    getLocalMatchFromPlayersChallongeIdTournamentId,
};
