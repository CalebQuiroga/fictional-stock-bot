const { Client, GatewayIntentBits, Partials } = require("discord.js");
require("dotenv").config();
const express = require("express");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

let stocks = {
  APP: 100.0,
  COAL: 50.0,
  AMZOON: 200.0,
  TAYLR: 130.0
};

const adminID = "907341400830537838"; // Your Discord ID
let customEvents = [];

// Helper: wait function
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// Schedule
const schedule = [
  { days: ["Friday"], duration: 71 },
  { days: ["Monday"], duration: 25 },
  { days: ["Tuesday"], duration: 23 },
  { days: ["Wednesday"], duration: 25 },
  { days: ["Thursday"], duration: 25 }
];

// Stock update logic
function updateStocks() {
  for (let stock in stocks) {
    let change = (Math.random() - 0.5) * 10;
    stocks[stock] = Math.max(1, stocks[stock] + change);
  }
}

// Start market loop
async function startMarketLoop() {
  while (true) {
    const now = new Date();
    const day = now.toLocaleString("en-US", { weekday: "long", timeZone: "UTC" });
    const entry = schedule.find(s => s.days.includes(day));
    const minutes = entry ? entry.duration : 25;

    updateStocks();

    const report = Object.entries(stocks)
      .map(([symbol, price]) => `${symbol}: $${price.toFixed(2)}`)
      .join("\n");

    const channel = client.channels.cache.get("1219680183985115136");
    if (channel) {
      await channel.send(`📅 **Market Update for ${day}**\n\`\`\`\n${report}\n\`\`\``);
    } else {
      console.log("⚠️ Could not find channel. Check the channel ID.");
    }

    await wait(minutes * 60 * 1000);
  }
}

// Bot ready
client.on("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  startMarketLoop();
});

// Message commands
client.on("messageCreate", (msg) => {
  if (msg.author.bot) return;

  if (msg.content === "!stocks") {
    const report = Object.entries(stocks)
      .map(([symbol, price]) => `${symbol}: $${price.toFixed(2)}`)
      .join("\n");
    msg.channel.send(`📈 **Current Stock Prices**:\n${report}`);
  }

  else if (msg.content.startsWith("!price ")) {
    const symbol = msg.content.split(" ")[1]?.toUpperCase();
    if (symbol && stocks[symbol]) {
      msg.channel.send(`${symbol} is currently at $${stocks[symbol].toFixed(2)}`);
    } else {
      msg.channel.send(`Stock symbol \`${symbol}\` not found.`);
    }
  }

  else if (msg.content.startsWith("!addevent ")) {
    if (msg.author.id !== adminID) return;

    const args = msg.content.split(" ");
    if (args.length < 4) {
      return msg.reply("Usage: `!addevent SYMBOL +/-0.10 \"Event message here\"`");
    }

    const symbol = args[1].toUpperCase();
    const change = parseFloat(args[2]);
    const messageMatch = msg.content.match(/"([^"]+)"/);
    const eventMsg = messageMatch ? messageMatch[1] : null;

    if (!stocks[symbol]) return msg.reply(`Stock symbol \`${symbol}\` not found.`);
    if (isNaN(change) || !eventMsg) return msg.reply("Invalid format. Wrap the event message in quotes.");

    customEvents.push({ symbol, change, message: eventMsg });
    msg.reply(`✅ Event added! You now have ${customEvents.length} custom event(s).`);
  }

  else if (msg.content.startsWith("!doevent ")) {
    if (msg.author.id !== adminID) return;

    const index = parseInt(msg.content.split(" ")[1]);
    const event = customEvents[index];

    if (!event) return msg.reply(`⚠️ No event found at index ${index}`);

    const { symbol, change, message: msgText } = event;
    stocks[symbol] = Math.max(1, stocks[symbol] + stocks[symbol] * change);

    const report = Object.entries(stocks)
      .map(([sym, price]) => `${sym}: $${price.toFixed(2)}`)
      .join("\n");

    msg.channel.send(`🧨 **Manual Event Triggered**: ${msgText}\n\`\`\`\n${report}\n\`\`\``);
  }
});

// Keep-alive for Azure
const app = express();
app.get("/", (req, res) => res.send("Bot is running."));
app.listen(process.env.PORT || 8080, () => {
  console.log("🌐 Dummy web server is active to keep Azure alive.");
});

client.login(process.env.TOKEN);
