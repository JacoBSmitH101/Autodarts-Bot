const axios = require("axios");
const WebSocket = require("ws");
const https = require("https");
class AutodartsKeycloakClient {
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
        this.tick = 3000; // 3 seconds in milliseconds
        this.run = true;

        this.accessToken = null;
        this.refreshtoken = null;
        this.userId = null;
        this.expiresAt = null;
        this.refreshExpiresAt = null;
        this.thread = null;
    }

    async getToken() {
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
        if (this.debug) {
            console.log("Getting token", this.expiresAt, this.refreshExpiresAt);
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
            if (this.debug) {
                console.log(
                    "Refreshing token",
                    this.expiresAt,
                    this.refreshExpiresAt
                );
            }
        } catch (error) {
            this.accessToken = null;
            console.error("Receive Token failed", error);
        }
    }

    async getUserInfo() {
        const response = await axios.get(
            `${this.serverUrl}/realms/${this.realmName}/protocol/openid-connect/userinfo`,
            {
                headers: { Authorization: `Bearer ${this.accessToken}` },
            }
        );
        return response.data;
    }

    async getOrRefresh() {
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
                console.error("Receive Token failed", error);
            }
            await new Promise((resolve) => setTimeout(resolve, this.tick));
        }
    }

    start() {
        this.thread = this.getOrRefresh();
        return this.thread;
    }

    stop() {
        this.run = false;
        console.log("autodarts-tokenizer EXIT");
    }
}

module.exports = AutodartsKeycloakClient;

const clientId = "wusaaa-caller-for-autodarts";
const clientSecret = "4hg5d4fddW7rqgoY8gZ42aMpi2vjLkzf"; // Optional, if needed
const debug = true; // Enable debug mode to see logs

// Initialize the Keycloak client

// Example of using access token in a request
async function makeAuthenticatedRequest() {
    try {
        // Ensure token is ready
        await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait for token to be retrieved

        console.log("Access Token:", keycloakClient.accessToken);
        // Use `keycloakClient.accessToken` to make authorized requests, e.g.,
        const response = await axios.get(
            "https://api.autodarts.io/as/v0/users/bb229295-742d-429f-bbbf-fe4a179ef537/stats/x01?limit=10",
            {
                headers: {
                    Authorization: `Bearer ${keycloakClient.accessToken}`,
                },
            }
        );
        console.log("Authenticated response:", response.data);
    } catch (error) {
        console.error("Failed to make authenticated request:", error);
    }
}

const AUTODARTS_WEBSOCKET_URL = "wss://api.autodarts.io/ms/v0/subscribe"; // Replace with actual WebSocket URL
const CERT_CHECK = false; // Set to true if you want to enable certificate checking
const keycloakClient = new AutodartsKeycloakClient({
    username,
    password,
    clientId,
    clientSecret,
    debug,
});
keycloakClient.start();

async function connectAutodarts() {
    // Start the token refresh thread

    try {
        // Fetch the access token (assuming `kc` is an instance of your Keycloak client with a valid token)
        let accessToken = keycloakClient.accessToken;
        while (!accessToken) {
            await new Promise((resolve) => setTimeout(resolve, 100)); // Check every 100ms
            accessToken = keycloakClient.accessToken;
        }
        const headers = {
            Authorization: `Bearer ${accessToken}`,
        };

        const sslOptions = CERT_CHECK
            ? undefined
            : {
                  rejectUnauthorized: false, // Disables certificate validation
              };

        const ws = new WebSocket(AUTODARTS_WEBSOCKET_URL, {
            headers,
            agent: sslOptions ? new https.Agent(sslOptions) : undefined,
        });

        ws.on("open", () => {
            console.log("WebSocket connection opened.");

            const paramsSubscribeMatchesEvents = {
                channel: "autodarts.matchmaking",
                type: "subscribe",
                topic: ``,
            };

            ws.send(JSON.stringify(paramsSubscribeMatchesEvents));
            console.log(
                "Receiving live information for board-id:",
                "22c910e2-0f19-4c65-9098-40edd2befaa0"
            );

            onOpenAutodarts(ws); // Your custom open handler
        });
        //80196271-3ce8-43f6-82d1-8724f98e47b4
        ws.on("message", (message) => {
            onMessageAutodarts(message); // Your custom message handler
        });

        ws.on("error", (error) => {
            console.error("WebSocket error:", error);
            onErrorAutodarts(error); // Your custom error handler
        });

        ws.on("close", () => {
            console.log("WebSocket connection closed.");
            onCloseAutodarts(); // Your custom close handler
        });
    } catch (error) {
        console.error("Failed to connect:", error);
    }
}

// Replace these with your actual handler functions
function onOpenAutodarts(ws) {
    console.log("Connected to AutoDarts WebSocket.");
    // Add any on-open actions here
}

function onMessageAutodarts(message) {
    // Process received messages here
    try {
        // Convert the buffer to a string and parse it as JSON
        const parsedMessage = JSON.parse(message.toString());

        console.log("Parsed Message Received:", parsedMessage);

        // Pass the parsed message to your custom handler
    } catch (error) {
        console.error("Failed to parse message:", error);
    }
}

function onErrorAutodarts(error) {
    console.error("WebSocket encountered an error:", error);
}

function onCloseAutodarts() {
    console.log("WebSocket connection closed.");
}

// Call the function to initiate the connection
setTimeout(connectAutodarts, 500);

// Stop the token refresh thread when done
process.on("SIGINT", () => {
    keycloakClient.stop();
    process.exit();
});
