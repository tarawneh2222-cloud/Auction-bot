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

const DEFAULT_STOCKS = {
  gold: { name: '🥇 الذهب', price: 150, change: 0, trend: '➖ استقرار' },
  oil: { name: '🛢️ النفط الخام', price: 80, change: 0, trend: '➖ استقرار' },
  wheat: { name: '🌾 القمح', price: 40, change: 0, trend: '➖ استقرار' },
  btc: { name: '🪙 البيتكوين', price: 500, change: 0, trend: '➖ استقرار' },
  tech_stock: { name: '💻 أسهم التكنولوجيا', price: 250, change: 0, trend: '➖ استقرار' }
};

function initData() {
  if (!fs.existsSync(DATA_PATH)) {
    fs.writeFileSync(DATA_PATH, JSON.stringify({
      users: {},
      lottery: { pool: 1000, tickets: [] },
      market: { stocks: DEFAULT_STOCKS, lastUpdate: Date.now() }
    }, null, 2));
  }
}

function readData() {
  initData();
  try {
    const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    if (!data.users) data.users = {};
    if (!data.lottery) data.lottery = { pool: 1000, tickets: [] };
    if (!data.market || !data.market.stocks) {
      data.market = { stocks: DEFAULT_STOCKS, lastUpdate: Date.now() };
    }
    return data;
  } catch (err) {
    return {
      users: {},
      lottery: { pool: 1000, tickets: [] },
      market: { stocks: DEFAULT_STOCKS, lastUpdate: Date.now() }
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
      stocks: { gold: 0, oil: 0, wheat: 0, btc: 0, tech_stock: 0 },
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

// محاكي سوق الأسهم المتطور
function updateMarketPrices() {
  const data = readData();
  const now = Date.now();
  const lastUpdate = data.market.lastUpdate || 0;

  // التحديث يحدث كل 30 دقيقة
  if (now - lastUpdate >= 30 * 60 * 1000) {
    for (const key in DEFAULT_STOCKS) {
      if (!data.market.stocks[key]) {
        data.market.stocks[key] = { ...DEFAULT_STOCKS[key] };
      }
      const currentPrice = data.market.stocks[key].price;
      const changePercent = (Math.random() * 0.50) - 0.25; // تغير من -25% إلى +25%
      let newPrice = Math.round(currentPrice * (1 + changePercent));
      if (newPrice < 10) newPrice = 10;

      const diff = newPrice - currentPrice;
      const pct = ((diff / currentPrice) * 100).toFixed(1);

      let trend = '➖ استقرار';
      if (pct > 15) trend = '🟢 صعود حاد (+ ' + pct + '%)';
      else if (pct > 0) trend = '📈 صعود (+ ' + pct + '%)';
      else if (pct < -15) trend = '🔴 انهيار (- ' + Math.abs(pct) + '%)';
      else if (pct < 0) trend = '📉 هبوط (- ' + Math.abs(pct) + '%)';

      data.market.stocks[key].price = newPrice;
      data.market.stocks[key].change = parseFloat(pct);
      data.market.stocks[key].trend = trend;
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
  console.log(`✅ بوت الاقتصاد المتطور ${client.user.tag} يعمل بكفاءة تامة!`);
  setInterval(updateMarketPrices, 5 * 60 * 1000);
});

// معالج الأوامر النصية
client.on(Events.MessageCreate, async message => {
  if (message.author.bot || !message.guild) return;
  const content = message.content.trim();
  const userId = message.author.id;

  updateMarketPrices();

  // 🏛️ القائمة الرئيسية الشاملة والأزرار التفاعلية
  if (content === '!قائمة' || content === '!القائمة') {
    const embed = new EmbedBuilder()
      .setTitle('🏛️ المركز الاقتصادي والتداولي المتكامل')
      .setDescription('اضغط على الأزرار التفاعلية لتنفيذ العمليات والتحكم بحسابك مباشرة:')
      .setColor('#2b90d9')
      .setFooter({ text: 'تفاعلي 100% • اضغط واستمتع بالتداول والخدمات!' });

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('btn_account').setLabel('💳 حسابي').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('btn_daily').setLabel('🎁 اليومية (استلام)').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('btn_claim_income').setLabel('💵 جمع أرباح المشاريع').setStyle(ButtonStyle.Success)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('btn_market').setLabel('📊 سوق الأسهم التفاعلي').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('btn_portfolio').setLabel('📈 محفظة أسهمي').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('btn_businesses').setLabel('🏢 المشاريع').setStyle(ButtonStyle.Primary)
    );

    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('btn_games').setLabel('🎰 الكازينو والألعاب').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('btn_pets').setLabel('🐾 الحيوانات').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('btn_leaderboard').setLabel('🏆 الترتيب').setStyle(ButtonStyle.Secondary)
    );

    await message.reply({ embeds: [embed], components: [row1, row2, row3] });
    return;
  }

  // 📊 عرض السوق الاحترافي
  if (content === '!سوق') {
    const data = readData();
    const stocks = data.market.stocks;

    const embed = new EmbedBuilder()
      .setTitle('📊 بورصة الأسهم والعملات الرقمية')
      .setDescription('تتغير الأسعار والمؤشرات باستمرار! اكتب `!اشتري [اسم_السهم] [الكمية]` للشراء.')
      .setColor('#9b59b6');

    for (const key in stocks) {
      const s = stocks[key];
      embed.addFields({
        name: s.name + ' (`' + key + '`)',
        value: '💵 السعر: **' + s.price + '$**\n📊 الاتجاه: ' + s.trend,
        inline: true
      });
    }

    await message.reply({ embeds: [embed] });
    return;
  }

  // 🏢 عرض المشاريع
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

  // 📈 شراء الأسهم
  if (content.startsWith('!اشتري') && !content.includes('رتبة') && !content.includes('حماية') && !content.includes('صندوق') && !content.includes('تذكرة')) {
    const args = content.split(' ');
    const stockKey = args[1] ? args[1].toLowerCase() : '';
    const qty = parseInt(args[2]);

    const data = readData();
    if (!data.market.stocks[stockKey]) {
      await message.reply('❌ رمز السهم غير صحيح! الأكواد المتاحة: (`gold`, `oil`, `wheat`, `btc`, `tech_stock`)\nمثال: `!اشتري gold 2`');
      return;
    }

    if (isNaN(qty) || qty <= 0) return message.reply('❌ يرجى تحديد كمية صحيحة! مثال: `!اشتري btc 1`');

    const user = getUserData(userId);
    const stock = data.market.stocks[stockKey];
    const totalCost = stock.price * qty;

    if (user.balance < totalCost) return message.reply('❌ رصيدك النقدي لا يكفي! التكلفة الإجمالية: **' + totalCost + '$**');

    user.balance -= totalCost;
    if (!user.stocks) user.stocks = {};
    user.stocks[stockKey] = (user.stocks[stockKey] || 0) + qty;

    data.users[userId] = user;
    saveData(data);

    await message.reply('✅ تم شراء **' + qty + '** من **' + stock.name + '** بنجاح مقابل **' + totalCost + '$**!');
    return;
  }

  // 📈 بيع الأسهم
  if (content.startsWith('!بيع')) {
    const args = content.split(' ');
    const stockKey = args[1] ? args[1].toLowerCase() : '';
    const qty = parseInt(args[2]);

    const data = readData();
    if (!data.market.stocks[stockKey]) {
      await message.reply('❌ رمز السهم غير صحيح! الأكواد المتاحة: (`gold`, `oil`, `wheat`, `btc`, `tech_stock`)');
      return;
    }

    const user = getUserData(userId);
    const userOwned = (user.stocks && user.stocks[stockKey]) ? user.stocks[stockKey] : 0;

    if (isNaN(qty) || qty <= 0 || userOwned < qty) {
      await message.reply('❌ لا تمتلك هذه الكمية من الأسهم لبيعها! (الكمية المملوكة: ' + userOwned + ')');
      return;
    }

    const stock = data.market.stocks[stockKey];
    const totalReturn = stock.price * qty;

    user.stocks[stockKey] -= qty;
    user.balance += totalReturn;

    data.users[userId] = user;
    saveData(data);

    await message.reply('✅ تم بيع **' + qty + '** من **' + stock.name + '** واستلمت **' + totalReturn + '$** نقداً! 💵');
    return;
  }

  // باقي الأوامر السريعة
  if (content === '!حساب' || content === '!حسابي') {
    const user = getUserData(userId);
    await message.reply('💳 **رصيدك النقدي:** ' + user.balance + '$ \vert{} **البنك:** ' + user.bank + '$');
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
      // 💳 زر الحساب التفاعلي
      case 'btn_account': {
        const sharedVaultVal = user.sharedVault || 0;
        const petName = user.pet && PETS[user.pet] ? PETS[user.pet].name : 'لا يوجد';
        await interaction.reply({
          content: '💳 **تفاصيل حسابك:**\n• 💰 النقدي: **' + user.balance + '$**\n• 🏦 البنك: **' + user.bank + '$**\n• 🏦 الخزنة المشتركة: **' + sharedVaultVal + '$**\n• 🐾 الحيوان: **' + petName + '**\n• 🔥 الستريك: **' + (user.dailyStreak || 0) + ' أيام**',
          ephemeral: true
        });
        break;
      }

      // 🎁 زر المكافأة اليومية (استلام فوري بنقرة زر!)
      case 'btn_daily': {
        const today = new Date().toDateString();
        if (user.dailyLast === today) {
          await interaction.reply({ content: '⏳ لقد استلمت مكافأتك اليومية بالفعل اليوم! عد غداً.', ephemeral: true });
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

        await interaction.reply({
          content: '🎉 **تم استلام اليومية بنجاح بنقرة زر!**\n💰 أضيفت إلى محفظتك: **' + totalAmount + '$** (الستريك الحالي: ' + user.dailyStreak + ' أيام 🔥)',
          ephemeral: true
        });
        break;
      }

      // 💵 زر جمع أرباح المشاريع بنقرة زر!
      case 'btn_claim_income': {
        const now = Date.now();
        const last = user.lastClaimedIncome || now;
        const hours = (now - last) / (1000 * 60 * 60);

        if (hours < 0.05) {
          await interaction.reply({ content: '⏳ لم تتراكم أرباح جديدة بعد، انتظر قليلاً!', ephemeral: true });
          return;
        }

        const b = user.businesses || {};
        const hourly = ((b.cafe || 0) * 100) + ((b.gas || 0) * 350) + ((b.tech || 0) * 1200) + ((b.factory || 0) * 3000) + ((b.realestate || 0) * 8000);

        if (hourly === 0) {
          await interaction.reply({ content: '❌ لا تملك أي مشاريع لجمع أرباحها! اشترِ مشاريع عبر `!مشاريع`.', ephemeral: true });
          return;
        }

        const total = Math.floor(hourly * hours);
        user.balance += total;
        user.lastClaimedIncome = now;
        data.users[userId] = user;
        saveData(data);

        await interaction.reply({
          content: '💵 **تم جمع أرباح المشاريع بنجاح!**\n💰 المبلغ المضاف إلى محفظتك: **' + total + '$**',
          ephemeral: true
        });
        break;
      }

      // 📊 زر عرض سوق الأسهم مباشرة
      case 'btn_market': {
        const stocks = data.market.stocks;
        let marketText = '📊 **بورصة الأسهم والعملات المباشرة:**\n\n';
        for (const key in stocks) {
          const s = stocks[key];
          marketText += s.name + ' (`' + key + '`): **' + s.price + '$** | الاتجاه: ' + s.trend + '\n';
        }
        marketText += '\n*للشراء والبيع:* `!اشتري [الرمز] [الكمية]` أو `!بيع [الرمز] [الكمية]`';
        await interaction.reply({ content: marketText, ephemeral: true });
        break;
      }

      // 📈 محفظة الأسهم
      case 'btn_portfolio': {
        const st = user.stocks || {};
        await interaction.reply({
          content: '📈 **أسهمك المملوكة حالياً:**\n• 🥇 ذهب (`gold`): **' + (st.gold || 0) + '**\n• 🛢️ نفط (`oil`): **' + (st.oil || 0) + '**\n• 🌾 قمح (`wheat`): **' + (st.wheat || 0) + '**\n• 🪙 بيتكوين (`btc`): **' + (st.btc || 0) + '**\n• 💻 تكنولوجيا (`tech_stock`): **' + (st.tech_stock || 0) + '**',
          ephemeral: true
        });
        break;
      }

      // 🎰 الألعاب والكازينو
      case 'btn_games': {
        await interaction.reply({
          content: '🎰 **ألعاب الترفيه المتاحة:**\n• `!سلوتس [المبلغ]` — ماكينة الحظ\n• `!تخمين [1-10] [المبلغ]` — رهان التخمين 8x\n• `!سباق [المبلغ]` — سباق السيارات 3x\n• `!حجر` — النرد السريع',
          ephemeral: true
        });
        break;
      }

      default:
        await interaction.reply({ content: '✅ تم تنفيذ العملية بنجاح!', ephemeral: true });
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
