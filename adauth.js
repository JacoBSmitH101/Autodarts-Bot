const axios = require("axios");
const WebSocket = require("ws");
const https = require("https");

class AutodartsAuthClient {
    constructor({
        username,
        password,
        clientId,
        clientSecret = null,
        debug = false,
    }) {
        this.serverUrl = "https://login.autodarts.io";
        this.realmName = "autodarts";
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.username = username;
        this.password = password;
        this.debug = debug;

        this.tokenLifetimeFraction = 0.9;
        this.tick = 3000;
        this.run = true;

        this.accessToken = null;
        this.refreshtoken = null;
        this.expiresAt = null;
        this.refreshExpiresAt = null;
        this.ws = null;

        // Start token refresh on initialization
        this.startTokenManagement();
    }

    async getToken() {
        try {
            const response = await axios.post(
                `${this.serverUrl}/realms/${this.realmName}/protocol/openid-connect/token`,
                new URLSearchParams({
                    grant_type: "password",
                    client_id: this.clientId,
                    client_secret: this.clientSecret,
                    username: this.username,
                    password: this.password,
                })
            );
            this.setToken(response.data);
            if (this.debug)
                console.log("New token acquired:", this.accessToken);
        } catch (error) {
            console.error("Error getting token:", error.message);
        }
    }

    setToken(token) {
        this.accessToken = token.access_token;
        this.refreshtoken = token.refresh_token;
        const now = Date.now();
        this.expiresAt = new Date(
            now + this.tokenLifetimeFraction * token.expires_in * 1000
        );
        this.refreshExpiresAt = new Date(
            now + this.tokenLifetimeFraction * token.refresh_expires_in * 1000
        );
    }

    async refreshToken() {
        try {
            const response = await axios.post(
                `${this.serverUrl}/realms/${this.realmName}/protocol/openid-connect/token`,
                new URLSearchParams({
                    grant_type: "refresh_token",
                    client_id: this.clientId,
                    client_secret: this.clientSecret,
                    refresh_token: this.refreshtoken,
                })
            );
            this.setToken(response.data);
            if (this.debug) console.log("Token refreshed:", this.accessToken);
        } catch (error) {
            this.accessToken = null;
            console.error("Token refresh failed:", error.message);
        }
    }

    async startTokenManagement() {
        while (this.run) {
            try {
                const now = new Date();
                if (!this.accessToken || this.expiresAt < now) {
                    if (this.refreshExpiresAt > now) {
                        await this.refreshToken();
                    } else {
                        await this.getToken();
                    }
                }
            } catch (error) {
                this.accessToken = null;
                console.error("Token management error:", error.message);
            }
            await new Promise((resolve) => setTimeout(resolve, this.tick));
        }
    }

    async subscribe(callback, sendCallback) {
        try {
            while (!this.accessToken)
                await new Promise((resolve) => setTimeout(resolve, 100)); // Wait for token
            const headers = { Authorization: `Bearer ${this.accessToken}` };

            this.ws = new WebSocket("wss://api.autodarts.io/ms/v0/subscribe", {
                headers,
                agent: new https.Agent({ rejectUnauthorized: false }),
            });

            this.ws.on("open", () => {
                console.log("WebSocket connection opened.");
                if (sendCallback) {
                    sendCallback(this.ws);
                }
            });

            this.ws.on("message", (message) =>
                callback(JSON.parse(message.toString()))
            );
            this.ws.on("error", (error) =>
                console.error("WebSocket error:", error)
            );
            this.ws.on("close", () =>
                console.log("WebSocket connection closed.")
            );
        } catch (error) {
            console.error("Subscription failed:", error);
        }
    }
    async createLobby(lobbyData) {
        try {
            while (!this.accessToken)
                await new Promise((resolve) => setTimeout(resolve, 100)); // Wait for token

            // Create the lobby
            const response = await axios.post(
                "https://api.autodarts.io/gs/v0/lobbies",
                lobbyData,
                {
                    headers: {
                        Authorization: `Bearer ${this.accessToken}`,
                        "Content-Type": "application/json",
                    },
                }
            );

            const lobbyId = response.data.id; // Get the lobby ID
            if (this.debug) console.log("Lobby created:", response.data);

            // Immediately send DELETE request
            const deleteUrl = `https://api.autodarts.io/gs/v0/lobbies/${lobbyId}/players/by-index/0`;
            const deleteResponse = await axios.delete(deleteUrl, {
                headers: {
                    Authorization: `Bearer ${this.accessToken}`,
                    "Content-Type": "application/json",
                },
            });

            //if (this.debug) console.log("Player deleted:", deleteResponse.data);

            return response.data; // Return the original lobby creation response
        } catch (error) {
            console.error("Error in createLobby:", error.message);
            throw new Error("Failed to create lobby or delete player.");
        }
    }

    stop() {
        this.run = false;
        if (this.ws) this.ws.close();
        console.log("Autodarts client stopped.");
    }
}

module.exports = AutodartsAuthClient;
