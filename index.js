'use strict';

require('dotenv').config();
const express = require('express');
const fs = require('node:fs');
const path = require('node:path');

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  Events
} = require('discord.js');

// خادم الويب لمراقبة التشغيل على Render
const app = express();
app.get('/', (_req, res) => res.status(200).send('✅ البوت يعمل بنجاح تام!'));
app.get('/health', (_req, res) => res.json({ status: 'OK' }));
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 خادم الويب يعمل على المنفذ ${PORT}`);
});

const DATA_PATH = path.join(__dirname, 'data.json');

const MARKET_ASSETS = {
  phones: { name: 'هواتف ذكية 📱', price: 1200 },
  cars: { name: 'سيارات فارهة 🚗', price: 15000 },
  stocks: { name: 'أسهم شركات 📊', price: 25000 },
  lands: { name: 'أراضي تجارية 🏙️', price: 60000 }
};

function initDatabase() {
  if (!fs.existsSync(DATA_PATH)) {
    fs.writeFileSync(DATA_PATH, JSON.stringify({ users: {} }, null, 2));
  }
}

function readData() {
  initDatabase();
  try {
    const raw = fs.readFileSync(DATA_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed.users) parsed.users = {};
    return parsed;
  } catch (err) {
    return { users: {} };
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

function getUserData(userId) {
  const db = readData();
  if (!db.users[userId]) {
    db.users[userId] = {
      balance: 1000,
      bank: 0,
      dailyLast: '',
      dailyStreak: 0,
      assets: { phones: 0, cars: 0, stocks: 0, lands: 0 }
    };
    saveData(db);
  }
  return db.users[userId];
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once(Events.ClientReady, () => {
  console.log(`✅ تم تسجيل الدخول بنجاح باسم: ${client.user.tag}`);
});

// معالج الأوامر النصية
client.on(Events.MessageCreate, async message => {
  if (message.author.bot || !message.guild) return;
  const content = message.content.trim();
  const userId = message.author.id;

  if (content === '!مساعدة' || content === '!اوامر') {
    const embed = new EmbedBuilder()
      .setTitle('📜 قائمة الأوامر الاقتصادية')
      .addFields(
        { name: '💳 الحساب', value: '`!حساب` لعرض رصيدك وأصولك' },
        { name: '🎁 المكافأة', value: '`!يومية` لاستلام هدفتك اليومية' },
        { name: '🏦 البنك', value: '`!إيداع [مبلغ]` أو `!سحب [مبلغ]`' },
        { name: '📊 السوق', value: '`!سوق` لعرض الأصول والشراء' },
        { name: '🎰 الألعاب', value: '`!سلوتس [المبلغ]` للعب الحظ' }
      )
      .setColor('#3498db');
    await message.reply({ embeds: [embed] });
    return;
  }

  if (content === '!حساب' || content === '!حسابي') {
    const user = getUserData(userId);
    const embed = new EmbedBuilder()
      .setTitle(`💳 حساب اللاعب: ${message.author.username}`)
      .addFields(
        { name: '💰 النقدي', value: `${user.balance.toLocaleString()} $`, inline: true },
        { name: '🏦 البنك', value: `${user.bank.toLocaleString()} $`, inline: true },
        { name: '🔥 الستريك اليومي', value: `${user.dailyStreak || 0} أيام`, inline: true }
      )
      .setColor('#2ecc71');
    await message.reply({ embeds: [embed] });
    return;
  }

  if (content === '!يومية' || content === '!يومي') {
    const db = readData();
    const user = getUserData(userId);
    const today = new Date().toDateString();

    if (user.dailyLast === today) {
      await message.reply('⏳ لقد استلمت مكافأتك اليومية بالفعل! عُد غداً.');
      return;
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (user.dailyLast === yesterday.toDateString()) {
      user.dailyStreak = (user.dailyStreak || 0) + 1;
    } else {
      user.dailyStreak = 1;
    }

    const amount = 300 + ((user.dailyStreak - 1) * 50);
    user.balance += amount;
    user.dailyLast = today;
    db.users[userId] = user;
    saveData(db);

    await message.reply(`🎁 **استلمت مكافأتك اليومية بنجاح!** ربحت **${amount.toLocaleString()}$** (ستريك: ${user.dailyStreak} أيام 🔥)`);
    return;
  }

  if (content.startsWith('!إيداع')) {
    const args = content.split(' ');
    const db = readData();
    const user = getUserData(userId);
    let amount = args[1] === 'الكل' || args[1] === 'all' ? user.balance : parseInt(args[1]);

    if (isNaN(amount) || amount <= 0 || user.balance < amount) {
      await message.reply('❌ يرجى تحديد مبلغ صحيح للإيداع أو كتابة `!إيداع الكل`.');
      return;
    }

    user.balance -= amount;
    user.bank += amount;
    db.users[userId] = user;
    saveData(db);

    await message.reply(`✅ تم إيداع **${amount.toLocaleString()}$** في البنك بنجاح! 🏦`);
    return;
  }

  if (content.startsWith('!سحب')) {
    const args = content.split(' ');
    const db = readData();
    const user = getUserData(userId);
    let amount = args[1] === 'الكل' || args[1] === 'all' ? user.bank : parseInt(args[1]);

    if (isNaN(amount) || amount <= 0 || user.bank < amount) {
      await message.reply('❌ يرجى تحديد مبلغ صحيح للسحب أو كتابة `!سحب الكل`.');
      return;
    }

    user.bank -= amount;
    user.balance += amount;
    db.users[userId] = user;
    saveData(db);

    await message.reply(`✅ تم سحب **${amount.toLocaleString()}$** إلى محفظتك النقدية! 💰`);
    return;
  }

  if (content === '!سوق') {
    const embed = new EmbedBuilder()
      .setTitle('📊 سوق الأصول والبورصة')
      .setDescription('اختر الأصل الذي ترغب في شرائه من القائمة أدناه: 🛒')
      .setColor('#e67e22');

    const selectOptions = [];
    for (const key in MARKET_ASSETS) {
      const asset = MARKET_ASSETS[key];
      embed.addFields({ name: asset.name, value: `السعر: **${asset.price.toLocaleString()}$**`, inline: true });
      selectOptions.push(
        new StringSelectMenuOptionBuilder()
          .setLabel(asset.name)
          .setValue(`buy_${key}`)
          .setDescription(`شراء بسعر ${asset.price.toLocaleString()}$`)
      );
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select_market_buy')
      .setPlaceholder('🛒 اختر أصلاً لشرائه...')
      .addOptions(selectOptions);

    const row = new ActionRowBuilder().addComponents(selectMenu);
    await message.reply({ embeds: [embed], components: [row] });
    return;
  }

  if (content.startsWith('!سلوتس') || content.startsWith('!slots')) {
    const args = content.split(' ');
    const bet = parseInt(args[1]);

    if (isNaN(bet) || bet <= 0) {
      await message.reply('❌ يرجى تحديد مبلغ الرهان بشكل صحيح! مثال: `!سلوتس 100`');
      return;
    }

    const db = readData();
    const user = getUserData(userId);
    if (user.balance < bet) {
      await message.reply('❌ رصيدك النقدي لا يكفي لهذا الرهان!');
      return;
    }

    const symbols = ['🍒', '💎', '🍋', '🔔', '⭐'];
    const s1 = symbols[Math.floor(Math.random() * symbols.length)];
    const s2 = symbols[Math.floor(Math.random() * symbols.length)];
    const s3 = symbols[Math.floor(Math.random() * symbols.length)];

    let resultText = '';
    let prize = 0;

    if (s1 === s2 && s2 === s3) {
      prize = bet * 10;
      resultText = `🎉 **جائزة كبرى (10x)!** ربحت **${prize.toLocaleString()}$**!`;
    } else if (s1 === s2 || s2 === s3 || s1 === s3) {
      prize = bet * 2;
      resultText = `✨ **تطابق رائع (2x)!** ربحت **${prize.toLocaleString()}$**!`;
    } else {
      resultText = `😢 **خسرت الرهان!** حظاً أوفر في المرة القادمة.`;
    }

    user.balance -= bet;
    if (prize > 0) user.balance += prize;
    db.users[userId] = user;
    saveData(db);

    await message.reply(`🎰 **[ ${s1} | ${s2} | ${s3} ]**\n\n${resultText}`);
    return;
  }
});

// معالج التفاعلات (القوائم المنسدلة)
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isStringSelectMenu()) return;

  if (interaction.customId === 'select_market_buy') {
    const userId = interaction.user.id;
    const assetKey = interaction.values[0].replace('buy_', '');
    const asset = MARKET_ASSETS[assetKey];

    if (!asset) {
      await interaction.reply({ content: '❌ الأصل غير موجود!', ephemeral: true });
      return;
    }

    const db = readData();
    const user = getUserData(userId);

    if (user.balance < asset.price) {
      await interaction.reply({
        content: `❌ رصيدك النقدي (**${user.balance.toLocaleString()}$**) لا يكفي لشراء ${asset.name}!`,
        ephemeral: true
      });
      return;
    }

    user.balance -= asset.price;
    if (!user.assets) user.assets = {};
    user.assets[assetKey] = (user.assets[assetKey] || 0) + 1;
    db.users[userId] = user;
    saveData(db);

    await interaction.reply({
      content: `✅ **تمت عملية الشراء بنجاح!** 🎉 اشتريت 1 من **${asset.name}** بسعر **${asset.price.toLocaleString()}$**.`,
      ephemeral: true
    });
  }
});

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('❌ خطأ: لم يتم العثور على توكن البوت في متغيرات البيئة (DISCORD_TOKEN)!');
  process.exit(1);
}

client.login(token);
