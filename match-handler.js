const { EmbedBuilder, hyperlink, hideLinkEmbed } = require("discord.js")


class MatchHandler {
    constructor(client) {
        //will store objects with:
        // {
        //     matchId: "xxx",
        //     live_discord_interaction: null,
        //     challonge_match_id: "xxx",
        // }
        this.ongoing_matches = [];
        this.client = client;
    }

    async match_update(message) {
        //example message:
        // {
        //     channel: 'autodarts.matches',
        //     topic: 'e1fe54a4-a490-4a00-b044-6db05461ae72.state',
        //     data: {
        //       chalkboards: [ [Object] ],
        //       createdAt: '2024-11-01T17:38:03.017763769Z',
        //       finished: false,
        //       gameFinished: false,
        //       gameScores: [ 481 ],
        //       gameWinner: -1,
        //       host: {
        //         avatarUrl: 'https://gravatar.com/avatar/4d1948cf7119b42303e2db099be1efcd',
        //         average: 32.85029069767442,
        //         country: 'gb',
        //         id: 'bb229295-742d-429f-bbbf-fe4a179ef537',
        //         name: 'yakoob19',
        //         userSettings: [Object]
        //       },
        //       id: 'e1fe54a4-a490-4a00-b044-6db05461ae72',
        //       leg: 1,
        //       player: 0,
        //       players: [ [Object] ],
        //       round: 1,
        //       scores: [ [Object] ],
        //       set: 1,
        //       settings: {
        //         baseScore: 501,
        //         bullMode: '25/50',
        //         gameId: '00000000-0000-0000-0000-000000000000',
        //         inMode: 'Straight',
        //         maxRounds: 80,
        //         outMode: 'Double'
        //       },
        //       state: { checkoutGuide: null },
        //       stats: [ [Object] ],
        //       turnBusted: false,
        //       turnScore: 20,
        //       turns: [ [Object] ],
        //       type: 'Local',
        //       variant: 'X01',
        //       winner: -1
        //     }
        //   }
        console.log(message)
        const matchId = message.data.id;
        //associate this match with a match in the database via player ids
        const players = message.data.players;
        //first check if the match is already being tracked
        const match = this.ongoing_matches.find(match => match.matchId === matchId);
        if (match) {
            //update the match
            //TODO
            this.updateMatch(matchId, message);
        } else {
            //add the match
            console.log(message.data.scores)
            this.addMatch(matchId, message);
        }
        //TODO in actual implementation, will ensure that both players in game have a match against eachother, for testing just check if it is me
    }
    async updateMatch(matchId, message) {
        //basically just edit the interaction message with the new scores
        const match = this.ongoing_matches.find(match => match.matchId === matchId);
        const player1_score = message.data.gameScores[0];
        const player2_score = message.data.gameScores[1];
        const player1_legs = message.data.scores[0].legs
        const player2_legs = message.data.scores[1].legs
        const player1_name = message.data.players[0].name;
        const player2_name = message.data.players[1].name;
        const matchUrl = `https://play.autodarts.io/matches/${matchId}`;
        
        const interaction = match.live_discord_interaction;

        if (interaction) {
            const embed = new EmbedBuilder()
            .setTitle("🎯 League Match In Progress")
            .setDescription(`Follow the live score and progress!`)
            .setColor(0x00ff00) // Green color for active match
            .setTimestamp()
            .addFields(
                // Player names and match status
                { name: `${player1_name}`, value: `${player1_score}`, inline: true },
                { name: "VS", value: `${player1_legs} - ${player2_legs}`, inline: true },
                { name: `${player2_name}`, value: `${player2_score}`, inline: true }, 
                { name: "Follow along!", value: `[Watch match on Autodarts](${matchUrl})`, inline: false }
            )

            // Update message
            interaction.edit({ embeds: [embed] });
        } else {
            console.log("Interaction not found");
        }
        
    }
    async addMatch(matchId, message) {
        const players = message.data.players;
        //TODO associate with challonge match id
        this.ongoing_matches.push({
            matchId: matchId,
            players: players,
            live_discord_interaction: null,
        });

        //get player names
        const player1_name = players[0].name;
        const player2_name = players[1].name;

        //get player scores
        const player1_score = message.data.gameScores[0];
        const player2_score = message.data.gameScores[1];

        const player1_legs = message.data.scores[0].legs
        const player2_legs = message.data.scores[1].legs

        //get match state
        let matchState = "In Progress";
        let matchDate = new Date().toLocaleDateString();
        
        const matchUrl = `https://play.autodarts.io/matches/${matchId}`;
        const link = hyperlink("Goto match", matchUrl);
        //create interaction and store it in live_discord_interaction
        const channel = this.client.channels.cache.get("1295486855378108515");
        if (channel) {
            const embed = new EmbedBuilder()
            .setTitle("🎯 League Match In Progress")
            .setDescription(`Follow the live score and progress!`)
            .setColor(0x00ff00) // Green color for active match
            .setTimestamp()
            .addFields(
                // Player names and match status
                { name: `${player1_name}`, value: `${player1_score}`, inline: true },
                { name: "VS", value: `${player1_legs} - ${player2_legs}`, inline: true },
                { name: `${player2_name}`, value: `${player2_score}`, inline: true }, 
                { name: "Follow along!", value: `[Watch match on Autodarts](${matchUrl})`, inline: false }
            )
        
            // Send message and update ongoing match with Discord message object
            const message = await channel.send({ embeds: [embed] });
            this.ongoing_matches.find(match => match.matchId === matchId).live_discord_interaction = message;
        } else {
            console.log("Channel not found");
        }
        
    }
}

module.exports = MatchHandler;