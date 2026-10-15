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

// خادم ويب لمراقبة UptimeRobot / Render
const web = express();
web.get('/', (_req, res) => res.status(200).send('✅ البوت المتكامل يعمل بنجاح'));
web.get('/health', (_req, res) => res.json({ ok: true }));
web.listen(Number(process.env.PORT) || 3000, '0.0.0.0');

// مسار ملف البيانات
const DATA_PATH = path.join(__dirname, 'data.json');

// المشاريع المتاحة
const BUSINESSES = {
  cafe: { name: 'مقهى ☕', cost: 5000, incomePerHour: 100 },
  gas: { name: 'محطة بنزين ⛽', cost: 15000, incomePerHour: 350 },
  tech: { name: 'شركة تكنولوجيا 💻', cost: 50000, incomePerHour: 1200 }
};

// الحيوانات الأليفة المتاحة
const PETS = {
  dog: { name: 'كلب 🐶', cost: 2000, minFind: 100, maxFind: 500 },
  cat: { name: 'قطة 🐱', cost: 1500, minFind: 80, maxFind: 400 },
  dragon: { name: 'تنين أسطوري 🐲', cost: 20000, minFind: 1000, maxFind: 4000 }
};

// الرتب المتاحة للشراء
const SHOP_ROLES = {
  'VIP': 10000,
  'تاجر': 25000,
  'مليونير': 100000
};

// إعلانات الزواج المعلقة
const pendingMarriages = new Map();

function initData() {
  if (!fs.existsSync(DATA_PATH)) {
    fs.writeFileSync(DATA_PATH, JSON.stringify({
      users: {},
      auctions: [],
      missions: {},
      lottery: { pool: 1000, tickets: [] },
      market: { prices: { gold: 100, oil: 50, wheat: 30 }, lastUpdate: Date.now() }
    }, null, 2));
  }
}

function readData() {
  initData();
  try {
    const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    if (!data.users) data.users = {};
    if (!data.auctions) data.auctions = [];
    if (!data.missions) data.missions = {};
    if (!data.lottery) data.lottery = { pool: 1000, tickets: [] };
    if (!data.market) data.market = { prices: { gold: 100, oil: 50, wheat: 30 }, lastUpdate: Date.now() };
    return data;
  } catch (err) {
    return { users: {}, auctions: [], missions: {}, lottery: { pool: 1000, tickets: [] }, market: { prices: { gold: 100, oil: 50, wheat: 30 }, lastUpdate: Date.now() } };
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

// الحصول على بيانات المستخدم الهيكلية
function getUserData(userId) {
  const data = readData();
  if (!data.users[userId]) {
    data.users[userId] = {
      balance: 1000,
      bank: 0,
      stocks: { gold: 0, oil: 0, wheat: 0 },
      dailyLast: '',
      dailyStreak: 0,
      lastJob: {},
      lastRob: 0,
      shieldUntil: 0,
      businesses: { cafe: 0, gas: 0, tech: 0 },
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

// فحص وإضافة الإنجازات تلقائياً
function checkAchievements(userId, user) {
  if (!user.achievements) user.achievements = [];
  const rewards = [];

  if ((user.balance + user.bank) >= 100000 && !user.achievements.includes('rich_100k')) {
    user.achievements.push('rich_100k');
    user.balance += 5000;
    rewards.push('🏆 **أول 100,000$**: ربحت جائزة 5,000$!');
  }

  const cafeCount = user.businesses && user.businesses.cafe ? user.businesses.cafe : 0;
  const gasCount = user.businesses && user.businesses.gas ? user.businesses.gas : 0;
  const techCount = user.businesses && user.businesses.tech ? user.businesses.tech : 0;
  const totalBiz = cafeCount + gasCount + techCount;

  if (totalBiz >= 3 && !user.achievements.includes('biz_owner')) {
    user.achievements.push('biz_owner');
    user.balance += 3000;
    rewards.push('🏢 **رائد أعمال**: تمتلك 3 مشاريع! ربحت جائزة 3,000$!');
  }

  if (user.pet && !user.achievements.includes('has_pet')) {
    user.achievements.push('has_pet');
    user.balance += 1000;
    rewards.push('🐾 **صديق الحيوان**: قمت بتبني أول حيوان أليف! ربحت جائزة 1,000$!');
  }

  return rewards;
}

// تحديث أسعار السوق التلقائي
function updateMarketPrices() {
  const data = readData();
  const now = Date.now();
  const lastUpdate = data.market.lastUpdate ? data.market.lastUpdate : 0;
  if (now - lastUpdate >= 3600000) {
    ['gold', 'oil', 'wheat'].forEach(stock => {
      const currentPrice = data.market.prices[stock] ? data.market.prices[stock] : 100;
      const changePercent = (Math.random() * 0.30) - 0.15;
      let newPrice = Math.round(currentPrice * (1 + changePercent));
      if (newPrice < 10) newPrice = 10;
      data.market.prices[stock] = newPrice;
    });
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
  console.log(`✅ بوت ${client.user.tag} المكتمل يعمل بنجاح!`);
  setInterval(updateMarketPrices, 10 * 60 * 1000);
});

client.on(Events.MessageCreate, async message => {
  if (message.author.bot) return;
  const content = message.content.trim();
  const userId = message.author.id;

  updateMarketPrices();

  // 🏛️ القائمة الرئيسية
  if (content === '!قائمة' || content === '!القائمة') {
    const embed = new EmbedBuilder()
      .setTitle('🏛️ المركز الاقتصادي والترفيهي المتكامل')
      .setDescription('اختر الخيار المراد من الأزرار أدناه:')
      .setColor('#2b90d9')
      .setFooter({ text: 'اقتصاد افتراضي متكامل • استمتع بالألعاب والمزايا!' });

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('account').setLabel('💳 حسابي').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('bank').setLabel('🏦 البنك').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('daily').setLabel('🎁 اليومية والستريك').setStyle(ButtonStyle.Success)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('portfolio').setLabel('📈 محفظتي').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('market').setLabel('📊 السوق').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('businesses').setLabel('🏢 المشاريع').setStyle(ButtonStyle.Primary)
    );

    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('pets').setLabel('🐾 الحيوانات').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('marriage').setLabel('💍 الزواج').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('games').setLabel('🎰 الألعاب والكازينو').setStyle(ButtonStyle.Danger)
    );

    const row4 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('achievements').setLabel('📜 الإنجازات').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('leaderboard').setLabel('🏆 الترتيب').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('shop').setLabel('🛒 المتجر').setStyle(ButtonStyle.Success)
    );

    await message.reply({ embeds: [embed], components: [row1, row2, row3, row4] });
    return;
  }

  // 📜 الأوامر والمساعدة
  if (content === '!مساعدة' || content === '!اوامر') {
    const embed = new EmbedBuilder()
      .setTitle('📜 قائمة الأوامر الشاملة')
      .addFields(
        { name: '🎰 الكازينو واليانصيب', value: '`!سلوتس [المبلغ]` | `!شراء_تذكرة` | `!يانصيب`' },
        { name: '🐾 الحيوانات الأليفة', value: '`!الحيوانات` | `!تبني [كلب/قطة/تنين]` | `!رحلة`' },
        { name: '💍 الزواج والخزنة المشتركة', value: '`!زواج @الشخص` | `!قبول` | `!إيداع_مشترك [مبلغ]` | `!سحب_مشترك [مبلغ]`' },
        { name: '🏆 الإنجازات والأوسمة', value: '`!انجازاتي` — لمشاهدة إنجازاتك وجوائزك الأسطورية' },
        { name: '💳 الاقتصاد والأسهم والمشاريع', value: '`!حساب` | `!سوق` | `!اشتري` | `!بيع` | `!مشاريع` | `!ارباح` | `!رتب`' }
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

    const sharedVaultVal = user.sharedVault ? user.sharedVault : 0;
    const dailyStreakVal = user.dailyStreak ? user.dailyStreak : 0;
    const petName = user.pet && PETS[user.pet] ? PETS[user.pet].name : 'لا يوجد';
    const spouseMention = user.spouse ? '<@' + user.spouse + '>' : 'غير متزوج';

    const embed = new EmbedBuilder()
      .setTitle('💳 حساب — ' + message.author.username)
      .addFields(
        { name: '💰 النقدي', value: user.balance + ' $', inline: true },
        { name: '🏦 في البنك', value: user.bank + ' $', inline: true },
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

  // 🎰 ماكينة الحظ (!سلوتس 100)
  if (content.startsWith('!سلوتس') || content.startsWith('!slots')) {
    const args = content.split(' ');
    const bet = parseInt(args[1]);

    if (isNaN(bet) || bet <= 0) {
      await message.reply('❌ يرجى كتابة مبلغ الرهان! مثال: `!سلوتس 100`');
      return;
    }

    const data = readData();
    const user = getUserData(userId);

    if (user.balance < bet) {
      await message.reply('❌ لا تملك هذا المبلغ نقداً للعب!');
      return;
    }

    user.balance -= bet;
    const symbols = ['🍒', '💎', '🍋', '🔔'];
    const r1 = symbols[Math.floor(Math.random() * symbols.length)];
    const r2 = symbols[Math.floor(Math.random() * symbols.length)];
    const r3 = symbols[Math.floor(Math.random() * symbols.length)];

    let winMsg = '';
    if (r1 === r2 && r2 === r3) {
      const prize = bet * 10;
      user.balance += prize;
      winMsg = '🎉 **جائزة كبرى مضاعفة! 10x** ربحت **' + prize + '$**! 💰🔥';
    } else if (r1 === r2 || r2 === r3 || r1 === r3) {
      const prize = bet * 2;
      user.balance += prize;
      winMsg = '✨ **تطابق رائع! 2x** ربحت **' + prize + '$**! 💵';
    } else {
      winMsg = '😢 **خسرت الرهان!** حظاً أوفر المرة القادمة.';
    }

    data.users[userId] = user;
    saveData(data);

    await message.reply('🎰 **[ ' + r1 + ' | ' + r2 + ' | ' + r3 + ' ]**\n\n' + winMsg);
    return;
  }

  // 🎫 شراء تذكرة يانصيب
  if (content === '!شراء_تذكرة' || content === '!تذكرة') {
    const data = readData();
    const user = getUserData(userId);
    const ticketCost = 100;

    if (user.balance < ticketCost) {
      await message.reply('❌ تذكرة اليانصيب تكلف **' + ticketCost + '$**!');
      return;
    }

    user.balance -= ticketCost;
    data.lottery.pool += ticketCost;
    data.lottery.tickets.push(userId);

    data.users[userId] = user;
    saveData(data);

    await message.reply('🎫 **تم شراء تذكرة يانصيب!**\n💰 الجائزة الكبرى الحالية: **' + data.lottery.pool + '$**\n🎟️ عدد التذاكر المباعة: **' + data.lottery.tickets.length + '**');
    return;
  }

  // 📊 عرض حالة اليانصيب
  if (content === '!يانصيب') {
    const data = readData();
    const embed = new EmbedBuilder()
      .setTitle('🎫 يانصيب السيرفر الأسبوعي')
      .setDescription(
        '💰 **الجائزة الكبرى:** **' + data.lottery.pool + '$**\n' +
        '🎟️ **التذاكر المشاركة:** **' + data.lottery.tickets.length + '** تذكرة\n\n' +
        'اكتب `!شراء_تذكرة` للمشاركة بـ 100$ ورفع قيمة الجائزة!'
      )
      .setColor('#f1c40f');
    await message.reply({ embeds: [embed] });
    return;
  }

  // 🐾 تصفح الحيوانات الأليفة
  if (content === '!الحيوانات' || content === '!حيوانات') {
    const embed = new EmbedBuilder()
      .setTitle('🐾 متجر الحيوانات الأليفة')
      .addFields(
        { name: '🐶 كلب (2,000$)', value: 'يجد لك: 100$- 500$ في كل رحلة\n`!تبني كلب`', inline: false },
        { name: '🐱 قطة (1,500$)', value: 'تجد لك: 80$- 400$ في كل رحلة\n`!تبني قطة`', inline: false },
        { name: '🐲 تنين أسطوري (20,000$)', value: 'يجلب لك: 1,000$- 4,000$ في كل رحلة!\n`!تبني تنين`', inline: false }
      )
      .setColor('#e67e22')
      .setFooter({ text: 'أرسل حيوانك في رحلة كل ساعتين عبر !رحلة لجلب الكنوز!' });
    await message.reply({ embeds: [embed] });
    return;
  }

  // 🐶 تبني حيوان أليف
  if (content.startsWith('!تبني')) {
    const args = content.split(' ');
    const petType = args[1] ? args[1].toLowerCase() : '';

    const petMap = { 'كلب': 'dog', 'قطة': 'cat', 'تنين': 'dragon', 'dog': 'dog', 'cat': 'cat', 'dragon': 'dragon' };
    const pKey = petMap[petType];

    if (!pKey) {
      await message.reply('❌ يرجى اختيار حيوان صالح:\n`!تبني كلب` | `!تبني قطة` | `!تبني تنين`');
      return;
    }

    const data = readData();
    const user = getUserData(userId);
    const petObj = PETS[pKey];

    if (user.balance < petObj.cost) {
      await message.reply('❌ تبني **' + petObj.name + '** يكلف **' + petObj.cost + '$**!');
      return;
    }

    user.balance -= petObj.cost;
    user.pet = pKey;
    checkAchievements(userId, user);

    data.users[userId] = user;
    saveData(data);

    await message.reply('🐾 **مبروك!** قمت بتبني **' + petObj.name + '** بنجاح! استخدم `!رحلة` لإرساله للبحث عن الكنوز.');
    return;
  }

  // 🗺️ إرسال الحيوان الأليف في رحلة
  if (content === '!رحلة' || content === '!رحلة_كنز') {
    const data = readData();
    const user = getUserData(userId);

    if (!user.pet) {
      await message.reply('❌ أنت لا تملك حيواناً أليفاً بعد! تبنّ واحداً عبر `!الحيوانات`.');
      return;
    }

    const now = Date.now();
    const cooldown = 2 * 60 * 60 * 1000;
    const lastHunt = user.lastPetHunt ? user.lastPetHunt : 0;

    if (lastHunt && now - lastHunt < cooldown) {
      const remaining = Math.ceil((cooldown - (now - lastHunt)) / 1000 / 60);
      await message.reply('⏳ حيوانك الأليف متعب الآن! دعه يرتاح لمدة **' + remaining + ' دقيقة** قبل الرحلة التالية.');
      return;
    }

    const petObj = PETS[user.pet];
    const found = Math.floor(Math.random() * (petObj.maxFind - petObj.minFind + 1)) + petObj.minFind;

    user.balance += found;
    user.lastPetHunt = now;

    data.users[userId] = user;
    saveData(data);

    await message.reply('🗺️ **خرج ' + petObj.name + ' في رحلة استكشافية ووجد لك كنوزاً وأموالاً بقيمة ' + found + '$!** 💰✨');
    return;
  }

  // 💍 طلب الزواج
  if (content.startsWith('!زواج')) {
    const target = message.mentions.users.first();
    if (!target || target.id === userId || target.bot) {
      await message.reply('❌ منشن شريكك المستقبلي! مثال: `!زواج @الشخص`');
      return;
    }

    const user = getUserData(userId);
    const targetData = getUserData(target.id);

    if (user.spouse) {
      await message.reply('❌ أنت متزوج بالفعل!');
      return;
    }
    if (targetData.spouse) {
      await message.reply('❌ الشخص المستهدف متزوج بالفعل!');
      return;
    }

    pendingMarriages.set(target.id, userId);
    await message.reply('💍 <@' + target.id + '>، لقد طلب <@' + userId + '> الزواج منك وارتباط حسابكما بخزنة مشتركة!\nاكتب `!قبول` للموافقة على الطلب!');
    return;
  }

  // 💒 قبول الزواج
  if (content === '!قبول' || content === '!موافقة') {
    const proposerId = pendingMarriages.get(userId);
    if (!proposerId) {
      await message.reply('❌ لا توجد لديك طلبات زواج معلقة!');
      return;
    }

    const data = readData();
    const user = getUserData(userId);
    const proposerData = getUserData(proposerId);

    user.spouse = proposerId;
    proposerData.spouse = userId;

    pendingMarriages.delete(userId);

    data.users[userId] = user;
    data.users[proposerId] = proposerData;
    saveData(data);

    await message.reply('🎉 **تهانينا وألف مبروك!** تم زواج <@' + userId + '> و <@' + proposerId + '> بنجاح! تم فتح الخزنة المشتركة بينكما.');
    return;
  }

  // 🏦 إيداع في الخزنة المشتركة
  if (content.startsWith('!إيداع_مشترك')) {
    const args = content.split(' ');
    const amount = parseInt(args[1]);

    const data = readData();
    const user = getUserData(userId);

    if (!user.spouse) {
      await message.reply('❌ يجب أن تكون متزوجاً لاستخدام الخزنة المشتركة!');
      return;
    }
    if (isNaN(amount) || amount <= 0 || user.balance < amount) {
      await message.reply('❌ حدد مبلغاً صحيحاً للإيداع!');
      return;
    }

    const spouseData = getUserData(user.spouse);
    const currentVault = user.sharedVault ? user.sharedVault : 0;

    user.balance -= amount;
    user.sharedVault = currentVault + amount;
    spouseData.sharedVault = user.sharedVault;

    data.users[userId] = user;
    data.users[user.spouse] = spouseData;
    saveData(data);

    await message.reply('🏦 **تم إيداع ' + amount + '$ في الخزنة المشتركة!** الرصيد المشترك الحالي: **' + user.sharedVault + '$**.');
    return;
  }

  // 🏦 سحب من الخزنة المشتركة
  if (content.startsWith('!سحب_مشترك')) {
    const args = content.split(' ');
    const amount = parseInt(args[1]);

    const data = readData();
    const user = getUserData(userId);
    const currentVault = user.sharedVault ? user.sharedVault : 0;

    if (!user.spouse) {
      await message.reply('❌ يجب أن تكون متزوجاً لاستخدام الخزنة المشتركة!');
      return;
    }
    if (isNaN(amount) || amount <= 0 || currentVault < amount) {
      await message.reply('❌ المبلغ المطلوب غير متاح في الخزنة المشتركة!');
      return;
    }

    const spouseData = getUserData(user.spouse);

    user.sharedVault = currentVault - amount;
    spouseData.sharedVault = user.sharedVault;
    user.balance += amount;

    data.users[userId] = user;
    data.users[user.spouse] = spouseData;
    saveData(data);

    await message.reply('💰 **تم سحب ' + amount + '$ من الخزنة المشتركة إلى حسابك!**');
    return;
  }

  // 📜 عرض الإنجازات
  if (content === '!انجازاتي' || content === '!إنجازاتي') {
    const data = readData();
    const user = getUserData(userId);
    checkAchievements(userId, user);
    data.users[userId] = user;
    saveData(data);

    const achs = user.achievements ? user.achievements : [];
    const embed = new EmbedBuilder()
      .setTitle('📜 لوحة إنجازات — ' + message.author.username)
      .setDescription('قائمة الأوسمة والإنجازات التي حققتها:')
      .addFields(
        { name: '🏆 أول 100,000$', value: achs.includes('rich_100k') ? 'مكتمل ✅ (+5,000$)' : 'قيد التقدم ❌', inline: true },
        { name: '🏢 رائد الأعمال (3 مشاريع)', value: achs.includes('biz_owner') ? 'مكتمل ✅ (+3,000$)' : 'قيد التقدم ❌', inline: true },
        { name: '🐾 صديق الحيوان', value: achs.includes('has_pet') ? 'مكتمل ✅ (+1,000$)' : 'قيد التقدم ❌', inline: true }
      )
      .setColor('#2ecc71');
    await message.reply({ embeds: [embed] });
    return;
  }

  // 🎁 المكافأة اليومية
  if (content === '!يومية' || content === '!يومي') {
    const data = readData();
    const user = getUserData(userId);
    const now = new Date();
    const today = now.toDateString();
    
    if (user.dailyLast === today) {
      await message.reply('⏳ حصلت على مكافأتك اليومية بالفعل!');
      return;
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    if (user.dailyLast === yesterday.toDateString()) {
      const streak = user.dailyStreak ? user.dailyStreak : 0;
      user.dailyStreak = streak + 1;
    } else {
      user.dailyStreak = 1;
    }

    const bonus = (user.dailyStreak - 1) * 50;
    const totalAmount = 250 + bonus;

    user.balance += totalAmount;
    user.dailyLast = today;
    data.users[userId] = user;
    saveData(data);

    await message.reply('🎁 **استلمت مكافأتك اليومية!**\n💰 المبلغ: **' + totalAmount + '$** (ستريك ' + user.dailyStreak + ' أيام🔥)');
    return;
  }

  // 📈 تداول الأسهم
  if (content.startsWith('!اشتري') && !content.includes('رتبة') && !content.includes('حماية') && !content.includes('صندوق') && !content.includes('تذكرة')) {
    const args = content.split(' ');
    const stockType = args[1] ? args[1].toLowerCase() : '';
    const qty = parseInt(args[2]);

    const stockMap = { 'ذهب': 'gold', 'نفط': 'oil', 'قمح': 'wheat' };
    const stockKey = stockMap[stockType];

    if (!stockKey || isNaN(qty) || qty <= 0) {
      await message.reply('❌ مثال: `!اشتري ذهب 2`');
      return;
    }

    const data = readData();
    const user = getUserData(userId);
    const price = data.market.prices[stockKey];
    const totalCost = price * qty;

    if (user.balance < totalCost) {
      await message.reply('❌ التكلفة **' + totalCost + '$** ولا تملك ما يكفي!');
      return;
    }

    user.balance -= totalCost;
    const currentStock = user.stocks[stockKey] ? user.stocks[stockKey] : 0;
    user.stocks[stockKey] = currentStock + qty;
    data.users[userId] = user;
    saveData(data);

    await message.reply('✅ تم شراء **' + qty + '** وحدة من **' + stockType + '** بـ **' + totalCost + '$**! 📈');
    return;
  }

  // 🏢 المشاريع والأرباح
  if (content === '!مشاريع') {
    const user = getUserData(userId);
    const cafeCount = user.businesses && user.businesses.cafe ? user.businesses.cafe : 0;
    const gasCount = user.businesses && user.businesses.gas ? user.businesses.gas : 0;
    const techCount = user.businesses && user.businesses.tech ? user.businesses.tech : 0;

    const embed = new EmbedBuilder()
      .setTitle('🏢 مشاريع الاستثمار')
      .addFields(
        { name: '☕ مقهى (5,000$)', value: 'المملوك: **' + cafeCount + '** | `!شراء_مشروع مقهى`', inline: false },
        { name: '⛽ محطة بنزين (15,000$)', value: 'المملوك: **' + gasCount + '** | `!شراء_مشروع بنزين`', inline: false },
        { name: '💻 شركة تكنولوجيا (50,000$)', value: 'المملوك: **' + techCount + '** | `!شراء_مشروع تكنولوجيا`', inline: false }
      )
      .setColor('#8e44ad');
    await message.reply({ embeds: [embed] });
    return;
  }

  if (content.startsWith('!شراء_مشروع')) {
    const type = content.split(' ')[1] ? content.split(' ')[1].toLowerCase() : '';
    const pKey = { 'مقهى': 'cafe', 'بنزين': 'gas', 'تكنولوجيا': 'tech' }[type];

    if (!pKey) return message.reply('❌ اختر مشروعاً صحيحاً!');

    const data = readData();
    const user = getUserData(userId);
    const project = BUSINESSES[pKey];

    if (user.balance < project.cost) return message.reply('❌ تكلفته **' + project.cost + '$**!');

    user.balance -= project.cost;
    if (!user.businesses) user.businesses = {};
    const currentBiz = user.businesses[pKey] ? user.businesses[pKey] : 0;
    user.businesses[pKey] = currentBiz + 1;

    checkAchievements(userId, user);

    data.users[userId] = user;
    saveData(data);

    await message.reply('🏢 تم شراء **' + project.name + '** بنجاح!');
    return;
  }

  if (content === '!ارباح' || content === '!أرباح') {
    const data = readData();
    const user = getUserData(userId);
    const now = Date.now();
    const lastClaim = user.lastClaimedIncome ? user.lastClaimedIncome : now;
    const hoursPassed = (now - lastClaim) / (1000 * 60 * 60);

    if (hoursPassed < 0.1) return message.reply('⏳ عد لاحقاً لجمع الأرباح!');

    const cafeC = user.businesses && user.businesses.cafe ? user.businesses.cafe : 0;
    const gasC = user.businesses && user.businesses.gas ? user.businesses.gas : 0;
    const techC = user.businesses && user.businesses.tech ? user.businesses.tech : 0;

    let hourly = (cafeC * 100) + (gasC * 350) + (techC * 1200);
    if (hourly === 0) return message.reply('❌ لا تملك مشاريع!');

    const totalIncome = Math.floor(hourly * hoursPassed);
    user.balance += totalIncome;
    user.lastClaimedIncome = now;

    data.users[userId] = user;
    saveData(data);

    await message.reply('💵 استلمت **' + totalIncome + '$** أرباح مشاريعك! 🎉');
    return;
  }

  // 📊 السوق والترتيب
  if (content === '!سوق') {
    const data = readData();
    const embed = new EmbedBuilder()
      .setTitle('📊 أسعار السوق')
      .addFields(
        { name: '🥇 ذهب', value: data.market.prices.gold + ' $', inline: true },
        { name: '🛢️ نفط', value: data.market.prices.oil + ' $', inline: true },
        { name: '🌾 قمح', value: data.market.prices.wheat + ' $', inline: true }
      )
      .setColor('#9b59b6');
    await message.reply({ embeds: [embed] });
    return;
  }

  if (content === '!ترتيب' || content === '!الترتيب') {
    const data = readData();
    const users = Object.entries(data.users)
      .map(([id, u]) => {
        const bal = u.balance ? u.balance : 0;
        const bnk = u.bank ? u.bank : 0;
        return { id, total: bal + bnk };
      })
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

// الأزرار التفاعلية
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton()) return;
  const userId = interaction.user.id;
  const user = getUserData(userId);

  try {
    switch (interaction.customId) {
      case 'account': {
        const embed = new EmbedBuilder()
          .setTitle('💳 حساب — ' + interaction.user.username)
          .addFields(
            { name: '💰 النقدي', value: user.balance + ' $', inline: true },
            { name: '🏦 في البنك', value: user.bank + ' $', inline: true },
            { name: '🐾 الحيوان', value: user.pet && PETS[user.pet] ? PETS[user.pet].name : 'لا يوجد', inline: true }
          )
          .setColor('#3498db');
        await interaction.reply({ embeds: [embed], ephemeral: true });
        break;
      }
      case 'pets': {
        const petDesc = user.pet && PETS[user.pet] ? 'تمتلك: **' + PETS[user.pet].name + '**\nاستخدم `!رحلة` كل ساعتين لجلب الأموال!' : 'لا تملك حيواناً! تصفح `!الحيوانات` للتبني.';
        const embed = new EmbedBuilder()
          .setTitle('🐾 حيوانك الأليف')
          .setDescription(petDesc)
          .setColor('#e67e22');
        await interaction.reply({ embeds: [embed], ephemeral: true });
        break;
      }
      case 'marriage': {
        const sharedV = user.sharedVault ? user.sharedVault : 0;
        const marriageDesc = user.spouse ? 'الشريك: <@' + user.spouse + '>\nالرصيد المشترك: **' + sharedV + '$**' : 'لست متزوجاً! استخدم `!زواج @الشخص`.';
        const embed = new EmbedBuilder()
          .setTitle('💍 الشريك والخزنة المشتركة')
          .setDescription(marriageDesc)
          .setColor('#e91e63');
        await interaction.reply({ embeds: [embed], ephemeral: true });
        break;
      }
      case 'achievements': {
        const achs = user.achievements ? user.achievements : [];
        const embed = new EmbedBuilder()
          .setTitle('📜 إنجازاتك الحالية')
          .setDescription('حققت **' + achs.length + '** إنجازات! اكتب `!انجازاتي` لمشاهدة التفاصيل.')
          .setColor('#2ecc71');
        await interaction.reply({ embeds: [embed], ephemeral: true });
        break;
      }
      default:
        await interaction.reply({ content: '✅ تم التنفيذ بنجاح!', ephemeral: true });
        break;
    }
  } catch (err) {
    console.error('Error handling button:', err);
  }
});

// تسجيل الدخول
const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('❌ DISCORD_TOKEN غير موجود!');
  process.exit(1);
}

client.login(token);
