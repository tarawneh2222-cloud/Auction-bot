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

app.get('/', (_req, res) => res.send('✅ البوت يعمل بنظام الرسائل النصية'));
app.listen(PORT, () => console.log(`🌐 يعمل على المنفذ ${PORT}`));

const { Client, GatewayIntentBits } = require('discord.js');

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

// معالجة الرسائل النصية فقط
client.on('messageCreate', async message => {
  if (message.author.bot) return;
  const userId = message.author.id;
  const user = getUser(userId);
  const content = message.content.trim();

  // !حسابي
  if (content === '!حسابي') {
    const invCount = Object.keys(user.investments).length;
    await message.reply(
      `💰 **معلومات حسابك**\n` +
      `💵 الرصيد: **${user.balance} ريال**\n` +
      `🏦 في البنك: **${user.bank} ريال**\n` +
      `📈 استثماراتك: **${invCount} نوع**`
    );
  }

  // !راتب
  else if (content === '!راتب') {
    const now = Date.now();
    if (now - user.lastDaily < 86400000) {
      return await message.reply('⏰ عُد بعد 24 ساعة!');
    }
    user.lastDaily = now;
    user.balance += 200;
    saveData();
    await message.reply('✅ استلمت راتبك: **200 ريال** 💵');
  }

  // !صندوق
  else if (content === '!صندوق') {
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

  // !ايداع المبلغ
  else if (content.startsWith('!ايداع ')) {
    const amount = parseInt(content.split(' ')[1]);
    if (!amount || amount <= 0 || amount > user.balance) {
      return await message.reply('❌ استخدم: !ايداع 500');
    }
    user.balance -= amount;
    user.bank += amount;
    saveData();
    await message.reply(`✅ أودعت **${amount} ريال**\n💰 رصيد: ${user.balance} | 🏦 بنك: ${user.bank}`);
  }

  // !سحب المبلغ
  else if (content.startsWith('!سحب ')) {
    const amount = parseInt(content.split(' ')[1]);
    if (!amount || amount <= 0 || amount > user.bank) {
      return await message.reply('❌ استخدم: !سحب 500');
    }
    user.bank -= amount;
    user.balance += amount;
    saveData();
    await message.reply(`✅ سحبت **${amount} ريال**\n💰 رصيد: ${user.balance} | 🏦 بنك: ${user.bank}`);
  }

  // !تعويض المعرف المبلغ (للمدراء فقط)
  else if (content.startsWith('!تعويض ')) {
    if (!message.member.permissions.has('Administrator')) {
      return await message.reply('❌ غير مسموح لك بهذا الأمر!');
    }
    const parts = content.split(' ');
    const targetId = parts[1];
    const amount = parseInt(parts[2]);
    if (!targetId || !amount) {
      return await message.reply('❌ استخدم: !تعويض 123456789 1000');
    }
    if (!storedData[targetId]) {
      storedData[targetId] = { balance: 0, bank: 0, investments: {}, lastDaily: 0, lastDailyBox: 0 };
    }
    storedData[targetId].balance += amount;
    saveData();
    await message.reply(`✅ تم تعويض المستخدم بـ **${amount} ريال**`);
  }
});

client.on('ready', () => {
  console.log(`✅ ${client.user.username} جاهز! استخدم الأوامر بعلامة !`);
});

if (!process.env.DISCORD_TOKEN) {
  console.error('❌ التوكن غير موجود!');
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error('❌ خطأ في تسجيل الدخول:', err);
  process.exit(1);
});
