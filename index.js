const { Client, GatewayIntentBits, Partials } = require("discord.js");
require("dotenv").config();

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

// Helper: Wait N milliseconds
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// Your real-time-to-game-time schedule
const schedule = [
  { days: ['Friday'], duration: 71 },
  { days: ['Monday'], duration: 25 },
  { days: ['Tuesday'], duration: 23 },
  { days: ['Wednesday'], duration: 25 },
  { days: ['Thursday'], duration: 25 },
];

// Update stock prices randomly
function updateStocks() {
  for (let stock in stocks) {
    let change = (Math.random() - 0.5) * 10; // -5 to +5
    stocks[stock] = Math.max(1, stocks[stock] + change);
  }
}

// Automatically send update to a channel on your schedule
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

    await wait(minutes * 60 * 1000); // wait until next tick
  }
}

// Start bot
client.on("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  startMarketLoop(); // start auto-report loop
});

// Manual commands
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
  }
});

client.login(process.env.TOKEN);
