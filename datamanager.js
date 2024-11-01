const sqlite3 = require("sqlite3").verbose();

/**
 * Class representing data management operations. A
 */
class DataManagers {
    /**
     * Constructor to initialize the database connection.
     */
    constructor() {
        this.db = new sqlite3.Database("./data.db", (err) => {
            if (err) {
                console.error("Database connection error:", err.message);
                process.exit(1);
            }
        });
    }

    /**
     * Get tournament ID by name.
     * @param {string} tournamentName - The name of the tournament.
     * @returns {Promise<Object>} - A promise that resolves to the tournament ID.
     */
    async getTournamentIdByName(tournamentName) {
        return new Promise((resolve, reject) => {
            this.db.get(
                `SELECT tournament_id FROM Tournaments WHERE name = ?`,
                [tournamentName],
                (err, row) => {
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
     * Get all tournaments.
     * @returns {Promise<Array<Object>>} - A promise that resolves to an array of all tournaments.
     */

    async getAllTournaments() {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT * FROM Tournaments`,
                (err, rows) => {
                    if (err) {
                        console.error("Error querying database:", err.message);
                        reject(new Error("Failed to retrieve tournaments."));
                    } else {
                        resolve(rows);
                    }
                }
            );
        });
    }

    /**
     * Get all matches for a tournament.
     */

    async getMatchesByTournament(tournamentId) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT * FROM Matches WHERE tournament_id = ?`,
                [tournamentId],
                (err, rows) => {
                    if (err) {
                        console.error("Error querying database:", err.message);
                        reject(new Error("Failed to retrieve matches."));
                    } else {
                        resolve(rows);
                    }
                }
            );
        });
    }

    /**
     * Get all tournaments for a player.
     */

    async getTournamentsByPlayer(playerId) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT * FROM Tournaments WHERE player_id = ?`,
                [playerId],
                (err, rows) => {
                    if (err) {
                        console.error("Error querying database:", err.message);
                        reject(new Error("Failed to retrieve tournaments."));
                    } else {
                        resolve(rows);
                    }
                }
            );
        });
    }

    /**
     * Retrieve all matches between two players.
     */

    async getMatchesByPlayers(player1, player2) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT * FROM Matches WHERE player1_id = ? AND player2_id = ?`,
                [player1, player2],
                (err, rows) => {
                    if (err) {
                        console.error("Error querying database:", err.message);
                        reject(new Error("Failed to retrieve matches."));
                    } else {
                        resolve(rows);
                    }
                }
            );
        });
    }



    /**
     * Close the database connection.
     */
    close() {
        this.db.close((err) => {
            if (err) {
                console.error("Error closing the database:", err.message);
            }
        });
    }
}

const dataManagers = new DataManagers();

module.exports = DataManagers;
