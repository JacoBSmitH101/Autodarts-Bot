const sqlite3 = require('sqlite3').verbose();

// Connect to SQLite database (or create it if it doesn't exist)
const db = new sqlite3.Database('./data.db', (err) => {
    if (err) {
        return console.error(err.message);
    }
    console.log('Connected to the SQLite database.');
});

// SQL commands to create the tables
const createUsersTable = `
    CREATE TABLE IF NOT EXISTS Users (
        user_id INTEGER PRIMARY KEY,
        discord_tag TEXT,
        autodarts_name TEXT,
        challonge_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
`;

const createTournamentsTable = `
    CREATE TABLE IF NOT EXISTS Tournaments (
        tournament_id INTEGER PRIMARY KEY,
        challonge_id INTEGER,
        name TEXT,
        status TEXT,
        start_date DATE,
        end_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
`;

const createParticipantsTable = `
    CREATE TABLE IF NOT EXISTS Participants (
        participant_id INTEGER PRIMARY KEY,
        user_id INTEGER,
        tournament_id INTEGER,
        challonge_id INTEGER,
        status TEXT,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES Users(user_id),
        FOREIGN KEY (tournament_id) REFERENCES Tournaments(tournament_id)
    );
`;

const createMatchesTable = `
    CREATE TABLE IF NOT EXISTS Matches (
        match_id INTEGER PRIMARY KEY,
        tournament_id INTEGER,
        player1_id INTEGER,
        player2_id INTEGER,
        winner_id INTEGER,
        challonge_match_id INTEGER,
        state TEXT,
        player1_score INTEGER,
        player2_score INTEGER,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tournament_id) REFERENCES Tournaments(tournament_id),
        FOREIGN KEY (player1_id) REFERENCES Users(user_id),
        FOREIGN KEY (player2_id) REFERENCES Users(user_id),
        FOREIGN KEY (winner_id) REFERENCES Users(user_id)
    );
`;

// Execute the SQL commands
db.serialize(() => {
    db.run(createUsersTable);
    db.run(createTournamentsTable);
    db.run(createParticipantsTable);
    db.run(createMatchesTable, (err) => {
        if (err) {
            return console.error(err.message);
        }
        console.log('Tables created successfully.');
    });
});

// Close the database connection
db.close((err) => {
    if (err) {
        return console.error(err.message);
    }
    console.log('Closed the database connection.');
});
