'use strict';

const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (_req, res) => res.send('✅ البوت يعمل!'));
app.listen(PORT, () => console.log(`🌐 الخادم يعمل على المنفذ ${PORT}`));

const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const userData = new Map();
function getUser(id) {
  if (!userData.has(id)) {
    userData.set(id, {
      balance: 1000,
      bank: 0,
      investments: {},
      lastDaily: 0,
      lastDailyBox: 0
    });
  }
  return userData.get(id);
}

const marketItems = [
  { id: 'gold', name: 'ذهب', icon: '🥇', basePrice: 200, minPrice: 150, maxPrice: 500, currentPrice: 200 },
  { id: 'silver', name: 'فضة', icon: '🥈', basePrice: 80, minPrice: 40, maxPrice: 200, currentPrice: 80 }
];

const auctions = new Map();

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const user = getUser(interaction.user.id);
  const { commandName, options } = interaction;

  if (commandName === 'حسابي') {
    await interaction.reply(`💰 رصيدك: ${user.balance} ريال\n🏦 في البنك: ${user.bank} ريال`);
  }

  else if (commandName === 'راتب') {
    const now = Date.now();
    if (now - user.lastDaily < 86400000) {
      return await interaction.reply('⏰ عُد بعد 24 ساعة!');
    }
    user.lastDaily = now;
    user.balance += 200;
    await interaction.reply('✅ استلمت راتبك: 200 ريال 💵');
  }

  else if (commandName === 'حظ') {
    const bet = options.getInteger('المبلغ');
    const guess = options.getInteger('الرقم');
    if (bet <= 0 || bet > user.balance) return await interaction.reply('❌ مبلغ غير صالح!');
    if (guess < 1 || guess > 10) return await interaction.reply('❌ اختر رقماً من 1 إلى 10');
    
    user.balance -= bet;
    const lucky = Math.floor(Math.random() * 10) + 1;
    
    if (guess === lucky) {
      user.balance += bet * 5;
      await interaction.reply(`🎯 الرقم كان: ${lucky}\n🎉 فزت بـ ${bet * 5} ريال!`);
    } else {
      await interaction.reply(`🎯 الرقم كان: ${lucky}\n❌ خسرت ${bet} ريال`);
    }
  }

  else if (commandName === 'صندوق_يومي') {
    const now = Date.now();
    if (user.lastDailyBox && now - user.lastDailyBox < 86400000) {
      return await interaction.reply('⏰ عُد غداً!');
    }
    const amount = [50, 100, 200, 500][Math.floor(Math.random() * 4)];
    user.balance += amount;
    user.lastDailyBox = now;
    await interaction.reply(`📦 وجدت: ${amount} ريال! 🎉`);
  }
});

const commands = [
  new SlashCommandBuilder().setName('حسابي').setDescription('معلومات حسابك'),
  new SlashCommandBuilder().setName('راتب').setDescription('استلام راتب يومي'),
  new SlashCommandBuilder()
    .setName('حظ')
    .setDescription('تخمن رقماً واربح')
    .addIntegerOption(o => o.setName('المبلغ').setDescription('المبلغ').setMinValue(10).setRequired(true))
    .addIntegerOption(o => o.setName('الرقم').setDescription('من 1-10').setMinValue(1).setMaxValue(10).setRequired(true)),
  new SlashCommandBuilder().setName('صندوق_يومي').setDescription('هدية يومية مجانية')
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

client.on('ready', async () => {
  console.log(`✅ ${client.user.username} جاهز!`);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('✅ تم تحميل الأوامر');
  } catch (e) { { console.error(e); } }
});

if (!process.env.DISCORD_TOKEN) {
  console.error('❌ لم يتم العثور على التوكن!');
  process.exit(1);
}
client.login(process.env.DISCORD_TOKEN).catch(e => { console.error(e); process.exit(1); });
