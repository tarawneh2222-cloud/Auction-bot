'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

const DATA_FILE = path.join(__dirname, 'data.json');
let storedData = {};

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      storedData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
    console.log(`✅ بيانات: ${Object.keys(storedData).length} مستخدم`);
  } catch (e) {
    console.error('❌ خطأ:', e);
    storedData = {};
  }
}

function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(storedData, null, 2));
  } catch (e) {
    console.error('❌ خطأ:', e);
  }
}

app.get('/', (_req, res) => res.send('✅ البوت يعمل'));
app.listen(PORT, () => console.log('🌐 جاهز'));

const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

loadData();

function getUser(id) {
  if (!storedData[id]) {
    storedData[id] = {
      balance: 1000,
      bank: 0,
      investments: {},
      lastDaily: 0,
      lastDailyBox: 0
    };
    saveData();
  }
  return storedData[id];
}

const commands = [
  new SlashCommandBuilder().setName('حسابي').setDescription('عرض رصيدك'),
  new SlashCommandBuilder().setName('راتب').setDescription('راتب يومي'),
  new SlashCommandBuilder().setName('صندوق').setDescription('صندوق يومي'),
  new SlashCommandBuilder()
    .setName('ايداع')
    .setDescription('إيداع في البنك')
    .addIntegerOption(o => o.setName('المبلغ').setRequired(true).setMinValue(1)),
  new SlashCommandBuilder()
    .setName('سحب')
    .setDescription('سحب من البنك')
    .addIntegerOption(o => o.setName('المبلغ').setRequired(true).setMinValue(1)),
  new SlashCommandBuilder()
    .setName('تعويض')
    .setDescription('إضافة رصيد')
    .setDefaultMemberPermissions('0')
    .addStringOption(o => o.setName('المعرف').setRequired(true))
    .addIntegerOption(o => o.setName('المبلغ').setRequired(true).setMinValue(1))
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

client.on('ready', async () => {
  console.log(`✅ ${client.user.username} يعمل`);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('✅ الأوامر محملة');
  } catch (e) {
    console.error('❌ خطأ في تحميل الأوامر:', e);
  }
});

// نظام الرسائل النصية — سريع ومباشر
client.on('messageCreate', async message => {
  if (message.author.bot) return;
  const userId = message.author.id;
  const user = getUser(userId);
  const c = message.content.trim();

  if (c === '!حسابي') {
    const invCount = Object.keys(user.investments).length;
    await message.reply(
      `💰 **معلومات حسابك**\n💵 الرصيد: **${user.balance} ريال**\n🏦 في البنك: **${user.bank} ريال**\n📈 استثماراتك: **${invCount} نوع**`
    );
  }
  else if (c === '!راتب') {
    const now = Date.now();
    if (now - user.lastDaily < 86400000) return await message.reply('⏰ عُد بعد 24 ساعة!');
    user.lastDaily = now;
    user.balance += 200;
    saveData();
    await message.reply('✅ استلمت راتبك: **200 ريال** 💵');
  }
  else if (c === '!صندوق') {
    const now = Date.now();
    if (now - user.lastDailyBox < 86400000) return await message.reply('⏰ عُد غداً!');
    const rewards = [50, 75, 100, 150, 200, 250, 500];
    const amount = rewards[Math.floor(Math.random() * rewards.length)];
    user.balance += amount;
    user.lastDailyBox = now;
    saveData();
    await message.reply(`📦 وجدت: **${amount} ريال**! 🎉`);
  }
  else if (c.startsWith('!ايداع ')) {
    const amount = parseInt(c.split(' ')[1]);
    if (!amount || amount <= 0 || amount > user.balance) return await message.reply('❌ استخدم: !ايداع 500');
    user.balance -= amount;
    user.bank += amount;
    saveData();
    await message.reply(`✅ أودعت **${amount} ريال**\n💰 رصيد: ${user.balance} | 🏦 بنك: ${user.bank}`);
  }
  else if (c.startsWith('!سحب ')) {
    const amount = parseInt(c.split(' ')[1]);
    if (!amount || amount <= 0 || amount > user.bank) return await message.reply('❌ استخدم: !سحب 500');
    user.bank -= amount;
    user.balance += amount;
    saveData();
    await message.reply(`✅ سحبت **${amount} ريال**\n💰 رصيد: ${user.balance} | 🏦 بنك: ${user.bank}`);
  }
  else if (c.startsWith('!تعويض ')) {
    if (!message.member.permissions.has('Administrator')) return await message.reply('❌ غير مسموح لك!');
    const parts = c.split(' ');
    const targetId = parts[1];
    const amount = parseInt(parts[2]);
    if (!targetId || !amount) return await message.reply('❌ استخدم: !تعويض المعرف المبلغ');
    if (!storedData[targetId]) storedData[targetId] = { balance: 0, bank: 0, investments: {}, lastDaily: 0, lastDailyBox: 0 };
    storedData[targetId].balance += amount;
    saveData();
    await message.reply(`✅ تم تعويض المستخدم بـ **${amount} ريال**`);
  }
});

// نظام الأوامر المائلة
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const userId = interaction.user.id;
  const user = getUser(userId);

  try {
    if (interaction.commandName === 'حسابي') {
      const invCount = Object.keys(user.investments).length;
      await interaction.reply(
        `💰 **معلومات حسابك**\n💵 الرصيد: **${user.balance} ريال**\n🏦 في البنك: **${user.bank} ريال**\n📈 استثماراتك: **${invCount} نوع**`
      );
    }
    else if (interaction.commandName === 'راتب') {
      const now = Date.now();
      if (now - user.lastDaily < 86400000) return await interaction.reply('⏰ عُد بعد 24 ساعة!');
      user.lastDaily = now;
      user.balance += 200;
      saveData();
      await interaction.reply('✅ استلمت راتبك: **200 ريال** 💵');
    }
    else if (interaction.commandName === 'صندوق') {
      const now = Date.now();
      if (now - user.lastDailyBox < 86400000) return await interaction.reply('⏰ عُد غداً!');
      const rewards = [50, 75, 100, 150, 200, 250, 500];
      const amount = rewards[Math.floor(Math.random() * rewards.length)];
      user.balance += amount;
      user.lastDailyBox = now;
      saveData();
      await interaction.reply(`📦 وجدت: **${amount} ريال**! 🎉`);
    }
    else if (interaction.commandName === 'ايداع') {
      const amount = interaction.options.getInteger('المبلغ');
      if (amount > user.balance) return await interaction.reply('❌ رصيدك لا يكفي!', { ephemeral: true });
      user.balance -= amount;
      user.bank += amount;
      saveData();
      await interaction.reply(`✅ أودعت **${amount} ريال**\n💰 رصيد: ${user.balance} | 🏦 بنك: ${user.bank}`);
    }
    else if (interaction.commandName === 'سحب') {
      const amount = interaction.options.getInteger('المبلغ');
      if (amount > user.bank) return await interaction.reply('❌ رصيدك في البنك لا يكفي!', { ephemeral: true });
      user.bank -= amount;
      user.balance += amount;
      saveData();
      await interaction.reply(`✅ سحبت **${amount} ريال**\n💰 رصيد: ${user.balance} | 🏦 بنك: ${user.bank}`);
    }
    else if (interaction.commandName === 'تعويض') {
      if (!interaction.member.permissions.has('Administrator')) return await interaction.reply('❌ غير مسموح لك!', { ephemeral: true });
      const targetId = interaction.options.getString('المعرف');
      const amount = interaction.options.getInteger('المبلغ');
      if (!storedData[targetId]) storedData[targetId] = { balance: 0, bank: 0, investments: {}, lastDaily: 0, lastDailyBox: 0 };
      storedData[targetId].balance += amount;
      saveData();
      await interaction.reply(`✅ تم تعويض المستخدم بـ **${amount} ريال**`);
    }
  } catch (e) {
    console.error('❌ خطأ:', e);
    if (!interaction.replied) {
      await interaction.reply({ content: '❌ حدث خطأ! حاول مرة أخرى', ephemeral: true }).catch(() => {});
    }
  }
});

if (!process.env.DISCORD_TOKEN) {
  console.error('❌ التوكن مفقود!');
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error('❌ خطأ:', err);
  process.exit(1);
});
