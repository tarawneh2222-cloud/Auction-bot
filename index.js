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

// خادم الويب لمراقبة التشغيل (Render / UptimeRobot)
const web = express();
web.get('/', (_req, res) => res.status(200).send('✅ البوت يعمل بنجاح تام'));
web.get('/health', (_req, res) => res.json({ ok: true }));
web.listen(Number(process.env.PORT) || 3000, '0.0.0.0');

const DATA_PATH = path.join(__dirname, 'data.json');

// المشاريع الاستثمارية
const BUSINESSES = {
  cafe: { name: 'مقهى ☕', cost: 5000, incomePerHour: 100 },
  gas: { name: 'محطة بنزين ⛽', cost: 15000, incomePerHour: 350 },
  tech: { name: 'شركة تكنولوجيا 💻', cost: 50000, incomePerHour: 1200 },
  factory: { name: 'مصنع سيارات 🏭', cost: 120000, incomePerHour: 3000 },
  realestate: { name: 'شركة عقارات 🏙️', cost: 300000, incomePerHour: 8000 }
};

// الحيوانات الأليفة
const PETS = {
  dog: { name: 'كلب 🐶', cost: 2000, minFind: 100, maxFind: 500 },
  cat: { name: 'قطة 🐱', cost: 1500, minFind: 80, maxFind: 400 },
  dragon: { name: 'تنين أسطوري 🐲', cost: 20000, minFind: 1000, maxFind: 4000 }
};

// متجر الرتب
const SHOP_ROLES = {
  'VIP': 10000,
  'تاجر': 25000,
  'مليونير': 100000
};

// أسعار البورصة المتناسبة والموزونة
const DEFAULT_MARKET_ASSETS = {
  phones: { name: 'هواتف 📱', price: 1200, trend: '📉' },
  cars: { name: 'سيارات 🚗', price: 15000, trend: '📉' },
  stocks: { name: 'أسهم 📊', price: 25000, trend: '📈' },
  lands: { name: 'أراضي 🏙️', price: 60000, trend: '📉' },
  trains: { name: 'قطارات 🚆', price: 120000, trend: '📉' },
  planes: { name: 'طائرات ✈️', price: 250000, trend: '🔄' },
  stadiums: { name: 'ملاعب 🏟️', price: 500000, trend: '🟢' },
  yachts: { name: 'يخوت 🛥️', price: 750000, trend: '🟢' },
  hotels: { name: 'فنادق 🏨', price: 1200000, trend: '📈' },
  diamonds: { name: 'مجوهرات 💎', price: 300000, trend: '📈' }
};

const pendingMarriages = new Map();

function initData() {
  if (!fs.existsSync(DATA_PATH)) {
    fs.writeFileSync(DATA_PATH, JSON.stringify({
      users: {},
      lottery: { pool: 1000, tickets: [] },
      market: { assets: DEFAULT_MARKET_ASSETS, lastUpdate: Date.now() }
    }, null, 2));
  }
}

function readData() {
  initData();
  try {
    const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    if (!data.users) data.users = {};
    if (!data.lottery) data.lottery = { pool: 1000, tickets: [] };
    if (!data.market || !data.market.assets) {
      data.market = { assets: DEFAULT_MARKET_ASSETS, lastUpdate: Date.now() };
    }
    return data;
  } catch (err) {
    return {
      users: {},
      lottery: { pool: 1000, tickets: [] },
      market: { assets: DEFAULT_MARKET_ASSETS, lastUpdate: Date.now() }
    };
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

function getUserData(userId) {
  const data = readData();
  if (!data.users[userId]) {
    data.users[userId] = {
      balance: 1000,
      bank: 0,
      assets: { phones: 0, cars: 0, stocks: 0, lands: 0, trains: 0, planes: 0, stadiums: 0, yachts: 0, hotels: 0, diamonds: 0 },
      dailyLast: '',
      dailyStreak: 0,
      shieldUntil: 0,
      lastRob: 0,
      businesses: { cafe: 0, gas: 0, tech: 0, factory: 0, realestate: 0 },
      lastClaimedIncome: Date.now(),
      lootboxes: 0,
      pet: null,
      lastPetHunt: 0,
      spouse: null,
      sharedVault: 0,
      achievements: []
    };
  }
  return data.users[userId];
}

function checkAchievements(userId, user) {
  if (!user.achievements) user.achievements = [];
  const rewards = [];

  if ((user.balance + user.bank) >= 100000 && !user.achievements.includes('rich_100k')) {
    user.achievements.push('rich_100k');
    user.balance += 5000;
    rewards.push('🏆 **أول 100,000$**: ربحت جائزة 5,000$!');
  }

  const totalBiz = Object.values(user.businesses || {}).reduce((a, b) => a + b, 0);
  if (totalBiz >= 3 && !user.achievements.includes('biz_owner')) {
    user.achievements.push('biz_owner');
    user.balance += 3000;
    rewards.push('🏢 **رائد أعمال**: تمتلك 3 مشاريع أو أكثر! ربحت جائزة 3,000$!');
  }

  if (user.pet && !user.achievements.includes('has_pet')) {
    user.achievements.push('has_pet');
    user.balance += 1000;
    rewards.push('🐾 **صديق الحيوان**: قمت بتبني أول حيوان أليف! ربحت جائزة 1,000$!');
  }

  return rewards;
}

// تحديث أسعار السوق بشكل متناسب
function updateMarketPrices() {
  const data = readData();
  const now = Date.now();
  const lastUpdate = data.market.lastUpdate || 0;

  if (now - lastUpdate >= 20 * 60 * 1000) {
    for (const key in DEFAULT_MARKET_ASSETS) {
      if (!data.market.assets[key]) {
        data.market.assets[key] = { ...DEFAULT_MARKET_ASSETS[key] };
      }
      const currentPrice = data.market.assets[key].price;
      const changePercent = (Math.random() * 0.30) - 0.15; // تذبذب متوازن (-15% إلى +15%)
      let newPrice = Math.round(currentPrice * (1 + changePercent));
      if (newPrice < 500) newPrice = 500;

      let trend = '📉';
      if (newPrice > currentPrice) trend = '🟢';
      else if (newPrice === currentPrice) trend = '🔄';

      data.market.assets[key].price = newPrice;
      data.market.assets[key].trend = trend;
    }
    data.market.lastUpdate = now;
    saveData(data);
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

client.once(Events.ClientReady, () => {
  console.log(`✅ البوت المتطور ${client.user.tag} يعمل بكفاءة تامة!`);
  setInterval(updateMarketPrices, 5 * 60 * 1000);
});

// معالج الأوامر النصية
client.on(Events.MessageCreate, async message => {
  if (message.author.bot || !message.guild) return;
  const content = message.content.trim();
  const userId = message.author.id;

  updateMarketPrices();

  // 🏛️ القائمة الرئيسية الشاملة
  if (content === '!قائمة' || content === '!القائمة') {
    const embed = new EmbedBuilder()
      .setTitle('🏛️ المركز الاقتصادي والتداولي المتكامل')
      .setDescription('اختر القسم المطلوب من الأزرار التفاعلية أدناه:')
      .setColor('#2b90d9')
      .setFooter({ text: 'اقتصاد تفاعلي متكامل • استمتع بالخدمات والألعاب!' });

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('btn_account').setLabel('💳 حسابي').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('btn_daily').setLabel('🎁 اليومية').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('btn_claim_income').setLabel('💵 جمع الأرباح').setStyle(ButtonStyle.Success)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('btn_market').setLabel('📊 الأسواق والبورصة').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('btn_portfolio').setLabel('📈 محفظة الأصول').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('btn_businesses').setLabel('🏢 المشاريع').setStyle(ButtonStyle.Primary)
    );

    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('btn_games').setLabel('🎰 الألعاب').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('btn_pets').setLabel('🐾 الحيوانات').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('btn_leaderboard').setLabel('🏆 الترتيب').setStyle(ButtonStyle.Secondary)
    );

    await message.reply({ embeds: [embed], components: [row1, row2, row3] });
    return;
  }

  // 🦹‍♂️ نظام النهب والسرقة
  if (content.startsWith('!نهب') || content.startsWith('!سرقة')) {
    const target = message.mentions.users.first();
    if (!target || target.id === userId || target.bot) {
      await message.reply('❌ يرجى منشن الشخص المراد نهبه بشكل صحيح! مثال: `!نهب @الشخص`');
      return;
    }

    const data = readData();
    const user = getUserData(userId);
    const targetData = getUserData(target.id);
    const now = Date.now();
    const cooldown = 15 * 60 * 1000;

    if (now - (user.lastRob || 0) < cooldown) {
      const rem = Math.ceil((cooldown - (now - user.lastRob)) / 1000 / 60);
      await message.reply('⏳ أنت متعب ومطلوب أمنياً! انتظر **' + rem + ' دقيقة** قبل محاولة نهب أخرى.');
      return;
    }

    if (targetData.shieldUntil && targetData.shieldUntil > now) {
      user.lastRob = now;
      user.balance = Math.max(0, user.balance - 200);
      data.users[userId] = user;
      saveData(data);
      await message.reply('🛡️ هذا الشخص يمتلك **درع حماية نشط**! فشلت محاولة النهب وتم تغريمك 200$.');
      return;
    }

    if (targetData.balance < 200) {
      await message.reply('❌ هذا الشخص فقير جداً ولا يمتلك ما يكفي لسرقته!');
      return;
    }

    user.lastRob = now;
    const success = Math.random() < 0.45;

    if (success) {
      const stolen = Math.floor(Math.random() * (targetData.balance * 0.25)) + 50;
      targetData.balance -= stolen;
      user.balance += stolen;
      data.users[userId] = user;
      data.users[target.id] = targetData;
      saveData(data);
      await message.reply('🦹‍♂️ **نجحت عملية النهب باحتراف!** سرقت **' + stolen.toLocaleString() + '$** نقداً من <@' + target.id + '> 💰🔥');
    } else {
      const fine = 300;
      user.balance = Math.max(0, user.balance - fine);
      data.users[userId] = user;
      saveData(data);
      await message.reply('🚨 **فشلت عملية النهب!** ألقت الشرطة القبض عليك وغرمتك **' + fine + '$** 👮‍♂️❌');
    }
    return;
  }

  // 📊 عرض السوق مع قائمة الشراء التفاعلية السريعة
  if (content === '!سوق') {
    const data = readData();
    const assets = data.market.assets;

    const embed = new EmbedBuilder()
      .setTitle('📈 الأسعار الحالية في البورصة')
      .setDescription('اختر الأصل المراد شاؤه مباشرة من قائمة الاختيار أدناه لتسهيل العملية! 🛒')
      .setColor('#2b90d9');

    const selectOptions = [];

    for (const key in assets) {
      const a = assets[key];
      embed.addFields({
        name: a.name + ' (`' + key + '`)',
        value: a.trend + ' **' + a.price.toLocaleString() + ' $**',
        inline: true
      });

      selectOptions.push(
        new StringSelectMenuOptionBuilder()
          .setLabel(a.name + ' — ' + a.price.toLocaleString() + '$')
          .setValue('buy_' + key)
          .setDescription('شراء 1 من ' + a.name)
      );
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select_buy_asset')
      .setPlaceholder('🛒 اختر أصلاً لشرائه مباشرة...')
      .addOptions(selectOptions.slice(0, 25));

    const rowSelect = new ActionRowBuilder().addComponents(selectMenu);

    await message.reply({ embeds: [embed], components: [rowSelect] });
    return;
  }

  // 📜 قائمة المساعدة
  if (content === '!مساعدة' || content === '!اوامر') {
    const embed = new EmbedBuilder()
      .setTitle('📜 قائمة الأوامر الشاملة')
      .addFields(
        { name: '🦹‍♂️ النهب والسرقة', value: '`!نهب @الشخص` (نسبة نجاح 45% - يتطلب درع حماية)' },
        { name: '🎲 الألعاب والترفيه', value: '`!سلوتس [مبلغ]` | `!تخمين [1-10] [مبلغ]` | `!سباق [مبلغ]` | `!حجر`' },
        { name: '🐾 الحيوانات والزواج', value: '`!الحيوانات` | `!تبني [كلب/قطة/تنين]` | `!رحلة` | `!زواج @الشخص` | `!قبول`' },
        { name: '🛒 المتجر والرتب', value: '`!متجر` | `!رتب` | `!اشتري_رتبة [اسم]` | `!اشتري حماية` | `!اشتري صندوق`' },
        { name: '💳 المال، الأسهم، والمشاريع', value: '`!حساب` | `!سوق` | `!مشاريع` | `!ارباح` | `!إيداع` | `!سحب` | `!تحويل`' }
      )
      .setColor('#2ecc71');
    await message.reply({ embeds: [embed] });
    return;
  }

  // 💳 حسابي
  if (content === '!حسابي' || content === '!حساب') {
    const data = readData();
    const user = getUserData(userId);
    const achievementsMsg = checkAchievements(userId, user);
    data.users[userId] = user;
    saveData(data);

    const sharedVaultVal = user.sharedVault || 0;
    const petName = user.pet && PETS[user.pet] ? PETS[user.pet].name : 'لا يوجد';
    const spouseMention = user.spouse ? '<@' + user.spouse + '>' : 'غير متزوج';
    const hasShield = user.shieldUntil && user.shieldUntil > Date.now();

    const embed = new EmbedBuilder()
      .setTitle('💳 حساب — ' + message.author.username)
      .addFields(
        { name: '💰 النقدي', value: user.balance.toLocaleString() + ' $', inline: true },
        { name: '🏦 في البنك', value: user.bank.toLocaleString() + ' $', inline: true },
        { name: '🛡️ حماية النهب', value: hasShield ? 'نشطة ✅' : 'غير نشطة ❌', inline: true },
        { name: '💍 الشريك', value: spouseMention, inline: true },
        { name: '🏦 الخزنة المشتركة', value: sharedVaultVal.toLocaleString() + ' $', inline: true },
        { name: '🐾 الحيوان الأليف', value: petName, inline: true },
        { name: '🔥 الستريك اليومي', value: (user.dailyStreak || 0) + ' أيام', inline: true }
      )
      .setColor('#3498db');

    if (achievementsMsg.length > 0) {
      embed.setDescription('🎉 **إنجازات جديدة تم تحقيقها!**\n' + achievementsMsg.join('\n'));
    }

    await message.reply({ embeds: [embed] });
    return;
  }

  // 🏦 الإيداع والسحب والتحويل
  if (content.startsWith('!إيداع')) {
    const data = readData();
    const user = getUserData(userId);
    const args = content.split(' ');
    let amount = args[1] === 'الكل' || args[1] === 'all' ? user.balance : parseInt(args[1]);

    if (isNaN(amount) || amount <= 0 || user.balance < amount) {
      await message.reply('❌ مبلغ غير صحيح أو رصيدك لا يكفي!');
      return;
    }
    user.balance -= amount;
    user.bank += amount;
    data.users[userId] = user;
    saveData(data);
    await message.reply('✅ تم إيداع **' + amount.toLocaleString() + '$** في البنك بنجاح! 🏦');
    return;
  }

  if (content.startsWith('!سحب')) {
    const data = readData();
    const user = getUserData(userId);
    const args = content.split(' ');
    let amount = args[1] === 'الكل' || args[1] === 'all' ? user.bank : parseInt(args[1]);

    if (isNaN(amount) || amount <= 0 || user.bank < amount) {
      await message.reply('❌ مبلغ غير صحيح أو رصيدك بالبنك لا يكفي!');
      return;
    }
    user.bank -= amount;
    user.balance += amount;
    data.users[userId] = user;
    saveData(data);
    await message.reply('✅ تم سحب **' + amount.toLocaleString() + '$** إلى محفظتك النقدية! 💰');
    return;
  }

  if (content.startsWith('!تحويل')) {
    const target = message.mentions.users.first();
    const args = content.split(' ');
    const amount = parseInt(args[2]);

    if (!target || target.id === userId || target.bot || isNaN(amount) || amount <= 0) {
      await message.reply('❌ طريقة الاستخدام: `!تحويل @الشخص 500`');
      return;
    }

    const data = readData();
    const user = getUserData(userId);
    const targetData = getUserData(target.id);

    if (user.balance < amount) {
      await message.reply('❌ لا تملك هذا المبلغ نقداً!');
      return;
    }

    user.balance -= amount;
    targetData.balance += amount;
    data.users[userId] = user;
    data.users[target.id] = targetData;
    saveData(data);

    await message.reply('✅ تم تحويل **' + amount.toLocaleString() + '$** بنجاح إلى <@' + target.id + '>! 💸');
    return;
  }

  // 🛒 المتجر
  if (content === '!متجر') {
    const embed = new EmbedBuilder()
      .setTitle('🛒 المتجر العام')
      .addFields(
        { name: '🛡️ درع حماية (24 ساعة)', value: 'السعر: **1,000$** → `!اشتري حماية`', inline: false },
        { name: '🎁 صندوق حظ', value: 'السعر: **500$** → `!اشتري صندوق` ثم `!افتتح_صندوق`', inline: false },
        { name: '👑 الرتب الشرفية', value: 'اكتب `!رتب` لعرض رتب السيرفر المتاحة للشراء', inline: false }
      )
      .setColor('#e67e22');
    await message.reply({ embeds: [embed] });
    return;
  }

  if (content === '!اشتري حماية' || content === '!شراء حماية') {
    const data = readData();
    const user = getUserData(userId);
    const cost = 1000;
    if (user.balance < cost) return message.reply('❌ درع الحماية يكلف 1,000$!');
    user.balance -= cost;
    user.shieldUntil = Date.now() + (24 * 60 * 60 * 1000);
    data.users[userId] = user;
    saveData(data);
    await message.reply('🛡️ **تم تفعيل درع الحماية بنجاح!** أنت محمي من النهب لمدة 24 ساعة.');
    return;
  }

  if (content === '!اشتري صندوق' || content === '!شراء صندوق') {
    const data = readData();
    const user = getUserData(userId);
    const cost = 500;
    if (user.balance < cost) return message.reply('❌ سعر الصندوق 500$!');
    user.balance -= cost;
    user.lootboxes = (user.lootboxes || 0) + 1;
    data.users[userId] = user;
    saveData(data);
    await message.reply('🎁 **تم شراء صندوق حظ!** افتحه بكتابة `!افتتح_صندوق`.');
    return;
  }

  if (content === '!افتتح_صندوق' || content === '!فتح_صندوق') {
    const data = readData();
    const user = getUserData(userId);
    if (!user.lootboxes || user.lootboxes <= 0) return message.reply('❌ لا تملك صناديق! اشترِ واحداً بـ 500$.');
    user.lootboxes -= 1;
    const prizes = [100, 300, 600, 1000, 2500, 5000];
    const prize = prizes[Math.floor(Math.random() * prizes.length)];
    user.balance += prize;
    data.users[userId] = user;
    saveData(data);
    await message.reply('🎉 **فتحت صندوق الحظ وربحت:** **' + prize.toLocaleString() + '$**! 💰✨');
    return;
  }

  // 🏷️ الرتب
  if (content === '!رتب' || content === '!الرتب') {
    const embed = new EmbedBuilder()
      .setTitle('🏷️ متجر الرتب الشرفية')
      .addFields(
        { name: '👑 VIP', value: 'السعر: **10,000$** → `!اشتري_رتبة VIP`', inline: false },
        { name: '💼 تاجر', value: 'السعر: **25,000$** → `!اشتري_رتبة تاجر`', inline: false },
        { name: '💎 مليونير', value: 'السعر: **100,000$** → `!اشتري_رتبة مليونير`', inline: false }
      )
      .setColor('#f1c40f');
    await message.reply({ embeds: [embed] });
    return;
  }

  if (content.startsWith('!اشتري_رتبة')) {
    const roleName = content.split(' ')[1];
    if (!SHOP_ROLES[roleName]) return message.reply('❌ اسم الرتبة غير صحيح! اكتب `!رتب`.');
    const data = readData();
    const user = getUserData(userId);
    const price = SHOP_ROLES[roleName];
    if (user.balance < price) return message.reply('❌ رصيدك لا يكفي لشراء رتبة ' + roleName + '!');
    const role = message.guild.roles.cache.find(r => r.name === roleName);
    if (!role) return message.reply('⚠️ لم أجد رتبة باسم **' + roleName + '** في السيرفر! أنشئها أولاً.');
    user.balance -= price;
    data.users[userId] = user;
    saveData(data);
    try {
      await message.member.roles.add(role);
      await message.reply('👑 **مبروك!** تم شراء رتبة **' + roleName + '** بنجاح!');
    } catch (err) {
      await message.reply('❌ حدث خطأ، تأكد أن رتبة البوت أعلى من الرتبة المراد منحها.');
    }
    return;
  }

  // 🎁 اليومية
  if (content === '!يومية' || content === '!يومي') {
    const data = readData();
    const user = getUserData(userId);
    const today = new Date().toDateString();
    if (user.dailyLast === today) return message.reply('⏳ حصلت على مكافأتك اليومية بالفعل!');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (user.dailyLast === yesterday.toDateString()) {
      user.dailyStreak = (user.dailyStreak || 0) + 1;
    } else {
      user.dailyStreak = 1;
    }
    const totalAmount = 250 + ((user.dailyStreak - 1) * 50);
    user.balance += totalAmount;
    user.dailyLast = today;
    data.users[userId] = user;
    saveData(data);
    await message.reply('🎁 **مكافأتك اليومية:** **' + totalAmount.toLocaleString() + '$** (ستريك ' + user.dailyStreak + ' أيام 🔥)');
    return;
  }

  // 🎰 سلوتس والألعاب
  if (content.startsWith('!سلوتس') || content.startsWith('!slots')) {
    const bet = parseInt(content.split(' ')[1]);
    if (isNaN(bet) || bet <= 0) return message.reply('❌ حدد مبلغ الرهان: `!سلوتس 100`');
    const data = readData();
    const user = getUserData(userId);
    if (user.balance < bet) return message.reply('❌ رصيدك لا يكفي للرهان!');
    user.balance -= bet;
    const symbols = ['🍒', '💎', '🍋', '🔔'];
    const r1 = symbols[Math.floor(Math.random() * symbols.length)];
    const r2 = symbols[Math.floor(Math.random() * symbols.length)];
    const r3 = symbols[Math.floor(Math.random() * symbols.length)];

    let winMsg = '';
    if (r1 === r2 && r2 === r3) {
      const prize = bet * 10;
      user.balance += prize;
      winMsg = '🎉 **جائزة كبرى 10x!** ربحت **' + prize.toLocaleString() + '$**!';
    } else if (r1 === r2 || r2 === r3 || r1 === r3) {
      const prize = bet * 2;
      user.balance += prize;
      winMsg = '✨ **تطابق 2x!** ربحت **' + prize.toLocaleString() + '$**!';
    } else {
      winMsg = '😢 **خسرت الرهان!** حظاً أوفر.';
    }
    data.users[userId] = user;
    saveData(data);
    await message.reply('🎰 **[ ' + r1 + ' | ' + r2 + ' | ' + r3 + ' ]**\n\n' + winMsg);
    return;
  }

  if (content.startsWith('!تخمين')) {
    const args = content.split(' ');
    const guess = parseInt(args[1]);
    const bet = parseInt(args[2]);
    if (isNaN(guess) || guess < 1 || guess > 10 || isNaN(bet) || bet <= 0) {
      return message.reply('❌ الاستخدام الصحيح: `!تخمين [1-10] [المبلغ]`');
    }
    const data = readData();
    const user = getUserData(userId);
    if (user.balance < bet) return message.reply('❌ رصيدك لا يكفي!');
    user.balance -= bet;
    const winningNumber = Math.floor(Math.random() * 10) + 1;
    if (guess === winningNumber) {
      const prize = bet * 8;
      user.balance += prize;
      data.users[userId] = user;
      saveData(data);
      await message.reply('🎯 **أصبت الرقم الصحيح (' + winningNumber + ')!** ربحت **' + prize.toLocaleString() + '$**!');
    } else {
      data.users[userId] = user;
      saveData(data);
      await message.reply('❌ **خمنت الرقم ' + guess + '** وكان الرقم الصحيح هو **' + winningNumber + '**. خست الرهان.');
    }
    return;
  }

  if (content.startsWith('!سباق')) {
    const bet = parseInt(content.split(' ')[1]);
    if (isNaN(bet) || bet <= 0) return message.reply('❌ الاستخدام: `!سباق [المبلغ]`');
    const data = readData();
    const user = getUserData(userId);
    if (user.balance < bet) return message.reply('❌ رصيدك لا يكفي!');
    user.balance -= bet;
    const cars = ['🏎️ الفيراري', '🚙 الجيب', '🚗 السريعة'];
    const winner = cars[Math.floor(Math.random() * cars.length)];
    const myCar = cars[Math.floor(Math.random() * cars.length)];
    if (myCar === winner) {
      const prize = bet * 3;
      user.balance += prize;
      data.users[userId] = user;
      saveData(data);
      await message.reply('🏁 سيارتك (' + myCar + ') فازت بالمركز الأول! 🏆 ربحت **' + prize.toLocaleString() + '$**!');
    } else {
      data.users[userId] = user;
      saveData(data);
      await message.reply('🏁 فازت السيارة (' + winner + ') وسياراتك (' + myCar + ') خسرت الرهان.');
    }
    return;
  }

  if (content === '!حجر' || content === '!نرد') {
    const r1 = Math.floor(Math.random() * 6) + 1;
    const r2 = Math.floor(Math.random() * 6) + 1;
    await message.reply('🎲 نتائج النرد: **' + r1 + '** و **' + r2 + '** (المجموع: **' + (r1 + r2) + '**)');
    return;
  }

  // 🐾 الحيوانات
  if (content === '!الحيوانات' || content === '!حيوانات') {
    const embed = new EmbedBuilder()
      .setTitle('🐾 متجر الحيوانات الأليفة')
      .addFields(
        { name: '🐶 كلب (2,000$)', value: 'يجد: 100$-500$ | `!تبني كلب`', inline: false },
        { name: '🐱 قطة (1,500$)', value: 'تجد: 80$-400$ | `!تبني قطة`', inline: false },
        { name: '🐲 تنين أسطوري (20,000$)', value: 'يجلب: 1000$-4000$ | `!تبني تنين`', inline: false }
      )
      .setColor('#e67e22');
    await message.reply({ embeds: [embed] });
    return;
  }

  if (content.startsWith('!تبني')) {
    const petType = content.split(' ')[1] ? content.split(' ')[1].toLowerCase() : '';
    const pKey = { 'كلب': 'dog', 'قطة': 'cat', 'تنين': 'dragon', 'dog': 'dog', 'cat': 'cat', 'dragon': 'dragon' }[petType];
    if (!pKey) return message.reply('❌ اختر حيواناً صحيحاً: كلب، قطة، تنين.');
    const data = readData();
    const user = getUserData(userId);
    const petObj = PETS[pKey];
    if (user.balance < petObj.cost) return message.reply('❌ تكلفته ' + petObj.cost.toLocaleString() + '$!');
    user.balance -= petObj.cost;
    user.pet = pKey;
    checkAchievements(userId, user);
    data.users[userId] = user;
    saveData(data);
    await message.reply('🐾 تبنيت **' + petObj.name + '** بنجاح! استخدم `!رحلة` لجلب الكنوز.');
    return;
  }

  if (content === '!رحلة' || content === '!رحلة_كنز') {
    const data = readData();
    const user = getUserData(userId);
    if (!user.pet) return message.reply('❌ لا تملك حيواناً أليفاً!');
    const now = Date.now();
    const cooldown = 2 * 60 * 60 * 1000;
    if (now - (user.lastPetHunt || 0) < cooldown) {
      const rem = Math.ceil((cooldown - (now - user.lastPetHunt)) / 1000 / 60);
      return message.reply('⏳ حيوانك متعب! انتظر **' + rem + ' دقيقة**.');
    }
    const petObj = PETS[user.pet];
    const found = Math.floor(Math.random() * (petObj.maxFind - petObj.minFind + 1)) + petObj.minFind;
    user.balance += found;
    user.lastPetHunt = now;
    data.users[userId] = user;
    saveData(data);
    await message.reply('🗺️ عاد **' + petObj.name + '** من رحلته ومعه **' + found.toLocaleString() + '$**! 💰');
    return;
  }

  // 💍 الزواج
  if (content.startsWith('!زواج')) {
    const target = message.mentions.users.first();
    if (!target || target.id === userId || target.bot) return message.reply('❌ منشن الشخص المطلوب: `!زواج @الشخص`');
    const user = getUserData(userId);
    const targetData = getUserData(target.id);
    if (user.spouse) return message.reply('❌ أنت متزوج بالفعل!');
    if (targetData.spouse) return message.reply('❌ الشخص المستهدف متزوج!');
    pendingMarriages.set(target.id, userId);
    await message.reply('💍 <@' + target.id + '>، طلب <@' + userId + '> الزواج منك! اكتب `!قبول` للموافقة.');
    return;
  }

  if (content === '!قبول' || content === '!موافقة') {
    const proposerId = pendingMarriages.get(userId);
    if (!proposerId) return message.reply('❌ لا توجد طلبات زواج معلقة!');
    const data = readData();
    const user = getUserData(userId);
    const proposerData = getUserData(proposerId);
    user.spouse = proposerId;
    proposerData.spouse = userId;
    pendingMarriages.delete(userId);
    data.users[userId] = user;
    data.users[proposerId] = proposerData;
    saveData(data);
    await message.reply('🎉 مبروك الزواج وفتح الخزنة المشتركة بين <@' + userId + '> و <@' + proposerId + '>!');
    return;
  }

  // 🏢 المشاريع والشراء
  if (content === '!مشاريع') {
    const user = getUserData(userId);
    const b = user.businesses || {};
    const embed = new EmbedBuilder()
      .setTitle('🏢 المشاريع الاستثمارية')
      .addFields(
        { name: '☕ مقهى (5,000$)', value: 'المملوك: ' + (b.cafe || 0) + ' | يدرّ 100$/ساعة\n`!شراء_مشروع مقهى`', inline: false },
        { name: '⛽ محطة بنزين (15,000$)', value: 'المملوك: ' + (b.gas || 0) + ' | يدرّ 350$/ساعة\n`!شراء_مشروع بنزين`', inline: false },
        { name: '💻 شركة تكنولوجيا (50,000$)', value: 'المملوك: ' + (b.tech || 0) + ' | يدرّ 1200$/ساعة\n`!شراء_مشروع تكنولوجيا`', inline: false },
        { name: '🏭 مصنع سيارات (120,000$)', value: 'المملوك: ' + (b.factory || 0) + ' | يدرّ 3000$/ساعة\n`!شراء_مشروع مصنع`', inline: false },
        { name: '🏙️ شركة عقارات (300,000$)', value: 'المملوك: ' + (b.realestate || 0) + ' | يدرّ 8000$/ساعة\n`!شراء_مشروع عقارات`', inline: false }
      )
      .setColor('#8e44ad');
    await message.reply({ embeds: [embed] });
    return;
  }

  if (content.startsWith('!شراء_مشروع')) {
    const type = content.split(' ')[1] ? content.split(' ')[1].toLowerCase() : '';
    const pKey = { 'مقهى': 'cafe', 'بنزين': 'gas', 'تكنولوجيا': 'tech', 'مصنع': 'factory', 'عقارات': 'realestate' }[type];
    if (!pKey) return message.reply('❌ اختر مشروعاً صحيحاً (مقهى، بنزين، تكنولوجيا، مصنع، عقارات)!');

    const data = readData();
    const user = getUserData(userId);
    const proj = BUSINESSES[pKey];
    if (user.balance < proj.cost) return message.reply('❌ رصيدك لا يكفي! يكلف **' + proj.cost.toLocaleString() + '$**.');

    user.balance -= proj.cost;
    if (!user.businesses) user.businesses = {};
    user.businesses[pKey] = (user.businesses[pKey] || 0) + 1;
    data.users[userId] = user;
    saveData(data);
    await message.reply('🏢 اشتريت **' + proj.name + '** بنجاح!');
    return;
  }

  if (content === '!ارباح' || content === '!أرباح') {
    const data = readData();
    const user = getUserData(userId);
    const now = Date.now();
    const last = user.lastClaimedIncome || now;
    const hours = (now - last) / (1000 * 60 * 60);

    if (hours < 0.05) return message.reply('⏳ لم تتراكم أرباح كافية بعد!');

    const b = user.businesses || {};
    const hourly = (b.cafe * 100) + (b.gas * 350) + (b.tech * 1200) + (b.factory * 3000) + (b.realestate * 8000);
    if (hourly === 0) return message.reply('❌ لا تملك أي مشاريع لجمع أرباحها!');

    const total = Math.floor(hourly * hours);
    user.balance += total;
    user.lastClaimedIncome = now;
    data.users[userId] = user;
    saveData(data);
    await message.reply('💵 جمعت أرباح مشاريعك بقيمة **' + total.toLocaleString() + '$**!');
    return;
  }

  if (content === '!ترتيب' || content === '!الترتيب') {
    const data = readData();
    const users = Object.entries(data.users)
      .map(([id, u]) => ({ id, total: (u.balance || 0) + (u.bank || 0) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    let desc = '';
    users.forEach((u, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '#' + (i + 1);
      desc += medal + ' <@' + u.id + '> — **' + u.total.toLocaleString() + '** $\n'; }); const embed = new EmbedBuilder().setTitle('🏆 أغنى اللاعبين').setDescription(desc \vert{}\vert{} 'لا توجد بيانات').setColor('#f1c40f'); await message.reply({ embeds: [embed] }); return; } });  // 🔘 معالج الأزرار والقوائم التفاعلية المباشرة client.on(Events.InteractionCreate, async interaction => { const userId = interaction.user.id; const data = readData(); const user = getUserData(userId);    // معالجة القائمة المنسدلة لشراء الأصول if (interaction.isStringSelectMenu() && interaction.customId === 'select_buy_asset') { const selected = interaction.values[0]; const key = selected.replace('buy_', '');      if (!data.market.assets[key]) { await interaction.reply({ content: '❌ حدث خطأ، لم يتم العثور على الأصل!', ephemeral: true }); return; }      const asset = data.market.assets[key];      if (user.balance < asset.price) { await interaction.reply({ content: '❌ رصيدك النقدي الحالي (**' + user.balance.toLocaleString() + '$**) لا يكفي لشراء **' + asset.name + '** (' + asset.price.toLocaleString() + '$)!',
        ephemeral: true
      });
      return;
    }

    user.balance -= asset.price;
    if (!user.assets) user.assets = {};
    user.assets[key] = (user.assets[key] || 0) + 1;

    data.users[userId] = user;
    saveData(data);

    await interaction.reply({
      content: '✅ **تمت عملية الشراء بنجاح بنقرة زر!** 🎉\nاشتريت **1 من ' + asset.name + '** بسعر **' + asset.price.toLocaleString() + '$**.',
      ephemeral: true
    });
    return;
  }

  if (!interaction.isButton()) return;

  try {
    switch (interaction.customId) {
      case 'btn_account':
        await interaction.reply({
          content: '💳 **حسابك الشخصي:**\n• 💰 النقدي: **' + user.balance.toLocaleString() + '$**\n• 🏦 البنك: **' + user.bank.toLocaleString() + '$**\n• 🛡️ الحماية: **' + (user.shieldUntil > Date.now() ? 'نشطة ✅' : 'غير نشطة ❌') + '**',
          ephemeral: true
        });
        break;

      case 'btn_daily': {
        const today = new Date().toDateString();
        if (user.dailyLast === today) {
          await interaction.reply({ content: '⏳ استلمت مكافأتك اليومية مسبقاً اليوم!', ephemeral: true });
          return;
        }
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        user.dailyStreak = (user.dailyLast === yesterday.toDateString()) ? (user.dailyStreak || 0) + 1 : 1;
        const totalAmount = 250 + ((user.dailyStreak - 1) * 50);
        user.balance += totalAmount;
        user.dailyLast = today;
        data.users[userId] = user;
        saveData(data);
        await interaction.reply({ content: '🎁 مكافأتك اليومية: **' + totalAmount.toLocaleString() + '$** (ستريك ' + user.dailyStreak + ' أيام 🔥)', ephemeral: true });
        break;
      }

      case 'btn_claim_income': {
        const now = Date.now();
        const last = user.lastClaimedIncome || now;
        const hours = (now - last) / (1000 * 60 * 60);
        const b = user.businesses || {};
        const hourly = ((b.cafe || 0) * 100) + ((b.gas || 0) * 350) + ((b.tech || 0) * 1200) + ((b.factory || 0) * 3000) + ((b.realestate || 0) * 8000);

        if (hourly === 0) {
          await interaction.reply({ content: '❌ لا تملك مشاريع لجمع أرباحها!', ephemeral: true });
          return;
        }
        const total = Math.floor(hourly * hours);
        user.balance += total;
        user.lastClaimedIncome = now;
        data.users[userId] = user;
        saveData(data);
        await interaction.reply({ content: '💵 جمعت أرباح مشاريعك بقيمة **' + total.toLocaleString() + '$**!', ephemeral: true });
        break;
      }

      case 'btn_businesses': {
        const b = user.businesses || {};
        await interaction.reply({
          content: '🏢 **مشاريعك الحالية:**\n• مقاهي ☕: ' + (b.cafe || 0) + '\n• محطات بنزين ⛽: ' + (b.gas || 0) + '\n• تكنولوجيا 💻: ' + (b.tech || 0) + '\n• مصانع 🏭: ' + (b.factory || 0) + '\n• عقارات 🏙️: ' + (b.realestate || 0) + '\n\nلشراء مشاريع اكتب: `!مشاريع` ولجمع الأرباح `!ارباح`',
          ephemeral: true
        });
        break;
      }

      case 'btn_market': {
        const assets = data.market.assets;
        let txt = '📈 **الأسعار الحالية في البورصة:**\n\n';
        for (const k in assets) {
          txt += assets[k].name + ' (`' + k + '`): ' + assets[k].trend + ' **' + assets[k].price.toLocaleString() + '$**\n';
        }
        txt += '\nاكتب `!سوق` للشراء المباشر عبر القائمة التفاعلية!';
        await interaction.reply({ content: txt, ephemeral: true });
        break;
      }

      case 'btn_portfolio': {
        const ast = user.assets || {};
        let portTxt = '📈 **محفظة أصولك المملوكة:**\n';
        for (const k in ast) {
          if (ast[k] > 0 && data.market.assets[k]) {
            portTxt += '• ' + data.market.assets[k].name + ': **' + ast[k] + '**\n';
          }
        }
        if (portTxt === '📈 **محفظة أصولك المملوكة:**\n') portTxt += 'لا تملك أي أصول حالياً! تصفح `!سوق`.';
        await interaction.reply({ content: portTxt, ephemeral: true });
        break;
      }

      case 'btn_games':
        await interaction.reply({ content: '🎰 الألعاب: `!سلوتس [مبلغ]` | `!تخمين [1-10] [مبلغ]` | `!سباق [مبلغ]` | `!حجر`', ephemeral: true });
        break;

      case 'btn_pets':
        await interaction.reply({ content: '🐾 الحيوانات: `!الحيوانات` | `!تبني [كلب/قطة/تنين]` | `!رحلة`', ephemeral: true });
        break;

      case 'btn_leaderboard':
        await interaction.reply({ content: '🏆 لعرض ترتيب أغنى اللاعبين اكتب: `!ترتيب`', ephemeral: true });
        break;

      default:
        await interaction.reply({ content: '✅ تم تنفيذ الطلب بنجاح!', ephemeral: true });
        break;
    }
  } catch (err) {
    console.error('Interaction Error:', err);
  }
});

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('❌ توكن الديسكورد غير موجود!');
  process.exit(1);
}

client.login(token);
