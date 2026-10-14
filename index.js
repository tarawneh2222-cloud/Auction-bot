'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

const DATA_FILE = path.join(__dirname, 'data.json');

let users = {};

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      users = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      console.log(`✅ تم تحميل بيانات ${Object.keys(users).length} مستخدم`);
    }
  } catch (e) {
    console.log('📄 ملف بيانات جديد');
    users = {};
  }
}

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(users, null, 2));
}

function getUser(id) {
  if (!users[id]) {
    users[id] = { balance: 1000, bank: 0 };
    saveData();
  }
  return users[id];
}

app.get('/', (req, res) => res.send('✅ البوت يعمل'));
app.listen(PORT, () => console.log('🌐 جاهز'));

const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

loadData();

client.on('ready', () => {
  console.log(`✅ ${client.user.tag} جاهز! اكتب: !حسابي`);
});

client.on('messageCreate', async message => {
  if (message.author.bot) return;
  
  const content = message.content.trim();
  const userId = message.author.id;
  
  // ✅ !حسابي
  if (content === '!حسابي') {
    const user = getUser(userId);
    await message.reply(`💰 رصيدك: **${user.balance} ريال**\n🏦 في البنك: **${user.bank} ريال**`);
    console.log(`✅ عرض رصيد لـ ${message.author.username}`);
  }
  
  // ✅ !راتب
  else if (content === '!راتب') {
    const user = getUser(userId);
    const now = Date.now();
    if (!user.lastDaily || now - user.lastDaily > 86400000) {
      user.lastDaily = now;
      user.balance += 200;
      saveData();
      await message.reply('✅ استلمت راتبك: **200 ريال** 💵');
    } else {
      await message.reply('⏰ عُد غداً!');
    }
  }
});

client.login(process.env.DISCORD_TOKEN)
  .catch(err => console.error('❌ خطأ:', err));
