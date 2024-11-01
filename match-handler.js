class MatchHandler {
    constructor(client) {
        this.ongoing_matches = [];
        this.client = client;
    }

    async match_update(message) {
        console.log(message.data.players)
    }
}

module.exports = MatchHandler;