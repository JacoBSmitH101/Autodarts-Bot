const puppeteer = require("puppeteer");
const fs = require("fs");
const readline = require("readline");

async function loginAndCaptureAPI(url, loginUrl, username, password) {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    // Enable request interception to monitor network requests
    await page.setRequestInterception(true);

    // Set up listener to log and save outgoing requests
    page.on("request", (request) => {
        const reqUrl = request.url();
        const method = request.method();

        if (reqUrl.includes("api") || request.resourceType() === "xhr") {
            console.log(`[API Request] ${method} - ${reqUrl}`);
            console.log("Request Headers:", request.headers());
        }

        request.continue();
    });

    // Set up listener to log and save responses
    page.on("response", async (response) => {
        const resUrl = response.url();
        if (resUrl.includes("api")) {
            console.log(`[API Response] ${response.status()} - ${resUrl}`);
            try {
                const data = await response.json();

                // Create a unique filename for each response
                const filename = path.join(
                    __dirname,
                    "responses",
                    `${resUrl.split("/").pop() || "response"}.json`
                );

                // Ensure the responses directory exists
                fs.mkdirSync(path.join(__dirname, "responses"), {
                    recursive: true,
                });

                // Write JSON data to file
                fs.writeFileSync(filename, JSON.stringify(data, null, 2));
                console.log(`Response saved to ${filename}`);
            } catch (error) {
                console.log("Non-JSON response or error parsing JSON");
            }
        }
    });

    // Navigate to the login page and log in
    await page.goto(loginUrl, { waitUntil: "networkidle2" });
    await page.waitForSelector("#username", { visible: true });
    await page.type("#username", username);
    await page.type("#password", password);
    await page.click("#kc-login");
    await page.waitForNavigation({ waitUntil: "networkidle2" });

    // Save cookies after login
    const cookies = await page.cookies();
    fs.writeFileSync("cookies.json", JSON.stringify(cookies, null, 2));
    console.log("Cookies saved to 'cookies.json'");

    // Navigate to the match page
    await page.goto(url, { waitUntil: "networkidle2" });

    const tableData = await page.evaluate(() => {
        const table = document.querySelector(".css-5605sr");
        if (!table) return "Table not found";

        const rows = Array.from(table.querySelectorAll("tr"));
        return rows.map((row) => {
            const cells = Array.from(row.querySelectorAll("td, th"));
            return cells.map((cell) => cell.innerText.trim());
        });
    });

    console.log("Table Data:", tableData);

    await waitForUserInput("Press Enter to close the browser...");
    await browser.close();
}

// Helper function to wait for user input (pause)
function waitForUserInput(promptText) {
    return new Promise((resolve) => {
        process.stdout.write(promptText);
        process.stdin.once("data", () => resolve());
    });
}

// Replace these with actual values
const url =
    "https://play.autodarts.io/history/matches/d198f529-4f7b-49c6-ae96-257d8a33eeb8";
const loginUrl = "https://play.autodarts.io";
const username = "jacobsmith2005@hotmail.com";
const password = "JacoB101";

loginAndCaptureAPI(url, loginUrl, username, password).catch((error) =>
    console.error("Error:", error)
);
