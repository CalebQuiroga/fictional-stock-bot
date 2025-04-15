const { Client, GatewayIntentBits, Partials } = require("discord.js");
const express = require("express");
require("dotenv").config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel],
});

// Express server to keep bot alive
const app = express();
const PORT = process.env.PORT || 8080;

app.get("/", (_, res) => res.send("Bot is running."));
app.listen(PORT, () => console.log(`🌐 Express active on port ${PORT}`));

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

const stockHistory = Object.fromEntries(Object.entries(stocks).map(([k, v]) => [k, [v]]));

function calculateTrend(symbol) {
  const history = stockHistory[symbol];
  if (!history || history.length < 2) return "➡️";
  const diff = history.at(-1) - history.at(-2);
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
  { days: ["Monday", "Tuesday", "Wednesday", "Thursday"], duration: 25 },
];

function wait(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

function updateStocks() {
  for (let s in stocks) {
    let change = (Math.random() - 0.5) * 10;
    stocks[s] = Math.max(1, stocks[s] + change);
    stockHistory[s].push(stocks[s]);
    if (stockHistory[s].length > 100) stockHistory[s].shift();
  }
}

function calculateIndexes() {
  return Object.fromEntries(
    Object.entries(indexes).map(([i, tickers]) => [
      i,
      (tickers.reduce((sum, t) => sum + (stocks[t] || 0), 0) / tickers.length).toFixed(2),
    ])
  );
}

let customEvents = [];

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  const channel = await client.channels.fetch(channelID);

  setInterval(updateStocks, 20000);

  async function dailyReportLoop() {
    while (true) {
      const day = new Date().toLocaleString("en-US", { weekday: "long", timeZone: "UTC" });
      const entry = schedule.find((s) => s.days.includes(day)) || { duration: 25 };
      const minutes = entry.duration;

      const report = Object.entries(stocks)
        .map(([s, p]) => `${s}: $${p.toFixed(2)} ${calculateTrend(s)}`)
        .join("\n");

      const indexReport = Object.entries(calculateIndexes())
        .map(([i, v]) => `${i}: ${v}`)
        .join("\n");

      await channel.send(`📅 **Daily Market Report for ${day}**\n\`\`\`\n${report}\n\nIndexes:\n${indexReport}\n\`\`\``);
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
    const symbol = msg.content.split(" ")[1]?.toUpperCase();
    if (stocks[symbol]) {
      msg.channel.send(`${symbol} is currently at $${stocks[symbol].toFixed(2)} ${calculateTrend(symbol)}`);
    } else {
      msg.channel.send(`Stock symbol \`${symbol}\` not found.`);
    }
  } else if (msg.content.startsWith("!addevent ")) {
    if (msg.author.id !== adminID) return;
    const args = msg.content.split(" ");
    const match = msg.content.match(/"([^"]+)"/);
    const symbol = args[1]?.toUpperCase();
    const change = parseFloat(args[2]);
    const message = match?.[1];

    if (!symbol || !stocks[symbol] || isNaN(change) || !message) {
      return msg.reply("Usage: `!addevent SYMBOL +/-0.10 \"Event message here\"`");
    }

    customEvents.push({ symbol, change, message });
    msg.reply(`✅ Event added! (${customEvents.length} total)`);
  } else if (msg.content === "!clearevents" && msg.author.id === adminID) {
    customEvents = [];
    msg.channel.send("🗑️ All custom events cleared.");
  } else if (msg.content.startsWith("!doevent ")) {
    if (msg.author.id !== adminID) return;
    const index = parseInt(msg.content.split(" ")[1]);
    const event = customEvents[index];

    if (!event) return msg.reply(`⚠️ No event at index ${index}`);

    stocks[event.symbol] = Math.max(1, stocks[event.symbol] + stocks[event.symbol] * event.change);
    stockHistory[event.symbol].push(stocks[event.symbol]);
    if (stockHistory[event.symbol].length > 100) stockHistory[event.symbol].shift();

    const report = Object.entries(stocks)
      .map(([s, p]) => `${s}: $${p.toFixed(2)} ${calculateTrend(s)}`)
      .join("\n");

    msg.channel.send(`🧨 **Manual Event Triggered**: ${event.message}\n\`\`\`\n${report}\n\`\`\``);
  }
});

client.login(process.env.TOKEN);
