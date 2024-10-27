
const axios = require('axios');


async function add_tournament(serverId, tournamentId)  {
    const sqlite3 = require('sqlite3').verbose();
    const db = new sqlite3.Database('./data.db');

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
    let name = '';
    let state = '';
    try {
        // Define the API URL and parameters
        const apiUrl = `https://api.challonge.com/v1/tournaments/${tournamentId}.json`;
        const params = {
            api_key: process.env.API_KEY,  // Replace with your actual API key
            state: 'in_progress',          // Retrieve in-progress tournaments
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
                console.log(`Tournament ${tournamentId} assigned to server ${serverId}`);
            }
        }
    );

    db.close();
    return true;
}
const sqlite3 = require('sqlite3').verbose();

function fetchTournamentsFromDatabase() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database('./data.db', (err) => {
            if (err) {
                console.error('Failed to connect to the database:', err.message);
                reject(err);
            }
        });

        // Query to fetch all tournaments with status "open"
        const query = `SELECT name FROM Tournaments WHERE status = 'pending'`;
        db.all(query, [], (err, rows) => {
            db.close();
            if (err) {
                console.error('Database query error:', err.message);
                reject(err);
            } else {
                resolve(rows.map(row => ({ name: row.name })));
            }
        });
    });
}

async function handleCancelRemove(interaction) {
    await interaction.update({
        content: 'Tournament removal canceled.',
        components: []
    });
}
async function handleConfirmRemove(interaction, challongeId) {
    const db = new sqlite3.Database('./data.db', (err) => {
        if (err) {
            console.error('Database connection error:', err.message);
            return interaction.update({ content: 'Failed to connect to the database.', components: [] });
        }
    });

    // Delete the tournament from the database
    const deleteSql = `DELETE FROM Tournaments WHERE challonge_id = ?`;
    db.run(deleteSql, [challongeId], function(err) {
        if (err) {
            console.error('Database deletion error:', err.message);
            return interaction.update({ content: 'Failed to remove the tournament from the database.', components: [] });
        }
        console.log(`Tournament with Challonge ID ${challongeId} removed`);
        interaction.update({ content: `Tournament with Challonge ID ${challongeId} has been removed from the database.`, components: [] });
    });

    db.close((err) => {
        if (err) console.error('Error closing the database:', err.message);
    });
}


module.exports = {
    add_tournament,
    fetchTournamentsFromDatabase,
    handleCancelRemove,
    handleConfirmRemove
};