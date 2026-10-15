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
  Events
} = require('discord.js');

// خادم الويب لمراقبة التشغيل (UptimeRobot / Render)
const web = express();
web.get('/', (_req, res) => res.status(200).send('✅ البوت يعمل بنجاح تام'));
web.get('/health', (_req, res) => res.json({ ok: true }));
web.listen(Number(process.env.PORT) || 3000, '0.0.0.0');

// مسار ملف البيانات
const DATA_PATH = path.join(__dirname, 'data.json');

// بيانات المشاريع الموسعة
const BUSINESSES = {
  cafe: { name: 'مقهى ☕', cost: 5000, incomePerHour: 100 },
  gas: { name: 'محطة بنزين ⛽', cost: 15000, incomePerHour: 350 },
  tech: { name: 'شركة تكنولوجيا 💻', cost: 50000, incomePerHour: 1200 },
  factory: { name: 'مصنع سيارات 🏭', cost: 120000, incomePerHour: 3000 },
  realestate: { name: 'شركة عقارات 🏙️', cost: 300000, incomePerHour: 8000 }
};

const PETS = {
  dog: { name: 'كلب 🐶', cost: 2000, minFind: 100, maxFind: 500 },
  cat: { name: 'قطة 🐱', cost: 1500, minFind: 80, maxFind: 400 },
  dragon: { name: 'تنين أسطوري 🐲', cost: 20000, minFind: 1000, maxFind: 4000 }
};

const SHOP_ROLES = {
  'VIP': 10000,
  'تاجر': 25000,
  'مليونير': 100000
};

const pendingMarriages = new Map();

function initData() {
  if (!fs.existsSync(DATA_PATH)) {
    fs.writeFileSync(DATA_PATH, JSON.stringify({
      users: {},
      auctions: [],
      missions: {},
      lottery: { pool: 1000, tickets: [] },
      market: { 
        prices: { gold: 100, oil: 50, wheat: 30, crypto: 200 }, 
        trends: { gold: '➖', oil: '➖', wheat: '➖', crypto: '➖' },
        lastUpdate: Date.now() 
      }
    }, null, 2));
  }
}

function readData() {
  initData();
  try {
    const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    if (!data.users) data.users = {};
    if (!data.lottery) data.lottery = { pool: 1000, tickets: [] };
    if (!data.market) data.market = {};
    if (!data.market.prices) data.market.prices = { gold: 100, oil: 50, wheat: 30, crypto: 200 };
    if (!data.market.trends) data.market.trends = { gold: '➖', oil: '➖', wheat: '➖', crypto: '➖' };
    if (!data.market.lastUpdate) data.market.lastUpdate = Date.now();
    return data;
  } catch (err) {
    return {
      users: {},
      lottery: { pool: 1000, tickets: [] },
      market: { 
        prices: { gold: 100, oil: 50, wheat: 30, crypto: 200 }, 
        trends: { gold: '➖', oil: '➖', wheat: '➖', crypto: '➖' },
        lastUpdate: Date.now() 
      }
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
      stocks: { gold: 0, oil: 0, wheat: 0, crypto: 0 },
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

function updateMarketPrices() {
  const data = readData();
  if (!data.market) data.market = {};
  if (!data.market.prices) data.market.prices = { gold: 100, oil: 50, wheat: 30, crypto: 200 };
  if (!data.market.trends) data.market.trends = {};
  
  const now = Date.now();
  const lastUpdate = data.market.lastUpdate ? data.market.lastUpdate : 0;
  if (now - lastUpdate >= 3600000) {
    ['gold', 'oil', 'wheat', 'crypto'].forEach(stock => {
      const currentPrice = data.market.prices[stock] ? data.market.prices[stock] : 100;
      const changePercent = (Math.random() * 0.40) - 0.20; // نسبة تغير بين -20% إلى +20%
      let newPrice = Math.round(currentPrice * (1 + changePercent));
      if (newPrice < 10) newPrice = 10;

      if (newPrice > currentPrice) {
        data.market.trends[stock] = '📈 ارتفاع';
      } else if (newPrice < currentPrice) {
        data.market.trends[stock] = '📉 انخفاض';
      } else {
        data.market.trends[stock] = '➖ استقرار';
      }

      data.market.prices[stock] = newPrice;
    });
    data.market.lastUpdate = now;
    saveData(data);
  }
}

// إنشاء عميل ديسكورد مع تفعيل الصلاحيات (Intents)
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

client.once(Events.ClientReady, () => {
  console.log(`✅ بوت الاقتصاد ${client.user.tag} يعمل بكفاءة تامة الآن!`);
  setInterval(updateMarketPrices, 10 * 60 * 1000);
});

// معالج الأوامر النصية
client.on(Events.MessageCreate, async message => {
  if (message.author.bot || !message.guild) return;
  
  const content = message.content.trim();
  const userId = message.author.id;

  updateMarketPrices();

  // 🏛️ القائمة الرئيسية والأزرار
  if (content === '!قائمة' || content === '!القائمة') {
    const embed = new EmbedBuilder()
      .setTitle('🏛️ المركز الاقتصادي والترفيهي المتكامل')
      .setDescription('اختر الخيار المراد من الأزرار التفاعلية أدناه:')
      .setColor('#2b90d9')
      .setFooter({ text: 'اقتصاد افتراضي متكامل • استمتع بالألعاب والمزايا!' });

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('account').setLabel('💳 حسابي').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('bank').setLabel('🏦 البنك').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('daily').setLabel('🎁 اليومية').setStyle(ButtonStyle.Success)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('portfolio').setLabel('📈 محفظتي').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('market').setLabel('📊 السوق').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('businesses').setLabel('🏢 المشاريع').setStyle(ButtonStyle.Primary)
    );

    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('pets').setLabel('🐾 الحيوانات').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('marriage').setLabel('💍 الزواج').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('games').setLabel('🎰 الكازينو').setStyle(ButtonStyle.Danger)
    );

    const row4 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('achievements').setLabel('📜 الإنجازات').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('leaderboard').setLabel('🏆 الترتيب').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('shop').setLabel('🛒 المتجر').setStyle(ButtonStyle.Success)
    );

    await message.reply({ embeds: [embed], components: [row1, row2, row3, row4] });
    return;
  }

  // 📜 المساعدة والأوامر
  if (content === '!مساعدة' || content === '!اوامر') {
    const embed = new EmbedBuilder()
      .setTitle('📜 قائمة الأوامر الشاملة')
      .addFields(
        { name: '🎲 الألعاب والترفيه الجديدة', value: '`!سلوتس [مبلغ]` | `!تخمين [1-10] [مبلغ]` | `!سباق [مبلغ]` | `!حجر`' },
        { name: '🦹‍♂️ نظام النهب والسرقة', value: '`!نهب @الشخص` (نسبة نجاح 45% - يتطلب درع حماية)' },
        { name: '🐾 الحيوانات والأزواج', value: '`!الحيوانات` | `!تبني [كلب/قطة/تنين]` | `!رحلة` | `!زواج @الشخص`' },
        { name: '🛒 المتجر والرتب', value: '`!متجر` | `!رتب` | `!اشتري_رتبة [اسم]` | `!اشتري حماية` | `!اشتري صندوق`' },
        { name: '💳 المال، الأسهم، والمشاريع', value: '`!حساب` | `!سوق` (بالمؤشرات) | `!مشاريع` | `!ارباح` | `!إيداع/سحب`' }
      )
      .setColor('#2ecc71');
    await message.reply({ embeds: [embed] });
    return;
  }

  // 🎲 ألعاب جديدة: تخمين الأرقام وسباق السيارات
  if (content.startsWith('!تخمين')) {
    const args = content.split(' ');
    const guess = parseInt(args[1]);
    const bet = parseInt(args[2]);

    if (isNaN(guess) || guess < 1 || guess > 10 || isNaN(bet) || bet <= 0) {
      await message.reply('❌ الاستخدام الصحيح: `!تخمين [الرقم من 1 إلى 10] [المبلغ]`');
      return;
    }

    const data = readData();
    const user = getUserData(userId);

    if (user.balance < bet) {
      await message.reply('❌ رصيدك النقدي لا يكفي لهذا الرهان!');
      return;
    }

    user.balance -= bet;
    const winningNumber = Math.floor(Math.random() * 10) + 1;

    if (guess === winningNumber) {
      const prize = bet * 8;
      user.balance += prize;
      data.users[userId] = user;
      saveData(data);
      await message.reply('🎯 **أصبت الرقم الصحيح! (' + winningNumber + ')** ربحت جائزة كبرى 8x وقدرها **' + prize + '$**! 💰🎉');
    } else {
      data.users[userId] = user;
      saveData(data);
      await message.reply('❌ **خمنت الرقم ' + guess + '** بينما الرقم الرابح كان **' + winningNumber + '**.\nحظاً أوفر في المرة القادمة!');
    }
    return;
  }

  if (content.startsWith('!سباق')) {
    const args = content.split(' ');
    const bet = parseInt(args[1]);

    if (isNaN(bet) || bet <= 0) {
      await message.reply('❌ الاستخدام الصحيح: `!سباق [المبلغ]`');
      return;
    }

    const data = readData();
    const user = getUserData(userId);

    if (user.balance < bet) {
      await message.reply('❌ رصيدك النقدي لا يكفي!');
      return;
    }

    user.balance -= bet;
    const cars = ['🏎️ الفيراري', '🚙 الجيب', '🚗 السريعة', '🏍️ الدراجة'];
    const winner = cars[Math.floor(Math.random() * cars.length)];
    const myCar = cars[Math.floor(Math.random() * cars.length)];

    if (myCar === winner) {
      const prize = bet * 3;
      user.balance += prize;
      data.users[userId] = user;
      saveData(data);
      await message.reply('🏁 سيارتك (' + myCar + ') فازت بالمركز الأول في السباق! 🏆 ربحت **' + prize + '$**!');
    } else {
      data.users[userId] = user;
      saveData(data);
      await message.reply('🏁 انتهى السباق! سيارتك المختارة (' + myCar + ') خسرت، بينما الفائزة كانت (' + winner + '). خسرت الرهان.');
    }
    return;
  }

  if (content === '!حجر' || content === '!نرد') {
    const r1 = Math.floor(Math.random() * 6) + 1;
    const r2 = Math.floor(Math.random() * 6) + 1;
    await message.reply('🎲 رميت حجري النرد وظهرت النتائج:\nالحجر الأول: **' + r1 + '** | الحجر الثاني: **' + r2 + '**\nالمجموع الكلي: **' + (r1 + r2) + '**');
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
      await message.reply('🦹‍♂️ **نجحت عملية النهب باحتراف!** سرقت **' + stolen + '$** نقداً من <@' + target.id + '> 💰🔥');
    } else {
      const fine = 300;
      user.balance = Math.max(0, user.balance - fine);
      data.users[userId] = user;
      saveData(data);
      await message.reply('🚨 **فشلت عملية النهب!** ألقت الشرطة القبض عليك وغرمتك **' + fine + '$** 👮‍♂️❌');
    }
    return;
  }

  // 💳 حسابي
  if (content === '!حسابي' || content === '!حساب') {
    const data = readData();
    const user = getUserData(userId);
    const achievementsMsg = checkAchievements(userId, user);
    data.users[userId] = user;
    saveData(data);

    const sharedVaultVal = user.sharedVault ? user.sharedVault : 0;
    const dailyStreakVal = user.dailyStreak ? user.dailyStreak : 0;
    const petName = user.pet && PETS[user.pet] ? PETS[user.pet].name : 'لا يوجد';
    const spouseMention = user.spouse ? '<@' + user.spouse + '>' : 'غير متزوج';
    const hasShield = user.shieldUntil && user.shieldUntil > Date.now();

    const embed = new EmbedBuilder()
      .setTitle('💳 حساب — ' + message.author.username)
      .addFields(
        { name: '💰 النقدي', value: user.balance + ' $', inline: true },
        { name: '🏦 في البنك', value: user.bank + ' $', inline: true },
        { name: '🛡️ حماية النهب', value: hasShield ? 'نشطة ✅' : 'غير نشطة ❌', inline: true },
        { name: '💍 الشريك', value: spouseMention, inline: true },
        { name: '🏦 الخزنة المشتركة', value: sharedVaultVal + ' $', inline: true },
        { name: '🐾 الحيوان الأليف', value: petName, inline: true },
        { name: '🔥 الستريك اليومي', value: dailyStreakVal + ' أيام', inline: true }
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
      await message.reply('❌ مبلغ غير صحيح أو رصيدك النقدي لا يكفي!');
      return;
    }
    user.balance -= amount;
    user.bank += amount;
    data.users[userId] = user;
    saveData(data);
    await message.reply('✅ تم إيداع **' + amount + '$** في البنك بنجاح! 🏦');
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
    await message.reply('✅ تم سحب **' + amount + '$** إلى محفظتك النقدية! 💰');
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

    await message.reply('✅ تم تحويل **' + amount + '$** بنجاح إلى <@' + target.id + '>! 💸');
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
    await message.reply('🎉 **فتحت صندوق الحظ وربحت:** **' + prize + '$**! 💰✨');
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
    await message.reply('🎁 **مكافأتك اليومية:** **' + totalAmount + '$** (ستريك ' + user.dailyStreak + ' أيام 🔥)');
    return;
  }

  // 🎰 سلوتس
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
      winMsg = '🎉 **جائزة كبرى 10x!** ربحت **' + prize + '$**!';
    } else if (r1 === r2 || r2 === r3 || r1 === r3) {
      const prize = bet * 2;
      user.balance += prize;
      winMsg = '✨ **تطابق 2x!** ربحت **' + prize + '$**!';
    } else {
      winMsg = '😢 **خسرت الرهان!** حظاً أوفر.';
    }
    data.users[userId] = user;
    saveData(data);
    await message.reply('🎰 **[ ' + r1 + ' | ' + r2 + ' | ' + r3 + ' ]**\n\n' + winMsg);
    return;
  }

  // 🎫 اليانصيب
  if (content === '!شراء_تذكرة' || content === '!تذكرة') {
    const data = readData();
    const user = getUserData(userId);
    if (user.balance < 100) return message.reply('❌ تذكرة اليانصيب تكلف 100$!');
    user.balance -= 100;
    data.lottery.pool += 100;
    data.lottery.tickets.push(userId);
    data.users[userId] = user;
    saveData(data);
    await message.reply('🎫 **تم شراء تذكرة!** الجائزة الحالية: **' + data.lottery.pool + '$**');
    return;
  }

  if (content === '!يانصيب') {
    const data = readData();
    const embed = new EmbedBuilder()
      .setTitle('🎫 يانصيب السيرفر')
      .setDescription('💰 الجائزة الكبرى: **' + data.lottery.pool + '$**\n🎟️ التذاكر: **' + data.lottery.tickets.length + '**\nاكتب `!شراء_تذكرة` للمشاركة.')
      .setColor('#f1c40f');
    await message.reply({ embeds: [embed] });
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
    if (user.balance < petObj.cost) return message.reply('❌ تكلفته ' + petObj.cost + '$!');
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
    await message.reply('🗺️ عاد **' + petObj.name + '** من رحلته ومعه **' + found + '$**! 💰');
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

  if (content.startsWith('!إيداع_مشترك')) {
    const amount = parseInt(content.split(' ')[1]);
    const data = readData();
    const user = getUserData(userId);
    if (!user.spouse) return message.reply('❌ لست متزوجاً!');
    if (isNaN(amount) || amount <= 0 || user.balance < amount) return message.reply('❌ مبلغ غير صحيح أو رصيدك لا يكفي!');
    const spouseData = getUserData(user.spouse);
    user.balance -= amount;
    user.sharedVault = (user.sharedVault || 0) + amount;
    spouseData.sharedVault = user.sharedVault;
    data.users[userId] = user;
    data.users[user.spouse] = spouseData;
    saveData(data);
    await message.reply('🏦 أودعت **' + amount + '$** في الخزنة المشتركة (المجموع: ' + user.sharedVault + '$).');
    return;
  }

  if (content.startsWith('!سحب_مشترك')) {
    const amount = parseInt(content.split(' ')[1]);
    const data = readData();
    const user = getUserData(userId);
    const vault = user.sharedVault || 0;
    if (!user.spouse) return message.reply('❌ لست متزوجاً!');
    if (isNaN(amount) || amount <= 0 || vault < amount) return message.reply('❌ المبلغ غير متوفر في الخزنة!');
    const spouseData = getUserData(user.spouse);
    user.sharedVault = vault - amount;
    spouseData.sharedVault = user.sharedVault;
    user.balance += amount;
    data.users[userId] = user;
    data.users[user.spouse] = spouseData;
    saveData(data);
    await message.reply('💰 سحبت **' + amount + '$** من الخزنة المشتركة.');
    return;
  }

  // 📜 الإنجازات
  if (content === '!انجازاتي' || content === '!إنجازاتي') {
    const data = readData();
    const user = getUserData(userId);
    checkAchievements(userId, user);
    data.users[userId] = user;
    saveData(data);
    const achs = user.achievements || [];
    const embed = new EmbedBuilder()
      .setTitle('📜 إنجازات ' + message.author.username)
      .addFields(
        { name: '🏆 أول 100,000$', value: achs.includes('rich_100k') ? 'مكتمل ✅' : 'قيد التقدم ❌', inline: true },
        { name: '🏢 رائد أعمال (3 مشاريع)', value: achs.includes('biz_owner') ? 'مكتمل ✅' : 'قيد التقدم ❌', inline: true },
        { name: '🐾 صديق الحيوان', value: achs.includes('has_pet') ? 'مكتمل ✅' : 'قيد التقدم ❌', inline: true }
      )
      .setColor('#2ecc71');
    await message.reply({ embeds: [embed] });
    return;
  }

  // 📈 الأسهم والتداول
  if (content.startsWith('!اشتري') && !content.includes('رتبة') && !content.includes('حماية') && !content.includes('صندوق') && !content.includes('تذكرة')) {
    const args = content.split(' ');
    const stockType = args[1] ? args[1].toLowerCase() : '';
    const qty = parseInt(args[2]);
    const stockMap = { 'ذهب': 'gold', 'نفط': 'oil', 'قمح': 'wheat', 'عملات': 'crypto' };
    const stockKey = stockMap[stockType];

    if (!stockKey || isNaN(qty) || qty <= 0) return message.reply('❌ مثال: `!اشتري ذهب 2` (الأنواع المتاحة: ذهب، نفط، قمح، عملات)');
    const data = readData();
    const user = getUserData(userId);
    const price = data.market.prices[stockKey];
    const totalCost = price * qty;
    if (user.balance < totalCost) return message.reply('❌ رصيدك لا يكفي (التكلفة: ' + totalCost + '$)!');
    user.balance -= totalCost;
    user.stocks[stockKey] = (user.stocks[stockKey] || 0) + qty;
    data.users[userId] = user;
    saveData(data);
    await message.reply('✅ اشتريت **' + qty + '** من **' + stockType + '** بـ **' + totalCost + '$**!');
    return;
  }

  if (content.startsWith('!بيع')) {
    const args = content.split(' ');
    const stockType = args[1] ? args[1].toLowerCase() : '';
    const qty = parseInt(args[2]);
    const stockMap = { 'ذهب': 'gold', 'نفط': 'oil', 'قمح': 'wheat', 'عملات': 'crypto' };
    const stockKey = stockMap[stockType];

    if (!stockKey || isNaN(qty) || qty <= 0) return message.reply('❌ مثال: `!بيع ذهب 2`');
    const data = readData();
    const user = getUserData(userId);
    const cur = user.stocks[stockKey] || 0;
    if (cur < qty) return message.reply('❌ لا تمتلك هذه الكمية للبيع!');
    const price = data.market.prices[stockKey];
    const totalReturn = price * qty;
    user.stocks[stockKey] = cur - qty;
    user.balance += totalReturn;
    data.users[userId] = user;
    saveData(data);
    await message.reply('✅ بعت **' + qty + '** من **' + stockType + '** واستلمت **' + totalReturn + '$**!');
    return;
  }

  // 📊 السوق مع المؤشرات
  if (content === '!سوق') {
    const data = readData();
    const p = data.market.prices;
    const t = data.market.trends;
    const embed = new EmbedBuilder()
      .setTitle('📊 أسعار السوق والمؤشرات الحية')
      .addFields(
        { name: '🥇 ذهب', value: p.gold + ' $ — ' + (t.gold || '➖'), inline: true },
        { name: '🛢️ نفط', value: p.oil + ' $ — ' + (t.oil || '➖'), inline: true },
        { name: '🌾 قمح', value: p.wheat + ' $ — ' + (t.wheat || '➖'), inline: true },
        { name: '🪙 عملات رقمية', value: p.crypto + ' $ — ' + (t.crypto || '➖'), inline: true }
      )
      .setColor('#9b59b6')
      .setFooter({ text: 'تتغير الأسعار والمؤشرات تلقائياً كل ساعة!' });
    await message.reply({ embeds: [embed] });
    return;
  }

  // 🏢 المشاريع الموسعة
  if (content === '!مشاريع') {
    const user = getUserData(userId);
    const b = user.businesses || {};
    const embed = new EmbedBuilder()
      .setTitle('🏢 المشاريع الاستثمارية الموسعة')
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
    if (user.balance < proj.cost) return message.reply('❌ رصيدك لا يكفي! يكلف **' + proj.cost + '$**.');

    user.balance -= proj.cost;
    if (!user.businesses) user.businesses = {};
    user.businesses[pKey] = (user.businesses[pKey] || 0) + 1;
    checkAchievements(userId, user);
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

    if (hours < 0.1) return message.reply('⏳ لم تتراكم أرباح كافية بعد!');

    const b = user.businesses || {};
    const hourly = (b.cafe * 100) + (b.gas * 350) + (b.tech * 1200) + (b.factory * 3000) + (b.realestate * 8000);
    if (hourly === 0) return message.reply('❌ لا تملك مشاريع لجمع أرباحها!');

    const total = Math.floor(hourly * hours);
    user.balance += total;
    user.lastClaimedIncome = now;
    data.users[userId] = user;
    saveData(data);
    await message.reply('💵 جمعت أرباح مشاريعك بقيمة **' + total + '$**!');
    return;
  }

  // 🏆 الترتيب
  if (content === '!ترتيب' || content === '!الترتيب') {
    const data = readData();
    const users = Object.entries(data.users)
      .map(([id, u]) => ({ id, total: (u.balance || 0) + (u.bank || 0) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    let desc = '';
    users.forEach((u, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '#' + (i + 1);
      desc += medal + ' <@' + u.id + '> — **' + u.total + '** $\n';
    });
    const embed = new EmbedBuilder().setTitle('🏆 أغنى اللاعبين').setDescription(desc || 'لا توجد بيانات').setColor('#f1c40f');
    await message.reply({ embeds: [embed] });
    return;
  }
});

// معالج الأزرار التفاعلية
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton()) return;
  const userId = interaction.user.id;
  const data = readData();
  const user = getUserData(userId);

  try {
    switch (interaction.customId) {
      case 'account':
        await interaction.reply({
          content: '💳 **حسابك الشخصي:**\n- النقدي: **' + user.balance + '$**\n- البنك: **' + user.bank + '$**\n- الخزنة المشتركة: **' + (user.sharedVault || 0) + '$**',
          ephemeral: true
        });
        break;
      case 'bank':
        await interaction.reply({
          content: '🏦 **البنك:** إيداع عبر `!إيداع [مبلغ/الكل]` أو سحب عبر `!سحب [مبلغ/الكل]`',
          ephemeral: true
        });
        break;
      case 'daily': {
        const today = new Date().toDateString();
        if (user.dailyLast === today) {
          await interaction.reply({ content: '⏳ استلمت مكافأتك اليومية مسبقاً!', ephemeral: true });
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
        await interaction.reply({ content: '🎁 مكافأتك اليومية: **' + totalAmount + '$** (ستريك ' + user.dailyStreak + ' أيام 🔥)', ephemeral: true });
        break;
      }
      case 'portfolio':
        await interaction.reply({
          content: '📈 **محفظتك:**\n- ذهب: ' + (user.stocks?.gold || 0) + '\n- نفط: ' + (user.stocks?.oil || 0) + '\n- قمح: ' + (user.stocks?.wheat || 0) + '\n- عملات رقمية: ' + (user.stocks?.crypto || 0),
          ephemeral: true
        });
        break;
      case 'market': {
        const p = data.market.prices;
        const t = data.market.trends;
        await interaction.reply({
          content: '📊 **السوق:** ذهب: ' + p.gold + '$ (' + t.gold + ') \vert{} نفط: ' + p.oil + '$ (' + t.oil + ') | قمح: ' + p.wheat + '$ (' + t.wheat + ') \vert{} عملات: ' + p.crypto + '$ (' + t.crypto + ')',
          ephemeral: true
        });
        break;
      }
      case 'businesses':
        await interaction.reply({
          content: '🏢 **المشاريع:** لعرضها والشراء اكتب `!مشاريع` ولجمع الأرباح `!ارباح`',
          ephemeral: true
        });
        break;
      case 'pets':
        await interaction.reply({
          content: user.pet ? '🐾 حيوانك: ' + PETS[user.pet].name + ' (استخدم `!رحلة`)' : '❌ لا تملك حيواناً أليفاً! تصفح `!الحيوانات`.',
          ephemeral: true
        });
        break;
      case 'marriage':
        await interaction.reply({
          content: user.spouse ? '💍 متزوج من <@' + user.spouse + '>' : '💍 لست متزوجاً. استخدم `!زواج @الشخص`.',
          ephemeral: true
        });
        break;
      case 'games':
        await interaction.reply({
          content: '🎲 **الألعاب:** `!سلوتس [مبلغ]` | `!تخمين [1-10] [مبلغ]` | `!سباق [مبلغ]` | `!حجر`',
          ephemeral: true
        });
        break;
      case 'achievements':
        await interaction.reply({ content: '📜 إنجازاتك المحققة: ' + (user.achievements?.length || 0), ephemeral: true });
        break;
      case 'leaderboard':
        await interaction.reply({ content: '🏆 لعرض ترتيب أغنى اللاعبين اكتب: `!ترتيب`', ephemeral: true });
        break;
      case 'shop':
        await interaction.reply({ content: '🛒 المتجر: `!متجر` لشراء الحماية والصناديق، أو `!رتب` للرتب الشرفية.', ephemeral: true });
        break;
      default:
        await interaction.reply({ content: '✅ تم تنفيذ الطلب بنجاح!', ephemeral: true });
        break;
    }
  } catch (err) {
    console.error('Button error:', err);
  }
});

// تشغيل البوت
const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('❌ توكن الديسكورد غير موجود!');
  process.exit(1);
}

client.login(token);
