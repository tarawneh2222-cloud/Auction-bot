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

// 📊 أسعار السوق والأصول
const MARKET_ASSETS = {
  phones: { name: 'هواتف ذكية 📱', price: 1200 },
  cars: { name: 'سيارات فارهة 🚗', price: 15000 },
  stocks: { name: 'أسهم شركات 📊', price: 25000 },
  lands: { name: 'أراضي تجارية 🏙️', price: 60000 }
};

// 🏢 المشاريع الاستثمارية
const BUSINESSES = {
  cafe: { name: 'مقهى ☕', cost: 5000, incomePerHour: 100 },
  gas: { name: 'محطة بنزين ⛽', cost: 15000, incomePerHour: 350 },
  tech: { name: 'شركة تكنولوجيا 💻', cost: 50000, incomePerHour: 1200 },
  factory: { name: 'مصنع سيارات 🏭', cost: 120000, incomePerHour: 3000 },
  realestate: { name: 'شركة عقارات 🏙️', cost: 300000, incomePerHour: 8000 }
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
      assets: { phones: 0, cars: 0, stocks: 0, lands: 0 },
      businesses: { cafe: 0, gas: 0, tech: 0, factory: 0, realestate: 0 },
      lastClaimedIncome: Date.now()
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

  // 🏛️ اللوحة الرئيسية التفاعلية
  if (content === '!قائمة' || content === '!القائمة') {
    const embed = new EmbedBuilder()
      .setTitle('🏛️ المركز الاقتصادي والاستثماري')
      .setDescription('اختر القسم المطلوب من الأزرار التفاعلية أدناه:')
      .setColor('#2b90d9');

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('btn_account').setLabel('💳 حسابي').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('btn_daily').setLabel('🎁 اليومية').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('btn_claim_income').setLabel('💵 جمع الأرباح').setStyle(ButtonStyle.Success)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('btn_market').setLabel('📊 السوق').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('btn_businesses').setLabel('🏢 المشاريع').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('btn_games').setLabel('🎰 الألعاب').setStyle(ButtonStyle.Danger)
    );

    await message.reply({ embeds: [embed], components: [row1, row2] });
    return;
  }

  // 📜 قائمة الأوامر
  if (content === '!مساعدة' || content === '!اوامر') {
    const embed = new EmbedBuilder()
      .setTitle('📜 قائمة الأوامر الاقتصادية')
      .addFields(
        { name: '🏛️ القائمة العامة', value: '`!قائمة` لعرض لوحة التحكم بالأزرار' },
        { name: '💳 الحساب والبنك', value: '`!حساب` | `!إيداع [مبلغ]` | `!سحب [مبلغ]`' },
        { name: '🏢 المشاريع والاستثمار', value: '`!مشاريع` لعرض الشراء | `!ارباح` لجمع الأرباح' },
        { name: '📊 السوق والبورصة', value: '`!سوق` لشراء الأصول من القائمة المنسدلة' },
        { name: '🎰 الألعاب', value: '`!سلوتس [المبلغ]` للعب الحظ' }
      )
      .setColor('#3498db');
    await message.reply({ embeds: [embed] });
    return;
  }

  // 💳 الحساب الشخصي
  if (content === '!حساب' || content === '!حسابي') {
    const user = getUserData(userId);
    const embed = new EmbedBuilder()
      .setTitle(`💳 حساب اللاعب: ${message.author.username}`)
      .addFields(
        { name: '💰 النقدي', value: `${user.balance.toLocaleString()}$`, inline: true },
        { name: '🏦 البنك', value: `${user.bank.toLocaleString()}$`, inline: true },
        { name: '🔥 الستريك اليومي', value: `${user.dailyStreak || 0} أيام`, inline: true }
      )
      .setColor('#2ecc71');

    let assetList = '';
    for (const key in user.assets) {
      if (user.assets[key] > 0) {
        assetList += `• ${MARKET_ASSETS[key].name}: **${user.assets[key]}**\n`;
      }
    }
    if (assetList) {
      embed.addFields({ name: '📈 الأصول المملوكة', value: assetList, inline: false });
    }

    await message.reply({ embeds: [embed] });
    return;
  }

  // 🎁 المكافأة اليومية
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

  // 🏦 الإيداع والسحب
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

  // 🏢 عرض المشاريع والشراء
  if (content === '!مشاريع') {
    const user = getUserData(userId);
    const b = user.businesses || {};

    const embed = new EmbedBuilder()
      .setTitle('🏢 المشاريع الاستثمارية')
      .setDescription('شراء المشاريع يدر عليك أرباحاً تلقائية بمرور الوقت! لشراء مشروع اكتب `!شراء_مشروع [الاسم]`')
      .addFields(
        { name: '☕ مقهى (5,000$)', value: `المملوك: **${b.cafe || 0}** | الأرباح: 100$/ساعة\nالأمر: \`!شراء_مشروع مقهى\``, inline: false },
        { name: '⛽ محطة بنزين (15,000$)', value: `المملوك: **${b.gas || 0}** | الأرباح: 350$/ساعة\nالأمر: \`!شراء_مشروع بنزين\``, inline: false },
        { name: '💻 شركة تكنولوجيا (50,000$)', value: `المملوك: **${b.tech || 0}** | الأرباح: 1200$/ساعة\nالأمر: \`!شراء_مشروع تكنولوجيا\``, inline: false },
        { name: '🏭 مصنع سيارات (120,000$)', value: `المملوك: **${b.factory || 0}** | الأرباح: 3000$/ساعة\nالأمر: \`!شراء_مشروع مصنع\``, inline: false },
        { name: '🏙️ شركة عقارات (300,000$)', value: `المملوك: **${b.realestate || 0}** | الأرباح: 8000$/ساعة\nالأمر: \`!شراء_مشروع عقارات\``, inline: false }
      )
      .setColor('#8e44ad');

    await message.reply({ embeds: [embed] });
    return;
  }

  if (content.startsWith('!شراء_مشروع')) {
    const type = content.split(' ')[1] ? content.split(' ')[1].toLowerCase() : '';
    const mapKey = { 'مقهى': 'cafe', 'بنزين': 'gas', 'تكنولوجيا': 'tech', 'مصنع': 'factory', 'عقارات': 'realestate' }[type];

    if (!mapKey) {
      await message.reply('❌ حدد مشروعاً صحيحاً: `مقهى` | `بنزين` | `تكنولوجيا` | `مصنع` | `عقارات`');
      return;
    }

    const db = readData();
    const user = getUserData(userId);
    const proj = BUSINESSES[mapKey];

    if (user.balance < proj.cost) {
      await message.reply(`❌ رصيدك النقدي لا يكفي لشراء **${proj.name}**! تكلفته **${proj.cost.toLocaleString()}$**.`);
      return;
    }

    user.balance -= proj.cost;
    if (!user.businesses) user.businesses = {};
    user.businesses[mapKey] = (user.businesses[mapKey] || 0) + 1;
    db.users[userId] = user;
    saveData(db);

    await message.reply(`🎉 **مبروك!** اشتريت **${proj.name}** بنجاح! بدأ المشروع بتوليد الأرباح لك.`);
    return;
  }

  // 💵 جمع الأرباح
  if (content === '!ارباح' || content === '!أرباح') {
    const db = readData();
    const user = getUserData(userId);
    const now = Date.now();
    const last = user.lastClaimedIncome || now;
    const hours = (now - last) / (1000 * 60 * 60);

    const b = user.businesses || {};
    const hourlyIncome = ((b.cafe || 0) * 100) + ((b.gas || 0) * 350) + ((b.tech || 0) * 1200) + ((b.factory || 0) * 3000) + ((b.realestate || 0) * 8000);

    if (hourlyIncome === 0) {
      await message.reply('❌ لا تملك أي مشاريع حالياً لجمع أرباحها! اكتب `!مشاريع` لشراء أفكار استثمارية.');
      return;
    }

    const totalIncome = Math.floor(hourlyIncome * hours);
    if (totalIncome <= 0) {
      await message.reply('⏳ لم تتراكم أرباح كافية بعد، عُد بعد قليل!');
      return;
    }

    user.balance += totalIncome;
    user.lastClaimedIncome = now;
    db.users[userId] = user;
    saveData(db);

    await message.reply(`💵 **تمت إضافة أرباح مشاريعك!** جمعت **${totalIncome.toLocaleString()}$** بنجاح إلى محفظتك! 💰`);
    return;
  }

  // 📊 السوق
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

  // 🎰 لعبة السلوتس
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

    await message.reply(`🎰 **[ ${s1} \vert{}${s2} | ${s3} ]**\n\n${resultText}`);
    return;
  }
});

// معالج التفاعلات والأزرار
client.on(Events.InteractionCreate, async interaction => {
  const userId = interaction.user.id;
  const db = readData();
  const user = getUserData(userId);

  if (interaction.isStringSelectMenu() && interaction.customId === 'select_market_buy') {
    const assetKey = interaction.values[0].replace('buy_', '');
    const asset = MARKET_ASSETS[assetKey];

    if (!asset) {
      await interaction.reply({ content: '❌ الأصل غير موجود!', ephemeral: true });
      return;
    }

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
    return;
  }

  if (!interaction.isButton()) return;

  try {
    switch (interaction.customId) {
      case 'btn_account':
        await interaction.reply({
          content: `💳 **حسابك الشخصي:**\n• 💰 النقدي: **${user.balance.toLocaleString()}$**\n• 🏦 البنك: **${user.bank.toLocaleString()}$**`,
          ephemeral: true
        });
        break;

      case 'btn_daily': {
        const today = new Date().toDateString();
        if (user.dailyLast === today) {
          await interaction.reply({ content: '⏳ لقد استلمت مكافأتك اليومية بالفعل اليوم!', ephemeral: true });
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
        await interaction.reply({ content: `🎁 مكافأتك اليومية: **${amount.toLocaleString()}$** (ستريك: ${user.dailyStreak} أيام 🔥)`, ephemeral: true });
        break;
      }

      case 'btn_claim_income': {
        const now = Date.now();
        const last = user.lastClaimedIncome || now;
        const hours = (now - last) / (1000 * 60 * 60);
        const b = user.businesses || {};
        const hourlyIncome = ((b.cafe || 0) * 100) + ((b.gas || 0) * 350) + ((b.tech || 0) * 1200) + ((b.factory || 0) * 3000) + ((b.realestate || 0) * 8000);

        if (hourlyIncome === 0) {
          await interaction.reply({ content: '❌ لا تملك مشاريع لجمع أرباحها حالياً!', ephemeral: true });
          return;
        }

        const totalIncome = Math.floor(hourlyIncome * hours);
        if (totalIncome <= 0) {
          await interaction.reply({ content: '⏳ لم تتراكم أرباح كافية بعد، انتظر القليل من الوقت!', ephemeral: true });
          return;
        }

        user.balance += totalIncome;
        user.lastClaimedIncome = now;
        db.users[userId] = user;
        saveData(db);
        await interaction.reply({ content: `💵 **تم جمع أرباح مشاريعك بنجاح:** **${totalIncome.toLocaleString()}$**! 💰`, ephemeral: true });
        break;
      }

      case 'btn_businesses': {
        const b = user.businesses || {};
        await interaction.reply({
          content: `🏢 **مشاريعك المملوكة حالياً:**\n• مقهى ☕: **${b.cafe || 0}**\n• محطة بنزين ⛽: **${b.gas || 0}**\n• شركة تكنولوجيا 💻: **${b.tech || 0}**\n• مصنع سيارات 🏭: **${b.factory || 0}**\n• شركة عقارات 🏙️: **${b.realestate || 0}**\n\nلشراء المزيد اكتب: \`!مشاريع\``,
          ephemeral: true
        });
        break;
      }

      case 'btn_market':
        await interaction.reply({ content: '📊 لعرض السوق والشراء التفاعلي اكتب: `!سوق`', ephemeral: true });
        break;

      case 'btn_games':
        await interaction.reply({ content: '🎰 الألعاب المتاحة حالياً: `!سلوتس [المبلغ]`', ephemeral: true });
        break;

      default:
        await interaction.reply({ content: '✅ تم الإجراء بنجاح!', ephemeral: true });
        break;
    }
  } catch (err) {
    console.error('Interaction Error:', err);
  }
});

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('❌ خطأ: لم يتم العثور على توكن البوت في متغيرات البيئة (DISCORD_TOKEN)!');
  process.exit(1);
}

client.login(token);
