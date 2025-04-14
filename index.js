// Required modules
const { Client, GatewayIntentBits, Partials } = require("discord.js");
const express = require("express");
require("dotenv").config();

const PORT = process.env.PORT || 8080;

// Discord client setup
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel],
});

// Express server for Azure ping
const app = express();
const PORT = process.env.PORT;
app.get("/", (_, res) => res.send("Bot is running."));
app.listen(PORT, () => console.log(`🌐 Web server active on port ${PORT}`));

// Constants and configuration
const adminID = "907341400830537838";
const channelID = "1219680183985115136";

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

const stockHistory = {};
for (const key in stocks) {
  stockHistory[key] = [stocks[key]];
}

function calculateTrend(symbol) {
  const history = stockHistory[symbol];
  if (!history || history.length < 2) return "➡️";
  const diff = history[history.length - 1] - history[history.length - 2];
  return diff > 0 ? "📈" : diff < 0 ? "📉" : "➡️";
}

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

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function updateStocks() {
  for (let stock in stocks) {
    let change = (Math.random() - 0.5) * 10;
    stocks[stock] = Math.max(1, stocks[stock] + change);
    stockHistory[stock].push(stocks[stock]);
    if (stockHistory[stock].length > 100) {
      stockHistory[stock].shift();
    }
  }
}

function calculateIndexes() {
  const results = {};
  for (const [indexName, tickers] of Object.entries(indexes)) {
    const total = tickers.reduce((sum, t) => sum + (stocks[t] || 0), 0);
    results[indexName] = (total / tickers.length).toFixed(2);
  }
  return results;
}

client.on("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  const channel = await client.channels.fetch(channelID);

  setInterval(updateStocks, 20000);

  async function dailyReportLoop() {
    while (true) {
      const now = new Date();
      const day = now.toLocaleString("en-US", { weekday: "long", timeZone: "UTC" });
      const entry = schedule.find((s) => s.days.includes(day));
      const minutes = entry ? entry.duration : 25;

      const report = Object.entries(stocks)
        .map(([s, p]) => `${s}: $${p.toFixed(2)} ${calculateTrend(s)}`)
        .join("\n");

      const indexValues = calculateIndexes();
      const indexReport = Object.entries(indexValues)
        .map(([i, v]) => `${i}: ${v}`)
        .join("\n");

      await channel.send(`📅 **Daily Market Report for ${day}**\n\
\\`\\`\\`\n${report}\n\nIndexes:\n${indexReport}\n\\`\\`\\``);
      await wait(minutes * 60 * 1000);
    }
  }

  dailyReportLoop();
});

client.on("messageCreate", async (msg) => {
  if (msg.content === "!stocks") {
    const lines = Object.entries(stocks).map(([s, p]) => `${s}: $${p.toFixed(2)} ${calculateTrend(s)}`);
    msg.channel.send("📈 **Current Stock Prices**:\n" + lines.join("\n"));
  } else if (msg.content === "!index") {
    const values = calculateIndexes();
    const lines = Object.entries(values).map(([i, v]) => `${i}: ${v}`);
    msg.channel.send("📊 **Current Index Values**:\n" + lines.join("\n"));
  } else if (msg.content.startsWith("!price ")) {
    const symbol = msg.content.split(" ")[1].toUpperCase();
    if (stocks[symbol]) {
      msg.channel.send(`${symbol} is currently at $${stocks[symbol].toFixed(2)} ${calculateTrend(symbol)}`);
    } else {
      msg.channel.send(`Stock symbol \`${symbol}\` not found.`);
    }
  } else if (msg.content.startsWith("!addevent ")) {
    if (msg.author.id !== adminID) return;
    const args = msg.content.split(" ");
    if (args.length < 4) return msg.reply("Usage: `!addevent SYMBOL +/-0.10 \"Event message here\"`");

    const symbol = args[1].toUpperCase();
    const change = parseFloat(args[2]);
    const match = msg.content.match(/"([^"]+)"/);
    const eventMsg = match ? match[1] : null;

    if (!stocks[symbol]) return msg.reply(`Stock symbol \`${symbol}\` not found.`);
    if (isNaN(change) || !eventMsg) return msg.reply("Invalid format. Wrap the event message in quotes.");

    customEvents.push({ symbol, change, message: eventMsg });
    msg.reply(`✅ Event added! (${customEvents.length} total)`);
  } else if (msg.content === "!clearevents") {
    if (msg.author.id !== adminID) return;
    customEvents = [];
    msg.channel.send("🗑️ All custom events have been cleared.");
  } else if (msg.content.startsWith("!doevent ")) {
    if (msg.author.id !== adminID) return;
    const index = parseInt(msg.content.split(" ")[1]);
    const event = customEvents[index];
    if (!event) return msg.reply(`⚠️ No event found at index ${index}`);

    const symbol = event.symbol;
    const change = event.change;
    const msgText = event.message;
    stocks[symbol] = Math.max(1, stocks[symbol] + stocks[symbol] * change);
    stockHistory[symbol].push(stocks[symbol]);
    if (stockHistory[symbol].length > 100) {
      stockHistory[symbol].shift();
    }

    const report = Object.entries(stocks)
      .map(([s, p]) => `${s}: $${p.toFixed(2)} ${calculateTrend(s)}`)
      .join("\n");

    msg.channel.send(`🧨 **Manual Event Triggered**: ${msgText}\n\
\\`\\`\\`\n${report}\n\\`\\`\\``);
  }
});

client.login(process.env.TOKEN);
