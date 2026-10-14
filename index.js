'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// إعداد ملف البيانات
const DATA_FILE = path.join(__dirname, 'data.json');
let storedData = {};

// قراءة البيانات
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      storedData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
    console.log(`✅ تم تحميل بيانات ${Object.keys(storedData).length} مستخدم`);
  } catch (e) {
    console.error('❌ خطأ في قراءة البيانات:', e);
    storedData = {};
  }
}

// حفظ البيانات
function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(storedData, null, 2));
  } catch (e) {
    console.error('❌ خطأ في حفظ البيانات:', e);
  }
}

app.get('/', (_req, res) => res.send('✅ البوت يعمل'));
app.listen(PORT, () => console.log(`🌐 يعمل على المنفذ ${PORT}`));

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

// أوامر الرسائل النصية كحل بديل فوري
client.on('messageCreate', async message => {
  if (message.author.bot) return;
  const userId = message.author.id;
  
  // أمر !حسابي
  if (message.content === '!حسابي') {
    const user = getUser(userId);
    const invCount = Object.keys(user.investments).length;
    await message.reply(
      `💰 **معلومات حسابك**\n` +
      `💵 الرصيد: **${user.balance} ريال**\n` +
      `🏦 في البنك: **${user.bank} ريال**\n` +
      `📈 استثماراتك: **${invCount} نوع**`
    );
  }
  
  // أمر !راتب
  else if (message.content === '!راتب') {
    const user = getUser(userId);
    const now = Date.now();
    if (now - user.lastDaily < 86400000) {
      return await message.reply('⏰ عُد بعد 24 ساعة!');
    }
    user.lastDaily = now;
    user.balance += 200;
    saveData();
    await message.reply('✅ استلمت راتبك: **200 ريال** 💵');
  }
  
  // أمر !صندوق
  else if (message.content === '!صندوق') {
    const user = getUser(userId);
    const now = Date.now();
    if (now - user.lastDailyBox < 86400000) {
      return await message.reply('⏰ عُد غداً!');
    }
    const rewards = [50, 75, 100, 150, 200, 250, 500];
    const amount = rewards[Math.floor(Math.random() * rewards.length)];
    user.balance += amount;
    user.lastDailyBox = now;
    saveData();
    await message.reply(`📦 وجدت: **${amount} ريال**! 🎉`);
  }
});

// الأوامر المائلة
const commands = [
  new SlashCommandBuilder().setName('حسابي').setDescription('عرض رصيدك'),
  new SlashCommandBuilder().setName('راتب').setDescription('راتب يومي'),
  new SlashCommandBuilder().setName('صندوق').setDescription('صندوق يومي'),
  new SlashCommandBuilder().setName('تعويض').setDescription('إضافة رصيد')
    .addStringOption(o => o.setName('المعرف').setRequired(true))
    .addIntegerOption(o => o.setName('المبلغ').setRequired(true))
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

client.on('ready', async () => {
  console.log(`✅ ${client.user.username} جاهز!`);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('✅ الأوامر محملة');
  } catch (e) {
    console.error('❌ خطأ في تحميل الأوامر:', e);
  }
});

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
      if (now - user.lastDaily < 86400000) {
        return await interaction.reply('⏰ عُد بعد 24 ساعة!');
      }
      user.lastDaily = now;
      user.balance += 200;
      saveData();
      await interaction.reply('✅ استلمت راتبك: **200 ريال** 💵');
    }
    else if (interaction.commandName === 'صندوق') {
      const now = Date.now();
      if (now - user.lastDailyBox < 86400000) {
        return await interaction.reply('⏰ عُد غداً!');
      }
      const rewards = [50, 75, 100, 150, 200, 250, 500];
      const amount = rewards[Math.floor(Math.random() * rewards.length)];
      user.balance += amount;
      user.lastDailyBox = now;
      saveData();
      await interaction.reply(`📦 وجدت: **${amount} ريال**! 🎉`);
    }
    else if (interaction.commandName === 'تعويض') {
      if (!interaction.member.permissions.has('Administrator')) {
        return await interaction.reply('❌ غير مسموح لك', { ephemeral: true });
      }
      const targetId = interaction.options.getString('المعرف');
      const amount = interaction.options.getInteger('المبلغ');
      if (!storedData[targetId]) {
        storedData[targetId] = { balance: 0, bank: 0, investments: {}, lastDaily: 0, lastDailyBox: 0 };
      }
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
  console.error('❌ التوكن غير موجود!');
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error('❌ خطأ في تسجيل الدخول:', err);
  process.exit(1);
});
