const { Client, GatewayIntentBits, Partials } = require("discord.js");
const express = require("express");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

const app = express();
const PORT = 8080; // hardcoded for Azure compatibility
const TOKEN = "MTM2MDc1NjY5OTk3NTM4NTE5OA.Gp7Y86.2P0l6YL4QBhlMaFqOEzhe5PCZtSODijxn25SY8"; // <-- Replace this with your actual token
const CHANNEL_ID = "1219680183985115136";
const ADMIN_ID = "907341400830537838";

app.get("/", (_, res) => res.send("✅ Bot is running!"));
app.listen(PORT, () => console.log(`🌐 Server running on port ${PORT}`));

// --- STOCK SETUP ---
let stocks = {
  MICX: 268.45,
  APPL: 191.20,
  APP: 87.64,
  SNRG: 42.30,
  CITI: 54.10,
  MGMT: 149.00,
  AUTX: 66.25,
  MDXX: 136.75,
};

const stockHistory = Object.fromEntries(
  Object.entries(stocks).map(([k, v]) => [k, [v]])
);

const indexes = {
  CQA: ["MICX", "APPL", "APP", "SNRG", "CITI", "MGMT", "AUTX", "MDXX"],
  TechPower: ["MICX", "APPL"],
  CoalCore: ["APP", "SNRG"],
  MainStreet: ["CITI", "MGMT", "AUTX"],
  BioFuture: ["MDXX"],
};

const schedule = [
  { days: ["Friday"], duration: 71 },
  { days: ["Monday"], duration: 25 },
  { days: ["Tuesday"], duration: 23 },
  { days: ["Wednesday"], duration: 25 },
  { days: ["Thursday"], duration: 25 },
];

function wait(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

function updateStocks() {
  for (let stock in stocks) {
    let change = (Math.random() - 0.5) * 10;
    stocks[stock] = Math.max(1, stocks[stock] + change);
    stockHistory[stock].push(stocks[stock]);
    if (stockHistory[stock].length > 100) stockHistory[stock].shift();
  }
}

function calculateTrend(symbol) {
  const h = stockHistory[symbol];
  if (!h || h.length < 2) return "➡️";
  const diff = h[h.length - 1] - h[h.length - 2];
  return diff > 0 ? "📈" : diff < 0 ? "📉" : "➡️";
}

function calculateIndexes() {
  return Object.fromEntries(
    Object.entries(indexes).map(([i, tickers]) => [
      i,
      (tickers.reduce((s, t) => s + (stocks[t] || 0), 0) / tickers.length).toFixed(2),
    ])
  );
}

let customEvents = [];

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  const channel = await client.channels.fetch(CHANNEL_ID);

  setInterval(updateStocks, 20000);

  async function dailyReportLoop() {
    while (true) {
      const now = new Date();
      const day = now.toLocaleString("en-US", { weekday: "long", timeZone: "UTC" });
      const entry = schedule.find((s) => s.days.includes(day));
      const minutes = entry ? entry.duration : 25;

      const stockReport = Object.entries(stocks)
        .map(([s, p]) => `${s}: $${p.toFixed(2)} ${calculateTrend(s)}`)
        .join("\n");

      const indexReport = Object.entries(calculateIndexes())
        .map(([i, v]) => `${i}: ${v}`)
        .join("\n");

      await channel.send(
        `📅 **Daily Market Report for ${day}**\n\`\`\`\n${stockReport}\n\nIndexes:\n${indexReport}\n\`\`\``
      );

      await wait(minutes * 60 * 1000);
    }
  }

  dailyReportLoop();
});

client.on("messageCreate", async (msg) => {
  const { content, author } = msg;
  if (content === "!stocks") {
    const response = Object.entries(stocks)
      .map(([s, p]) => `${s}: $${p.toFixed(2)} ${calculateTrend(s)}`)
      .join("\n");
    return msg.channel.send("📈 **Current Stock Prices**:\n" + response);
  }

  if (content === "!index") {
    const response = Object.entries(calculateIndexes())
      .map(([i, v]) => `${i}: ${v}`)
      .join("\n");
    return msg.channel.send("📊 **Current Index Values**:\n" + response);
  }

  if (content.startsWith("!price ")) {
    const symbol = content.split(" ")[1]?.toUpperCase();
    if (stocks[symbol]) {
      return msg.channel.send(`${symbol} is currently at $${stocks[symbol].toFixed(2)} ${calculateTrend(symbol)}`);
    }
    return msg.channel.send(`Stock symbol \`${symbol}\` not found.`);
  }

  if (content.startsWith("!addevent ") && author.id === ADMIN_ID) {
    const args = content.split(" ");
    const symbol = args[1]?.toUpperCase();
    const change = parseFloat(args[2]);
    const match = content.match(/"([^"]+)"/);
    const eventMsg = match?.[1];

    if (!stocks[symbol]) return msg.reply(`Stock symbol \`${symbol}\` not found.`);
    if (isNaN(change) || !eventMsg) return msg.reply("Invalid format. Usage: `!addevent SYMBOL +/-0.10 \"Event message\"`");

    customEvents.push({ symbol, change, message: eventMsg });
    return msg.reply(`✅ Event added! (${customEvents.length} total)`);
  }

  if (content === "!clearevents" && author.id === ADMIN_ID) {
    customEvents = [];
    return msg.channel.send("🗑️ All custom events have been cleared.");
  }

  if (content.startsWith("!doevent ") && author.id === ADMIN_ID) {
    const index = parseInt(content.split(" ")[1]);
    const event = customEvents[index];
    if (!event) return msg.reply(`⚠️ No event found at index ${index}`);

    stocks[event.symbol] = Math.max(1, stocks[event.symbol] * (1 + event.change));
    stockHistory[event.symbol].push(stocks[event.symbol]);
    if (stockHistory[event.symbol].length > 100) stockHistory[event.symbol].shift();

    const report = Object.entries(stocks)
      .map(([s, p]) => `${s}: $${p.toFixed(2)} ${calculateTrend(s)}`)
      .join("\n");

    return msg.channel.send(`🧨 **Manual Event Triggered**: ${event.message}\n\`\`\`\n${report}\n\`\`\``);
  }
});

client.login(TOKEN);
