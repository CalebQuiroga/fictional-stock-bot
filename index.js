const { Client, GatewayIntentBits, Partials } = require("discord.js");
const express = require("express");
require("dotenv").config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

// Dummy express web server for Azure
const app = express();
app.get("/", (_, res) => res.send("Bot is running."));
app.listen(process.env.PORT || 8080, () => {
  console.log("🌐 Express server is running to keep Azure alive.");
});

const adminID = "907341400830537838";
let customEvents = [];
let stocks = {
  APP: 100.0,
  COAL: 50.0,
  AMZOON: 200.0,
  TAYLR: 130.0
};

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

const schedule = [
  { days: ['Friday'], duration: 71 },
  { days: ['Monday'], duration: 25 },
  { days: ['Tuesday'], duration: 23 },
  { days: ['Wednesday'], duration: 25 },
  { days: ['Thursday'], duration: 25 },
];

function updateStocks() {
  for (let stock in stocks) {
    let change = (Math.random() - 0.5) * 10;
    stocks[stock] = Math.max(1, stocks[stock] + change);
  }
}

async function startMarketLoop() {
  while (true) {
    const now = new Date();
    const day = now.toLocaleString('en-US', { weekday: 'long', timeZone: 'UTC' });
    const entry = schedule.find(s => s.days.includes(day));
    const minutes = entry ? entry.duration : 25;

    updateStocks();

    const report = Object.entries(stocks)
      .map(([symbol, price]) => `${symbol}: $${price.toFixed(2)}`)
      .join('\n');

    const channel = client.channels.cache.get('1219680183985115136');
    if (channel) {
      await channel.send(`📅 **Market Update for ${day}**\n\`\`\`${report}\`\`\``);
    } else {
      console.log("⚠️ Could not find channel. Check the channel ID.");
    }

    await wait(minutes * 60 * 1000);
  }
}

client.on("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  startMarketLoop();
});

client.on("messageCreate", (msg) => {
  if (msg.content === "!stocks") {
    let lines = Object.entries(stocks).map(
      ([symbol, price]) => `${symbol}: $${price.toFixed(2)}`
    );
    msg.channel.send("📈 **Current Stock Prices**:\n" + lines.join("\n"));
  } else if (msg.content.startsWith("!price ")) {
    let symbol = msg.content.split(" ")[1].toUpperCase();
    if (stocks[symbol]) {
      msg.channel.send(`${symbol} is currently at $${stocks[symbol].toFixed(2)}`);
    } else {
      msg.channel.send(`Stock symbol \`${symbol}\` not found.`);
    }
  } else if (msg.content.startsWith("!addevent ")) {
    if (msg.author.id !== adminID) return;

    const args = msg.content.split(" ");
    if (args.length < 4) {
      return msg.reply("Usage: `!addevent SYMBOL +/-0.10 \"Event message here\"`");
    }

    const symbol = args[1].toUpperCase();
    const change = parseFloat(args[2]);
    const messageMatch = msg.content.match(/\"([^\"]+)\"/);
    const eventMsg = messageMatch ? messageMatch[1] : null;

    if (!stocks[symbol]) {
      return msg.reply(`Stock symbol \`${symbol}\` not found.`);
    }

    if (isNaN(change) || !eventMsg) {
      return msg.reply("Invalid format. Wrap the event message in quotes.");
    }

    customEvents.push({ symbol, change, message: eventMsg });
    msg.reply(`✅ Event added! You now have ${customEvents.length} custom event(s).`);
  } else if (msg.content.startsWith("!doevent ")) {
    if (msg.author.id !== adminID) return;

    const index = parseInt(msg.content.split(" ")[1]);
    const event = customEvents[index];

    if (!event) {
      return msg.reply(`⚠️ No event found at index ${index}`);
    }

    const symbol = event.symbol;
    const change = event.change;
    const msgText = event.message;

    stocks[symbol] = Math.max(1, stocks[symbol] + stocks[symbol] * change);

    const report = Object.entries(stocks)
      .map(([sym, price]) => `${sym}: $${price.toFixed(2)}`)
      .join('\n');

    msg.channel.send(`🧨 **Manual Event Triggered**: ${msgText}\n\`\`\`${report}\`\`\``);
  }
});

// 🧠 IMPORTANT: Log in and catch login errors
client.login(process.env.TOKEN).catch(err => {
  console.error("❌ Discord login failed:", err);
});
