const sqlite3 = require("sqlite3").verbose();

/**
 * Class representing data management operations.
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
