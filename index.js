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

// خادم الويب لمراقبة التشغيل
const web = express();
web.get('/', (_req, res) => res.status(200).send('✅ البوت يعمل بنجاح تام'));
web.get('/health', (_req, res) => res.json({ ok: true }));
web.listen(Number(process.env.PORT) || 3000, '0.0.0.0');

const DATA_PATH = path.join(__dirname, 'data.json');

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

// قائمة التصنيفات الموسعة والضخمة في السوق
const DEFAULT_MARKET_ASSETS = {
  cars: { name: 'سيارات 🚗', price: 44356, trend: '📉' },
  stocks: { name: 'أسهم 📊', price: 37628, trend: '📉' },
  lands: { name: 'أراضي 🏙️', price: 143735, trend: '📉' },
  trains: { name: 'قطارات 🚆', price: 421031, trend: '📉' },
  phones: { name: 'هواتف 📱', price: 22151, trend: '📉' },
  planes: { name: 'طائرات ✈️', price: 230264, trend: '🔄' },
  stadiums: { name: 'ملاعب 🏟️', price: 8412166, trend: '🟢' },
  yachts: { name: 'يخوت فاخرة 🛥️', price: 1550000, trend: '🟢' },
  hotels: { name: 'فنادق كبرى 🏨', price: 4200000, trend: '📈' },
  islands: { name: 'جزر خاصة 🏝️', price: 25000000, trend: '🟢' },
  ai_companies: { name: 'شركات ذكاء اصطناعي 🤖', price: 950000, trend: '📈' },
  gold_mines: { name: 'مناجم ذهب 🪙', price: 6800000, trend: '🟢' },
  nuclear: { name: 'طاقة نووية ⚡', price: 15000000, trend: '📈' },
  spaceships: { name: 'سفن فضاء 🚀', price: 45000000, trend: '🟢' },
  fashion: { name: 'ماركات أزياء 👔', price: 310000, trend: '📉' },
  diamonds: { name: 'مجوهرات وألماس 💎', price: 890000, trend: '📈' }
};

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
      assets: { cars: 0, stocks: 0, lands: 0, trains: 0, phones: 0, planes: 0, stadiums: 0, yachts: 0, hotels: 0, islands: 0, ai_companies: 0, gold_mines: 0, nuclear: 0, spaceships: 0, fashion: 0, diamonds: 0 },
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

// محاكي السوق وتحديث الأسعار تلقائياً
function updateMarketPrices() {
  const data = readData();
  const now = Date.now();
  const lastUpdate = data.market.lastUpdate || 0;

  if (now - lastUpdate >= 30 * 60 * 1000) {
    for (const key in DEFAULT_MARKET_ASSETS) {
      if (!data.market.assets[key]) {
        data.market.assets[key] = { ...DEFAULT_MARKET_ASSETS[key] };
      }
      const currentPrice = data.market.assets[key].price;
      const changePercent = (Math.random() * 0.40) - 0.20; 
      let newPrice = Math.round(currentPrice * (1 + changePercent));
      if (newPrice < 1000) newPrice = 1000;

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

  // 🏛️ القائمة الرئيسية والأزرار
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
      new ButtonBuilder().setCustomId('btn_games').setLabel('🎰 الكازينو').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('btn_pets').setLabel('🐾 الحيوانات').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('btn_leaderboard').setLabel('🏆 الترتيب').setStyle(ButtonStyle.Secondary)
    );

    await message.reply({ embeds: [embed], components: [row1, row2, row3] });
    return;
  }

  // 📊 عرض السوق التفاعلي الموسع
  if (content === '!سوق') {
    const data = readData();
    const assets = data.market.assets;

    const embed = new EmbedBuilder()
      .setTitle('📈 البورصة العالمية والأسواق الكبرى')
      .setDescription('تتوفر عشرات التصنيفات الاستثمارية. يتم تحديث الأسعار تلقائياً[span_1](start_span)[span_1](end_span).\nللتداول الشراء: `!اشتري [الرمز] [الكمية]` | للبيع: `!بيع [الرمز] [الكمية]`')
      .setColor('#2b90d9');

    for (const key in assets) {
      const a = assets[key];
      embed.addFields({
        name: a.name + ' (`' + key + '`)',
        value: a.trend + ' **' + a.price.toLocaleString() + ' $**',
        inline: true
      });
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('buy_cars').setLabel('🚗 شراء سيارة').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('buy_stocks').setLabel('📊 شراء سهم').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('buy_lands').setLabel('🏙️ شراء أرض').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('market_refresh').setLabel('🔄 تحديث الأسعار').setStyle(ButtonStyle.Secondary)
    );

    await message.reply({ embeds: [embed], components: [row] });
    return;
  }

  // 🏢 المشاريع
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

  // شراء أصول السوق الموسعة
  if (content.startsWith('!اشتري') && !content.includes('رتبة') && !content.includes('حماية') && !content.includes('صندوق') && !content.includes('تذكرة')) {
    const args = content.split(' ');
    const key = args[1] ? args[1].toLowerCase() : '';
    const qty = parseInt(args[2]) || 1;

    const data = readData();
    if (!data.market.assets[key]) {
      await message.reply('❌ الرمز غير صحيح! رموز التصنيفات المتاحة:\n`cars`, `stocks`, `lands`, `trains`, `phones`, `planes`, `stadiums`, `yachts`, `hotels`, `islands`, `ai_companies`, `gold_mines`, `nuclear`, `spaceships`, `fashion`, `diamonds`');
      return;
    }

    const user = getUserData(userId);
    const asset = data.market.assets[key];
    const totalCost = asset.price * qty;

    if (user.balance < totalCost) {
      await message.reply('❌ رصيدك النقدي لا يكفي! التكلفة الإجمالية: **' + totalCost.toLocaleString() + '$**');
      return;
    }

    user.balance -= totalCost;
    if (!user.assets) user.assets = {};
    user.assets[key] = (user.assets[key] || 0) + qty;
    data.users[userId] = user;
    saveData(data);

    await message.reply('✅ اشتريت **' + qty + '** من **' + asset.name + '** بنجاح مقابل **' + totalCost.toLocaleString() + '$**!');
    return;
  }

  // بيع أصول السوق
  if (content.startsWith('!بيع')) {
    const args = content.split(' ');
    const key = args[1] ? args[1].toLowerCase() : '';
    const qty = parseInt(args[2]) || 1;

    const data = readData();
    if (!data.market.assets[key]) {
      await message.reply('❌ الرمز غير صحيح!');
      return;
    }

    const user = getUserData(userId);
    const owned = (user.assets && user.assets[key]) ? user.assets[key] : 0;

    if (owned < qty) {
      await message.reply('❌ لا تمتلك هذه الكمية للبيع! (الكمية المملوكة لديك: ' + owned + ')');
      return;
    }

    const asset = data.market.assets[key];
    const totalReturn = asset.price * qty;

    user.assets[key] -= qty;
    user.balance += totalReturn;
    data.users[userId] = user;
    saveData(data);

    await message.reply('✅ بعت **' + qty + '** من **' + asset.name + '** واستلمت **' + totalReturn.toLocaleString() + '$** بنجاح!');
    return;
  }

  // شراء مشروع
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

  // أرباح المشاريع
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

  // أوامر عامة سريعة
  if (content === '!حساب' || content === '!حسابي') {
    const user = getUserData(userId);
    await message.reply('💳 **رصيدك النقدي:** ' + user.balance.toLocaleString() + '$ \vert{} **البنك:** ' + user.bank.toLocaleString() + '$');
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
      desc += medal + ' <@' + u.id + '> — **' + u.total.toLocaleString() + '** $\n';
    });
    const embed = new EmbedBuilder().setTitle('🏆 أغنى اللاعبين').setDescription(desc || 'لا توجد بيانات').setColor('#f1c40f');
    await message.reply({ embeds: [embed] });
    return;
  }
});

// 🔘 معالج الأزرار التفاعلية المباشرة
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton()) return;
  const userId = interaction.user.id;
  const data = readData();
  const user = getUserData(userId);

  try {
    switch (interaction.customId) {
      case 'btn_account':
        await interaction.reply({
          content: '💳 **حسابك الشخصي:**\n• 💰 النقدي: **' + user.balance.toLocaleString() + '$**\n• 🏦 البنك: **' + user.bank.toLocaleString() + '$**',
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
        let txt = '📈 **الأسعار الحالية في البورصة الموسعة:**\n\n';
        for (const k in assets) {
          txt += assets[k].name + ' (`' + k + '`): ' + assets[k].trend + ' **' + assets[k].price.toLocaleString() + '$**\n';
        }
        txt += '\nللشراء اكتب: `!اشتري [الرمز] 1`';
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

      case 'buy_cars': {
        const asset = data.market.assets.cars;
        if (user.balance < asset.price) {
          await interaction.reply({ content: '❌ رصيدك لا يكفي لشراء سيارة (' + asset.price.toLocaleString() + '$)', ephemeral: true });
          return;
        }
        user.balance -= asset.price;
        user.assets.cars = (user.assets.cars || 0) + 1;
        data.users[userId] = user;
        saveData(data);
        await interaction.reply({ content: '✅ اشتريت سيارة 🚗 بنجاح بـ **' + asset.price.toLocaleString() + '$**!', ephemeral: true });
        break;
      }

      case 'buy_stocks': {
        const asset = data.market.assets.stocks;
        if (user.balance < asset.price) {
          await interaction.reply({ content: '❌ رصيدك لا يكفي لشراء سهم (' + asset.price.toLocaleString() + '$)', ephemeral: true });
          return;
        }
        user.balance -= asset.price;
        user.assets.stocks = (user.assets.stocks || 0) + 1;
        data.users[userId] = user;
        saveData(data);
        await interaction.reply({ content: '✅ اشتريت سهماً 📊 بنجاح بـ **' + asset.price.toLocaleString() + '$**!', ephemeral: true });
        break;
      }

      case 'buy_lands': {
        const asset = data.market.assets.lands;
        if (user.balance < asset.price) {
          await interaction.reply({ content: '❌ رصيدك لا يكفي لشراء أرض (' + asset.price.toLocaleString() + '$)', ephemeral: true });
          return;
        }
        user.balance -= asset.price;
        user.assets.lands = (user.assets.lands || 0) + 1;
        data.users[userId] = user;
        saveData(data);
        await interaction.reply({ content: '✅ اشتريت أرضاً 🏙️ بنجاح بـ **' + asset.price.toLocaleString() + '$**!', ephemeral: true });
        break;
      }

      case 'market_refresh': {
        await interaction.reply({ content: '🔄 الأسعار محدثة ومستمرة في البورصة العامة (`!سوق`).', ephemeral: true });
        break;
      }

      case 'btn_games':
        await interaction.reply({ content: '🎰 الألعاب: `!سلوتس [مبلغ]` | `!تخمين [1-10] [مبلغ]` | `!سباق [مبلغ]`', ephemeral: true });
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
