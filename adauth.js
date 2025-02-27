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
        this.activeSubscriptions = new Set();

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

    async ensureWebSocketOpen() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return new Promise((resolve, reject) => {
                const headers = { Authorization: `Bearer ${this.accessToken}` };

                this.ws = new WebSocket(
                    "wss://api.autodarts.io/ms/v0/subscribe",
                    {
                        headers,
                        agent: new https.Agent({ rejectUnauthorized: false }),
                    }
                );

                this.ws.on("open", () => {
                    console.log("WebSocket connection opened.");
                    // Resubscribe to all active subscriptions
                    for (const subscription of this.activeSubscriptions) {
                        const [channel, topic] = subscription.split(":");
                        this.ws.send(
                            JSON.stringify({
                                channel,
                                type: "subscribe",
                                topic,
                            })
                        );
                    }
                    resolve();
                });

                this.ws.on("error", (error) => {
                    console.error("WebSocket error:", error);
                    reject(error);
                });

                this.ws.on("close", () => {
                    console.log("WebSocket connection closed.");
                    this.ws = null;
                    // Optionally implement reconnection logic here
                });
            });
        }
    }
    //test
    async subscribe(channel, topic, callback) {
        try {
            await this.ensureWebSocketOpen();

            const subscriptionKey = `${channel}:${topic}`;
            if (!this.activeSubscriptions.has(subscriptionKey)) {
                this.activeSubscriptions.add(subscriptionKey);
                const params = { channel, type: "subscribe", topic };
                console.log("Subscribing to:", params);
                this.ws.send(JSON.stringify(params));
                console.log(`Subscribed to ${channel}:${topic}`);
            }

            this.ws.on("message", (message) => {
                callback(JSON.parse(message.toString()));
            });
        } catch (error) {
            console.error("Subscription failed:", error);
        }
    }

    async unsubscribe(channel, topic) {
        try {
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                console.log("No active WebSocket connection to unsubscribe.");
                return;
            }

            const subscriptionKey = `${channel}:${topic}`;
            if (this.activeSubscriptions.has(subscriptionKey)) {
                const params = { channel, type: "unsubscribe", topic };
                this.ws.send(JSON.stringify(params));
                this.activeSubscriptions.delete(subscriptionKey);
                console.log(`Unsubscribed from ${channel}:${topic}`);
            }
        } catch (error) {
            console.error("Unsubscription failed:", error);
        }
    }
    async removePlayerFromLobby(lobbyId, playerIndex) {
        try {
            while (!this.accessToken)
                await new Promise((resolve) => setTimeout(resolve, 100));

            const response = await axios.delete(
                `https://api.autodarts.io/gs/v0/lobbies/${lobbyId}/players/by-index/${playerIndex}`,
                {
                    headers: {
                        Authorization: `Bearer ${this.accessToken}`,
                        "Content-Type": "application/json",
                    },
                }
            );

            if (this.debug) console.log("Player removed:", response.data);
            return response.data;
        } catch (error) {
            console.error("Error in removePlayerFromLobby:", error.message);
        }
    }

    async createLobby(lobbyData) {
        try {
            while (!this.accessToken)
                await new Promise((resolve) => setTimeout(resolve, 100));

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

            if (this.debug) console.log("Lobby created:", response.data);
            return response.data;
        } catch (error) {
            console.error("Error in createLobby:", error.message);
            throw new Error("Failed to create lobby.");
        }
    }

    async deleteLobby(lobbyId) {
        try {
            while (!this.accessToken)
                await new Promise((resolve) => setTimeout(resolve, 100));
            const response = await axios.delete(
                `https://api.autodarts.io/gs/v0/lobbies/${lobbyId}`,
                {
                    headers: {
                        Authorization: `Bearer ${this.accessToken}`,
                        "Content-Type": "application/json",
                    },
                }
            );
        } catch (error) {
            console.error("Error in deleteLobby:", error.message);
            throw new Error("Failed to delete lobby.");
        }
    }

    async startLobby(lobbyId) {
        try {
            while (!this.accessToken)
                await new Promise((resolve) => setTimeout(resolve, 100));

            const response = await axios.post(
                `https://api.autodarts.io/gs/v0/lobbies/${lobbyId}/start`,
                {},
                {
                    headers: {
                        Authorization: `Bearer ${this.accessToken}`,
                        "Content-Type": "application/json",
                    },
                }
            );

            if (this.debug) console.log("Lobby started:", response.data);
            return response.data;
        } catch (error) {
            console.error("Error in startLobby:", error.message);
            throw new Error("Failed to start lobby.");
        }
    }

    stop() {
        this.run = false;
        if (this.ws) this.ws.close();
        console.log("Autodarts client stopped.");
    }
}

module.exports = AutodartsAuthClient;
