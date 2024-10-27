const sqlite3 = require("sqlite3").verbose();
require("dotenv").config();

// Function to retrieve tournament ID by name
const getTournamentIdByName = async (tournamentName) => {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database("./data.db");
    db.get(
      `SELECT tournament_id FROM Tournaments WHERE name = ?`,
      [tournamentName],
      (err, row) => {
        db.close();
        if (err || !row) {
          reject("Tournament not found.");
        } else {
          resolve(row.tournament_id);
        }
      }
    );
  });
};

// Function to retrieve and sort participants by average score in descending order
const getSortedParticipants = async (tournamentId) => {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database("./data.db");
    db.all(
      `
      SELECT Participants.challonge_id, Users.autodarts_name, Users.avg 
      FROM Participants 
      JOIN Users ON Participants.user_id = Users.user_id 
      WHERE Participants.tournament_id = ? 
      ORDER BY avg DESC
    `,
      [tournamentId],
      (err, rows) => {
        db.close();
        if (err) {
          reject("Failed to retrieve participants.");
        } else {
          resolve(rows);
        }
      }
    );
  });
};

// Empty function for your custom seeding logic
const customSeedingLogic = (players) => {
  // `players` is an array of objects, each containing:
  // - challonge_id
  // - autodarts_name
  // - avg
  console.log("Implement your custom seeding logic here.");
  console.log(players);
  let sorted = [];

  let groups = 0;
  const maxGroupSize = 10;
  const totalPlayers = players.length;
  if (totalPlayers <= maxGroupSize) {
    groups = 2;
  } else {
    groups = Math.ceil(totalPlayers / maxGroupSize);
  }
  const groupSize = Math.ceil(totalPlayers / groups);

  for (let i = 0; i < totalPlayers; i++) {}
};

// Main function to start the process
const startSeedingProcess = async (tournamentName) => {
  try {
    const tournamentId = await getTournamentIdByName(tournamentName);
    const participants = await getSortedParticipants(tournamentId);

    if (participants.length === 0) {
      console.log("No participants found for this tournament.");
      return;
    }

    console.log("Participants before seeding:");
    participants.forEach((p, index) =>
      console.log(`Rank ${index + 1}: ${p.autodarts_name} (avg: ${p.avg})`)
    );

    // Pass the participants to the custom seeding logic function
    customSeedingLogic(participants);
  } catch (error) {
    console.error("Error in seeding process:", error);
  }
};

// Run the function with a test tournament name
startSeedingProcess("AUTODARTS TEST");
