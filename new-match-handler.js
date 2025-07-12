const { match } = require("assert");
const axios = require("axios");
const { stat } = require("fs");

const { getActiveTournamentId } = require("./datamanager");
const { Pool } = require("pg");

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

const getMatchIdFromDiscordIds = async (
    player1_discordId,
    player2_discordId,
    tounament_id
) => {
    //query DB participants table for user_id = player1_discordId and tournament_id = tounament_id
    const query = `SELECT challonge_id FROM participants WHERE user_id = $1 AND tournament_id = $2`;
    let match_id = null;

    try {
        //2 querues for each player participant_id
        const player1_result = await pool.query(query, [
            player1_discordId,
            tounament_id,
        ]);
        const player2_result = await pool.query(query, [
            player2_discordId,
            tounament_id,
        ]);

        if (player1_result.rows.length > 0 && player2_result.rows.length > 0) {
            //get match_id from matches table where each player id is playerX_id and can be either way around
            const player1_participant_id = player1_result.rows[0].challonge_id;
            const player2_participant_id = player2_result.rows[0].challonge_id;
            const matchQuery = `SELECT match_id, tournament_id FROM matches WHERE (player1_id = $1 AND player2_id = $2) OR (player1_id = $2 AND player2_id = $1)`;
            const matchResult = await pool.query(matchQuery, [
                player1_participant_id,
                player2_participant_id,
            ]);
            if (matchResult.rows.length > 0) {
                match_id = matchResult.rows[0].match_id;
                console.log("Match ID found:", match_id);
                return {
                    match_id: match_id,
                    tournament_id: matchResult.rows[0].tournament_id,
                    player1_participant_id: player1_participant_id,
                    player2_participant_id: player2_participant_id,
                };
            } else {
                console.log("No match found for the given participants.");
                return null;
            }
        } else {
            console.log("No participants found for the given Discord IDs.");
            return null;
        }
    } catch (error) {
        console.log("Error querying database:", error);
        return null;
    }
};
const getMatchIdFromADNames = async (
    player1_AD_name,
    player2_AD_name,
    tournament_id
) => {
    //need to get challonge_id from participants table for each player
    //in the users table there is autodarts_name and a key in each table is user_id so joining is easy
    //const query = `SELECT challonge_id FROM participants WHERE user_id IN (SELECT user_id FROM users WHERE autodarts_name IN ($1, $2)) AND tournament_id = $3`;
    //search in lowercase with no spaces to ensure we match the names correctly
    const query = `SELECT challonge_id FROM participants WHERE user_id IN (SELECT user_id FROM users WHERE LOWER(REPLACE(autodarts_name, ' ', '')) IN ($1, $2)) AND tournament_id = $3`;
    let match_id = null;
    console.log(
        `Searching for participants with names: ${player1_AD_name} and ${player2_AD_name}`
    );
    try {
        const player_results = await pool.query(query, [
            player1_AD_name.toLowerCase().replace(/\s/g, ""),
            player2_AD_name.toLowerCase().replace(/\s/g, ""),
            tournament_id,
        ]);

        //if there are 2 participants, we can find the match
        if (player_results.rows.length === 2) {
            const player1_participant_id = player_results.rows[0].challonge_id;
            const player2_participant_id = player_results.rows[1].challonge_id;

            const matchQuery = `SELECT match_id, tournament_id FROM matches WHERE (player1_id = $1 AND player2_id = $2) OR (player1_id = $2 AND player2_id = $1)`;
            const matchResult = await pool.query(matchQuery, [
                player1_participant_id,
                player2_participant_id,
            ]);
            if (matchResult.rows.length > 0) {
                match_id = matchResult.rows[0].match_id;
                console.log("Match ID found:", match_id);
                return {
                    match_id: match_id,
                    tournament_id: matchResult.rows[0].tournament_id,
                    player1_participant_id: player1_participant_id,
                    player2_participant_id: player2_participant_id,
                };
            } else {
                console.log("No match found for the given participants.");
                return null;
            }
        } else {
            console.log(
                "Participants not found or more than two participants found."
            );
            return null;
        }
    } catch (error) {
        console.log("Error querying database:", error);
        return null;
    }
};
const link_posted = async (ad_matchId, keycloak, client) => {
    console.log("New match link posted:", ad_matchId);

    const statsResponse = await axios.get(
        `https://api.autodarts.io/as/v0/matches/${ad_matchId}/stats`,
        {
            headers: {
                Authorization: `Bearer ${keycloak.accessToken}`,
            },
        }
    );

    // const test = await axios.get(
    //     "https://api.autodarts.io/us/v0/users/536c065e-1b43-4666-a825-0652ae29f292/",
    //     {
    //         headers: {
    //             Authorization: `Bearer ${keycloak.accessToken}`,
    //         },
    //     }
    // );

    ///console.log(statsResponse.data.players[0].name);

    //do the above commeneted code to get potential discord ids, AD player ids are .players[X].id

    const player1_AD_id = statsResponse.data.players[0].hostId;
    const player2_AD_id = statsResponse.data.players[1].hostId;

    console.log(`https://api.autodarts.io/us/v0/users/${player1_AD_id}/`);
    const player1_AD_response = await axios.get(
        `https://api.autodarts.io/us/v0/users/${player1_AD_id}/`,
        {
            headers: {
                Authorization: `Bearer ${keycloak.accessToken}`,
            },
        }
    );
    const player2_AD_response = await axios.get(
        `https://api.autodarts.io/us/v0/users/${player2_AD_id}/`,
        {
            headers: {
                Authorization: `Bearer ${keycloak.accessToken}`,
            },
        }
    );
    const player1_AD_discordId = player1_AD_response.data.discordId;
    const player2_AD_discordId = player2_AD_response.data.discordId;
    const player1_AD_name = player1_AD_response.data.name;
    const player2_AD_name = player2_AD_response.data.name;

    const tournamentId = await getActiveTournamentId();

    const data =
        player1_AD_discordId && player2_AD_discordId
            ? await getMatchIdFromDiscordIds(
                  player1_AD_discordId,
                  player2_AD_discordId,
                  tournamentId
              )
            : await getMatchIdFromADNames(
                  player1_AD_name,
                  player2_AD_name,
                  tournamentId
              );

    //now if data.match_id is not null, update the matches table with state = complete player1_score and player2_score depending which was round player1_id and player2_id are and winner_id is the player who won
    if (!data || !data.match_id) {
        console.log("No match found for the given Discord IDs or AD names.");
        return null;
    }

    //console.log(data);
    const matchId = data.match_id;
    const player1_participant_id = data.player1_participant_id;
    const player2_participant_id = data.player2_participant_id;
    const player1_score = statsResponse.data.scores[0].legs;
    const player2_score = statsResponse.data.scores[1].legs;
    const winner_id =
        player1_score > player2_score
            ? player1_participant_id
            : player2_participant_id;

    //first check if player1 in the autodarts stats is player1 in the match, otherwise scores will be inputed wrong
    let query = `SELECT player1_id FROM matches WHERE match_id = $1`;
    let isCorrectOrder = false;
    try {
        const result = await pool.query(query, [matchId]);
        if (result.rows.length > 0) {
            isCorrectOrder =
                result.rows[0].player1_id === player1_participant_id;
        }
    } catch (error) {
        console.log("Error querying database:", error);
        return null;
    }
    //we need to only run this if we 100% have all the data we need

    let scores_csv = isCorrectOrder
        ? `${player1_score}-${player2_score}`
        : `${player2_score}-${player1_score}`;

    const api_url = `https://api.challonge.com/v1/tournaments/${data.tournament_id}/matches/${data.match_id}.json`;
    const params = {
        api_key: process.env.API_KEY,
    };
    const data2 = {
        match: {
            scores_csv: scores_csv,
            winner_id: winner_id,
        },
    };

    // First update Challonge
    try {
        const response = await axios.put(api_url, data2, { params });
        if (response.status === 200) {
            console.log("Challonge match updated");
        }
    } catch (error) {
        console.error("Error updating Challonge match:", error);
    }

    query = `UPDATE matches SET state = 'complete', player1_score = $1, player2_score = $2, winner_id = $3 WHERE match_id = $4`;
    try {
        await pool.query(query, [
            isCorrectOrder ? player1_score : player2_score,
            isCorrectOrder ? player2_score : player1_score,
            winner_id,
            matchId,
        ]);
        console.log("Match updated successfully.");
    } catch (error) {
        console.log("Error updating match:", error);
        return null;
    }

    //update the matches table with the match_id, state = complete, player1_score, player2_score and winner_id

    //if we have both discord ids, finding the match is easier

    //console.log(player1_name);
    // console.log(player1_AD_discordId);
    // console.log(player2_AD_discordId);
    return {
        player1_name: statsResponse.data.players[0].name,
        player2_name: statsResponse.data.players[1].name,
        player1_score: statsResponse.data.scores[0].legs,
        player2_score: statsResponse.data.scores[1].legs,
        player1_avg:
            Math.round(statsResponse.data.matchStats[0].average * 100) / 100,
        player2_avg:
            Math.round(statsResponse.data.matchStats[1].average * 100) / 100,
        //checkout percent, comes as decimal so multiply by 100 and do rounding
        player1_checkout:
            Math.round(
                statsResponse.data.matchStats[0].checkoutPercent * 10000
            ) / 100,
        player2_checkout:
            Math.round(
                statsResponse.data.matchStats[1].checkoutPercent * 10000
            ) / 100,
        matchId: data.match_id,
    };
};

module.exports = {
    link_posted,
};
