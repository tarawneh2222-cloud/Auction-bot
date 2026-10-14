'use strict';

const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('✅ البوت يعمل'));
app.listen(PORT, () => console.log('🌐 الخادم يعمل'));

const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ملف بيانات بسيط
const fs = require('fs');
const DATA_FILE = './data.json';

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (e) {
    console.log('ملف بيانات جديد');
  }
  return {};
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

let users = loadData();

function getUser(id) {
  if (!users[id]) {
    users[id] = { balance: 1000, bank: 0 };
    saveData(users);
  }
  return users[id];
}

client.on('ready', () => {
  console.log(`✅ ${client.user.tag} يعمل الآن! اكتب !حسابي`);
});

// فقط أمر واحد للاختبار
client.on('messageCreate', async message => {
  if (message.author.bot) return;
  
  console.log(`📩 وصلت رسالة: ${message.content} من ${message.author.username}`);
  
  if (message.content.trim() === '!حسابي') {
    const user = getUser(message.author.id);
    await message.reply(`💰 رصيدك: ${user.balance} ريال`);
    console.log('✅ تم الرد على الأمر');
  }
});

client.login(process.env.DISCORD_TOKEN)
  .then(() => console.log('✅ تم تسجيل الدخول'))
  .catch(err => console.error('❌ خطأ في تسجيل الدخول:', err));
