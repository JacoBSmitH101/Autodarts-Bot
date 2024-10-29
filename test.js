const puppeteer = require("puppeteer");
const fs = require("fs");
const readline = require("readline");

async function loginAndSaveCookies(url, loginUrl, username, password) {
    const browser = await puppeteer.launch({ headless: false }); // Launch in non-headless mode for debugging
    const page = await browser.newPage();

    // Navigate to the login page
    await page.goto(loginUrl, { waitUntil: "networkidle2" });

    // Wait for the username field to be visible, then log in
    await page.waitForSelector("#username", { visible: true });
    await page.type("#username", username);
    await page.type("#password", password);
    await page.click("#kc-login");

    // Wait for navigation to complete after logging in
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

        // Get all rows within the table
        const rows = Array.from(table.querySelectorAll("tr"));

        // Extract text content from each cell in each row
        return rows.map((row) => {
            const cells = Array.from(row.querySelectorAll("td, th"));
            return cells.map((cell) => cell.innerText.trim());
        });
    });

    console.log("Table Data:", tableData); // Output the table data for inspection

    // Wait for user input to continue (pause)
    await waitForUserInput("Press Enter to close the browser...");

    await browser.close();
}

// Helper function to pause until the user presses Enter
function waitForUserInput(message) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise((resolve) =>
        rl.question(message, () => {
            rl.close();
            resolve();
        })
    );
}

// Replace these with actual values
const url =
    "https://play.autodarts.io/history/matches/d198f529-4f7b-49c6-ae96-257d8a33eeb8";
const loginUrl = "https://play.autodarts.io";
const username = "jacobsmith2005@hotmail.com";
const password = "JacoB101";

loginAndSaveCookies(url, loginUrl, username, password).catch((error) =>
    console.error("Error:", error)
);
