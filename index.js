// fictional-stock-bot/index.js
require("dotenv").config();
const { Client, GatewayIntentBits, Partials } = require("discord.js");
const express = require("express");
const fs = require("fs");


const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel],
});

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

const stockHistory = Object.fromEntries(
  Object.entries(stocks).map(([k, v]) => [k, [v]])
);

function calculateTrend(symbol) {
  const history = stockHistory[symbol];
  if (!history || history.length < 2) return "➡️";
  const current = history.at(-1);
  const previous = history.at(-2);
  const diff = current - previous;
  const arrow = diff > 0 ? "📈" : diff < 0 ? "📉" : "➡️";
  return `${arrow} (${diff >= 0 ? "+" : ""}${diff.toFixed(2)})`;
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
      (
        tickers.reduce((sum, t) => sum + (stocks[t] || 0), 0) /
        tickers.length
      ).toFixed(2),
    ])
  );
}

const portfolioFile = "portfolios.json";
let portfolios = {};
if (fs.existsSync(portfolioFile)) {
  portfolios = JSON.parse(fs.readFileSync(portfolioFile, "utf8"));
}
function savePortfolios() {
  fs.writeFileSync(portfolioFile, JSON.stringify(portfolios, null, 2));
}

let customEvents = [];

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  const channel = await client.channels.fetch(channelID);

  setInterval(() => {
    updateStocks();
    savePortfolios();
  }, 20000);

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

      await channel.send(`📅 **Daily Market Report for ${day}**\n\
\`\`\`\n${report}\n\nIndexes:\n${indexReport}\n\`\`\``);
      await wait(minutes * 60 * 1000);
    }
  }

  dailyReportLoop();
});

client.on("messageCreate", async (msg) => {
  const [command, ...args] = msg.content.trim().split(/\s+/);

  if (command === "!stocks") {
    const lines = Object.entries(stocks).map(([s, p]) => `${s}: $${p.toFixed(2)} ${calculateTrend(s)}`);
    msg.channel.send("📈 **Current Stock Prices**:\n" + lines.join("\n"));

  } else if (command === "!index") {
    const values = calculateIndexes();
    const lines = Object.entries(values).map(([i, v]) => `${i}: ${v}`);
    msg.channel.send("📊 **Current Index Values**:\n" + lines.join("\n"));

  } else if (command === "!buy") {
    const symbol = args[0]?.toUpperCase();
    const input = args[1];
    if (!stocks[symbol]) return msg.reply(`❌ Stock symbol \`${symbol}\` not found.`);
    const price = stocks[symbol];
    const user = msg.author.id;
    if (!portfolios[user]) portfolios[user] = { cash: 10000, holdings: {} };

    let sharesToBuy;
    if (input.startsWith("$")) {
      const dollarAmount = parseFloat(input.slice(1));
      sharesToBuy = dollarAmount / price;
    } else {
      sharesToBuy = parseFloat(input);
    }

    if (isNaN(sharesToBuy) || sharesToBuy <= 0) return msg.reply("❌ Invalid amount.");
    const totalCost = sharesToBuy * price;
    if (portfolios[user].cash < totalCost) return msg.reply(`❌ You don't have enough money. Your balance is $${portfolios[user].cash.toFixed(2)}`);

    portfolios[user].cash -= totalCost;
    portfolios[user].holdings[symbol] = (portfolios[user].holdings[symbol] || 0) + sharesToBuy;
    savePortfolios();
    msg.reply(`✅ You bought ${sharesToBuy.toFixed(2)} shares of ${symbol} for $${totalCost.toFixed(2)}`);

  } else if (command === "!sell") {
    const symbol = args[0]?.toUpperCase();
    const input = args[1];
    if (!stocks[symbol]) return msg.reply(`❌ Stock symbol \`${symbol}\` not found.`);
    const price = stocks[symbol];
    const user = msg.author.id;
    if (!portfolios[user] || !portfolios[user].holdings[symbol]) return msg.reply(`❌ You don't own any ${symbol}`);

    let sharesToSell;
    if (input.startsWith("$")) {
      const dollarAmount = parseFloat(input.slice(1));
      sharesToSell = dollarAmount / price;
    } else {
      sharesToSell = parseFloat(input);
    }

    if (isNaN(sharesToSell) || sharesToSell <= 0) return msg.reply("❌ Invalid amount.");
    if (sharesToSell > portfolios[user].holdings[symbol]) return msg.reply(`❌ You only own ${portfolios[user].holdings[symbol].toFixed(2)} shares of ${symbol}`);

    const totalGain = sharesToSell * price;
    portfolios[user].cash += totalGain;
    portfolios[user].holdings[symbol] -= sharesToSell;
    if (portfolios[user].holdings[symbol] <= 0) delete portfolios[user].holdings[symbol];
    savePortfolios();
    msg.reply(`✅ You sold ${sharesToSell.toFixed(2)} shares of ${symbol} for $${totalGain.toFixed(2)}`);

  } else if (command === "!portfolio") {
    const user = msg.author.id;
    const data = portfolios[user];
    if (!data) return msg.reply("❌ You don't have a portfolio yet.");
    const lines = Object.entries(data.holdings).map(([s, q]) => `${s}: ${q.toFixed(2)} shares ($${(q * stocks[s]).toFixed(2)})`);
    msg.channel.send(`💼 **Portfolio for ${msg.author.username}**\n\`\`\`\nCash: $${data.cash.toFixed(2)}\n${lines.join("\n")}\n\`\`\``);

  } else if (command === "!reset" && msg.author.id === adminID) {
    portfolios = {};
    savePortfolios();
    msg.reply("🔄 All portfolios have been reset.");

  } else if (command === "!addcash" && msg.author.id === adminID) {
    const target = args[0]?.replace(/<@!?|>/g, "");
    const amount = parseFloat(args[1]);
    if (!target || isNaN(amount)) return msg.reply("❌ Usage: `!addcash @user 500`.");
    if (!portfolios[target]) portfolios[target] = { cash: 10000, holdings: {} };
    portfolios[target].cash += amount;
    savePortfolios();
    msg.reply(`💸 Added $${amount.toFixed(2)} to <@${target}>`);
  }
});

client.login(process.env.TOKEN);
