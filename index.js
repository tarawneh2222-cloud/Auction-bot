'use strict';

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

// ========== إعداد الخادم ==========
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (_req, res) => {
  res.status(200).send('✅ سوق الأسهم والاقتصاد 📈');
});

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, '0.0.0.0', () => console.log(`🌐 الخادم يعمل على المنفذ ${PORT}`));

// ========== إعداد البوت ==========
const TOKEN = process.env.DISCORD_TOKEN;

if (!TOKEN) {
  console.error('❌ خطأ: متغير البيئة DISCORD_TOKEN غير موجود');
  process.exit(1);
}

const ADMIN_IDS = ['949062518213599332'];

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// ========== إدارة البيانات ==========
const DATA_FILE = path.join(__dirname, 'data.json');
let data = { 
  users: {}, 
  lotteries: {},
  stocks: {},
  transactions: [],
  challenges: {},
  achievements: {}
};

// === الشركات والأسهم الافتراضية ===
const DEFAULT_STOCKS = {
  'تك': { name: 'تقنية العربية', price: 100.00, change: 0, volatility: 0.02, icon: '💻' },
  'بنك': { name: 'بنك الأمان', price: 80.00, change: 0, volatility: 0.015, icon: '🏦' },
  'طاقة': { name: 'شركة الطاقة المتكاملة', price: 120.00, change: 0, volatility: 0.025, icon: '⚡' },
  'غذاء': { name: 'الغذاء الوطني', price: 65.00, change: 0, volatility: 0.012, icon: '🍎' },
  'عقار': { name: 'العقار والاستثمار', price: 95.00, change: 0, volatility: 0.03, icon: '🏢' },
  'ذهب': { name: 'معدن الذهب', price: 200.00, change: 0, volatility: 0.01, icon: '🥇' },
  'سيارة': { name: 'الشركة للسيارات', price: 55.00, change: 0, volatility: 0.04, icon: '🚗' }
};

// === التحديات اليومية والأسبوعية ===
const DEFAULT_CHALLENGES = {
  daily: [
    { id: 'trade1', name: 'متداول نشط', desc: 'أكمل صفقة شراء أو بيع واحدة', target: 1, reward: 30, type: 'trades' },
    { id: 'save1', name: 'مدخر ذكي', desc: 'أودع 100 دينار في البنك', target: 100, reward: 20, type: 'deposit' },
    { id: 'play1', name: 'محب الألعاب', desc: 'العب لعبة واحدة', target: 1, reward: 15, type: 'games' }
  ],
  weekly: [
    { id: 'profit1', name: 'مستثمر ناجح', desc: 'حقق ربحاً من الأسهم', target: 500, reward: 200, type: 'profit' },
    { id: 'rich1', name: 'طريق الثراء', desc: 'امتلك 5000 دينار كأصول', target: 5000, reward: 150, type: 'networth' }
  ]
};

// === الإنجازات ===
const ACHIEVEMENTS_LIST = {
  firstTrade: { name: 'أول صفقة', desc: 'أكمل أول عملية شراء', icon: '🎯', reward: 50 },
  rich1000: { name: 'بداية الثراء', desc: 'امتلك 1000 دينار', icon: '💰', reward: 100 },
  rich10000: { name: 'ثري جداً', desc: 'امتلك 10,000 دينار', icon: '👑', reward: 500 },
  investor: { name: 'مستثمر محترف', desc: 'امتلك أسهماً في 3 شركات مختلفة', icon: '📊', reward: 150 },
  trader10: { name: 'متداول نشط', desc: 'أكمل 10 صفقات', icon: '📈', reward: 100 },
  winner5: { name: 'محظوظ', desc: 'اربح 5 مرات في الألعاب', icon: '🏆', reward: 80 }
};

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const saved = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      data.users = saved.users || {};
      data.lotteries = saved.lotteries || {};
      data.stocks = saved.stocks || JSON.parse(JSON.stringify(DEFAULT_STOCKS));
      data.transactions = saved.transactions || [];
      data.challenges = saved.challenges || { daily: {}, weekly: {}, resetDate: Date.now() };
      data.achievements = saved.achievements || {};
      console.log('✅ تم تحميل البيانات بنجاح');
    } else {
      data = { 
        users: {}, 
        lotteries: {}, 
        stocks: JSON.parse(JSON.stringify(DEFAULT_STOCKS)),
        transactions: [],
        challenges: { daily: {}, weekly: {}, resetDate: Date.now() },
        achievements: {}
      };
      saveData();
      console.log('📄 تم إنشاء ملف بيانات جديد');
    }
  } catch (e) {
    console.error('⚠️ خطأ تحميل البيانات:', e.message);
    data = { 
      users: {}, 
      lotteries: {}, 
      stocks: JSON.parse(JSON.stringify(DEFAULT_STOCKS)),
      transactions: [],
      challenges: { daily: {}, weekly: {}, resetDate: Date.now() },
      achievements: {}
    };
  }
}

function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('⚠️ خطأ حفظ البيانات:', e.message);
  }
}

function ensureUser(userId) {
  if (!data.users[userId]) {
    data.users[userId] = {
      balance: 1000,
      bank: 0,
      portfolio: {},
      stats: { trades: 0, games: 0, gamesWon: 0, deposit: 0, totalProfit: 0 },
      lastDaily: 0,
      lastWork: 0,
      lastRob: 0,
      lastCrime: 0,
      streak: 0,
      lotteryTickets: 0,
      unlockedAchievements: [],
      createdAt: Date.now()
    };
  }
  if (!data.users[userId].portfolio) data.users[userId].portfolio = {};
  if (!data.users[userId].stats) {
    data.users[userId].stats = { trades: 0, games: 0, gamesWon: 0, deposit: 0, totalProfit: 0 };
  }
  if (!data.users[userId].unlockedAchievements) {
    data.users[userId].unlockedAchievements = [];
  }
  return data.users[userId];
}

function recordTransaction(type, symbol, amount, price, userId) {
  data.transactions.push({
    type, symbol, amount, price, userId,
    total: amount * price,
    time: Date.now()
  });
  if (data.transactions.length > 1000) data.transactions.shift();
  const user = ensureUser(userId);
  user.stats.trades++;
  checkAchievements(userId);
  saveData();
}

// ========== تحديث أسعار الأسهم تلقائياً ==========
function updateStockPrices() {
  for (const [symbol, stock] of Object.entries(data.stocks)) {
    const change = (Math.random() - 0.5) * 2 * stock.volatility * stock.price;
    stock.price = Math.max(10, Math.round((stock.price + change) * 100) / 100);
    stock.change = Math.round((change / stock.price) * 10000) / 100;
  }
  saveData();
}

setInterval(updateStockPrices, 5 * 60 * 1000); // كل 5 دقائق

// ========== نظام التحديات والإنجازات ==========
function resetChallengesIfNeeded() {
  const now = new Date();
  const lastReset = new Date(data.challenges.resetDate);
  if (now.toDateString() !== lastReset.toDateString()) {
    data.challenges.daily = {};
    data.challenges.resetDate = Date.now();
    console.log('🔄 تم تحديث التحديات اليومية');
    saveData();
  }
}

function checkAchievements(userId) {
  const user = ensureUser(userId);
  const netWorth = user.balance + user.bank + calculatePortfolioValue(userId);
  
  // أول صفقة
  if (user.stats.trades >= 1 && !user.unlockedAchievements.includes('firstTrade')) {
    unlockAchievement(userId, 'firstTrade');
  }
  // 1000 دينار
  if (netWorth >= 1000 && !user.unlockedAchievements.includes('rich1000')) {
    unlockAchievement(userId, 'rich1000');
  }
  // 10,000 دينار
  if (netWorth >= 10000 && !user.unlockedAchievements.includes('rich10000')) {
    unlockAchievement(userId, 'rich10000');
  }
  // 3 شركات مختلفة
  if (Object.keys(user.portfolio).length >= 3 && !user.unlockedAchievements.includes('investor')) {
    unlockAchievement(userId, 'investor');
  }
  // 10 صفقات
  if (user.stats.trades >= 10 && !user.unlockedAchievements.includes('trader10')) {
    unlockAchievement(userId, 'trader10');
  }
  // 5 انتصارات
  if (user.stats.gamesWon >= 5 && !user.unlockedAchievements.includes('winner5')) {
    unlockAchievement(userId, 'winner5');
  }
}

function unlockAchievement(userId, achId) {
  const user = ensureUser(userId);
  const ach = ACHIEVEMENTS_LIST[achId];
  if (!ach || user.unlockedAchievements.includes(achId)) return;
  
  user.unlockedAchievements.push(achId);
  user.balance += ach.reward;
  console.log(`🏆 إنجاز جديد: ${ach.name} لـ ${userId}`);
  saveData();
}

function calculatePortfolioValue(userId) {
  const user = ensureUser(userId);
  let total = 0;
  for (const [sym, qty] of Object.entries(user.portfolio)) {
    const stock = data.stocks[sym];
    if (stock) total += stock.price * qty;
  }
  return total;
}

// ========== الإعدادات ==========
const MAX_MONEY = 1_000_000;
const DAILY_AMOUNT = 100;
const WORK_MIN = 30;
const WORK_MAX = 80;
const ROB_COOLDOWN = 60 * 60 * 1000;
const ROB_CHANCE = 0.4;
const ROB_MIN_TARGET = 100;
const DAILY_COOLDOWN = 24 * 60 * 60 * 1000;
const WORK_COOLDOWN = 5 * 60 * 1000;
const CRIME_COOLDOWN = 10 * 60 * 1000;
const LOTTERY_TICKET_PRICE = 15;
const LOTTERY_DRAW_TIME = 60 * 60 * 1000;

// ========== نظام اليانصيب ==========
function initLottery() {
  if (!data.lotteries) data.lotteries = {};
  if (!data.lotteries.current) {
    data.lotteries.current = {
      participants: [],
      pot: 0,
      createdAt: Date.now()
    };
  }
}

async function drawLottery() {
  initLottery();
  const lottery = data.lotteries.current;
  if (lottery.participants.length === 0) {
    console.log('🎫 لا يوجد مشاركون');
    lottery.createdAt = Date.now();
    saveData();
    return;
  }
  const winnerId = lottery.participants[Math.floor(Math.random() * lottery.participants.length)];
  const prize = lottery.pot;
  const winner = ensureUser(winnerId);
  winner.balance = Math.min(MAX_MONEY, winner.balance + prize);
  console.log(`🎫 سحب — الفائز: ${winnerId} | الجائزة: ${prize}`);
  data.lotteries.current = { participants: [], pot: 0, createdAt: Date.now() };
  saveData();
}

setInterval(drawLottery, LOTTERY_DRAW_TIME);

// ========== القائمة الرئيسية ==========
if (['!قائمة', '!الرئيسية', '!بداية'].includes(cmd)) {
    await sendMainMenu(message.channel);
    return;
  }
async function sendMainMenu(channel) {
  resetChallengesIfNeeded();
  const embed = new EmbedBuilder()
    .setColor('#3498db')
    .setTitle('🏦 سوق الاستثمار والاقتصاد')
    .setDescription('اختر ما تريد القيام به:');

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('account').setLabel('حسابي').setStyle(ButtonStyle.Primary).setEmoji('💳'),
    new ButtonBuilder().setCustomId('portfolio').setLabel('محفظتي').setStyle(ButtonStyle.Success).setEmoji('📊'),
    new ButtonBuilder().setCustomId('stocks').setLabel('سوق الأسهم').setStyle(ButtonStyle.Primary).setEmoji('📈')
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('challenges').setLabel('التحديات').setStyle(ButtonStyle.Success).setEmoji('🎯'),
    new ButtonBuilder().setCustomId('achievements').setLabel('الإنجازات').setStyle(ButtonStyle.Grey).setEmoji('🏆'),
    new ButtonBuilder().setCustomId('bank').setLabel('البنك').setStyle(ButtonStyle.Secondary).setEmoji('🏛️')
  );
  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('daily').setLabel('يومي').setStyle(ButtonStyle.Success).setEmoji('🎁'),
    new ButtonBuilder().setCustomId('games').setLabel('الألعاب').setStyle(ButtonStyle.Danger).setEmoji('🎮'),
    new ButtonBuilder().setCustomId('help').setLabel('المساعدة').setStyle(ButtonStyle.Secondary).setEmoji('❓')
  );

  await channel.send({ embeds: [embed], components: [row1, row2, row3] });
}

// ========== معالجة الأزرار ==========
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton()) return;
  const userId = interaction.user.id;
  const user = ensureUser(userId);
  const now = Date.now();

  try {
    switch (interaction.customId) {
      case 'account': {
        const portfolioVal = calculatePortfolioValue(userId);
        const totalAssets = user.balance + user.bank + portfolioVal;
        const embed = new EmbedBuilder()
          .setColor('#3498db')
          .setTitle('💳 حسابي')
          .addFields(
            { name: '💰 نقدي', value: `${user.balance} دينار`, inline: true },
            { name: '🏦 بالبنك', value: `${user.bank} دينار`, inline: true },
            { name: '📈 الأسهم', value: `${portfolioVal.toFixed(0)} دينار`, inline: true },
            { name: '💎 إجمالي الأصول', value: `${totalAssets.toFixed(0)} دينار`, inline: true },
            { name: '📊 الصفقات', value: `${user.stats.trades} عملية`, inline: true },
            { name: '🏆 الإنجازات', value: `${user.unlockedAchievements.length}/${Object.keys(ACHIEVEMENTS_LIST).length}`, inline: true }
          );
        await interaction.reply({ embeds: [embed], ephemeral: false });
        break;
      }

      case 'portfolio': {
        let desc = '📦 محفظة أسهمك:\n\n';
        const portfolioVal = calculatePortfolioValue(userId);
        
        if (Object.keys(user.portfolio).length === 0) {
          desc += 'محفظتك فارغة!\nاستخدم `!سوق` لمعرفة الأسهم المتاحة\nاستخدم `!شراء رمز الكمية` للشراء 📈';
        } else {
          for (const [sym, qty] of Object.entries(user.portfolio)) {
            const stock = data.stocks[sym];
            if (stock) {
              const value = stock.price * qty;
              desc += `**${stock.icon} ${sym} — ${stock.name}**\nكمية: ${qty} سهم | السعر: ${stock.price.toFixed(2)} دينار\nالقيمة: ${value.toFixed(2)} دينار\n\n`;
            }
          }
          desc += `━━━━━━━━━━━━━━━\n💰 القيمة الإجمالية: **${portfolioVal.toFixed(2)} دينار**`;
        }
        desc += '\n🛒 للشراء: `!شراء رمز الكمية`\n💰 للبيع: `!بيع رمز الكمية`';
        
        const embed = new EmbedBuilder()
          .setColor('#2ecc71')
          .setTitle('📊 محفظة الاستثمار')
          .setDescription(desc);
        await interaction.reply({ embeds: [embed], ephemeral: false });
        break;
      }

      case 'stocks': {
        let desc = '📈 أسعار الأسهم الحالية:\n\n';
        for (const [sym, stock] of Object.entries(data.stocks)) {
          const arrow = stock.change >= 0 ? '📈' : '📉';
          desc += `${stock.icon} **${sym}** — ${stock.name}\nالسعر: **${stock.price.toFixed(2)} دينار** | التغير: ${arrow} ${stock.change >= 0 ? '+' : ''}${stock.change}%\n\n`;
        }
        desc += '━━━━━━━━━━━━━━━\n🛒 `!شراء رمز الكمية` — مثال: `!شراء تك 10`\n💰 `!بيع رمز الكمية` — مثال: `!بيع تك 5`';
        
        const embed = new EmbedBuilder()
          .setColor('#3498db')
          .setTitle('📊 سوق الأسهم')
          .setDescription(desc)
          .setFooter({ text: 'تحديث كل 5 دقائق' });
        await interaction.reply({ embeds: [embed], ephemeral: false });
        break;
      }

      case 'challenges': {
        resetChallengesIfNeeded();
        let desc = '🎯 **التحديات اليومية:**\n\n';
        for (const ch of DEFAULT_CHALLENGES.daily) {
          const progress = data.challenges.daily[ch.id] || 0;
          const done = progress >= ch.target ? '✅' : '⬜';
          desc += `${done} **${ch.name}**\n${ch.desc}\nالمكافأة: ${ch.reward} دينار\n\n`;
        }
        desc += '━━━━━━━━━━━━━━━\n⏱️ تتجدد التحديات كل يوم منتصف الليل';
        
        const embed = new EmbedBuilder()
          .setColor('#e74c3c')
          .setTitle('🎯 التحديات')
          .setDescription(desc);
        await interaction.reply({ embeds: [embed], ephemeral: false });
        break;
      }

      case 'achievements': {
        let desc = '🏆 إنجازاتك:\n\n';
        for (const [id, ach] of Object.entries(ACHIEVEMENTS_LIST)) {
          const unlocked = user.unlockedAchievements.includes(id);
          desc += `${unlocked ? '✅' : '⬜'} ${ach.icon} **${ach.name}**\n${ach.desc} | +${ach.reward} دينار\n\n`;
        }
        const embed = new EmbedBuilder()
          .setColor('#f1c40f')
          .setTitle('🏆 سجل الإنجازات')
          .setDescription(desc);
        await interaction.reply({ embeds: [embed], ephemeral: false });
        break;
      }

      case 'bank': {
        const embed = new EmbedBuilder()
          .setColor('#9b59b6')
          .setTitle('🏛️ البنك')
          .setDescription('إيداع وسحب أموالك بأمان')
          .addFields(
            { name: '💰 في الجيب', value: `${user.balance} دينار`, inline: true },
            { name: '🏦 في البنك', value: `${user.bank} دينار`, inline: true }
          )
          .setFooter({ text: '!إيداع مبلغ | !سحب مبلغ' });
        await interaction.reply({ embeds: [embed], ephemeral: false });
        break;
      }

      case 'daily': {
        if (now - user.lastDaily >= DAILY_COOLDOWN) {
          user.streak = user.lastDaily && now - user.lastDaily < DAILY_COOLDOWN + 6 * 60 * 60 * 1000 
            ? (user.streak || 0) + 1 : 1;
          const bonus = Math.floor(DAILY_AMOUNT * (1 + Math.min(user.streak * 0.1, 0.5)));
          user.lastDaily = now;
          user.balance += bonus;
          data.challenges.daily.save1 = (data.challenges.daily.save1 || 0) + bonus;
          checkAchievements(userId);
          saveData();
          
          const embed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle('🎁 المكافأة اليومية')
            .setDescription(`✅ حصلت على **${bonus} دينار**!\n🔥 سلسلتك: **${user.streak} يوم متتالي**`);
          await interaction.reply({ embeds: [embed], ephemeral: false });
        } else {
          const h = Math.floor((DAILY_COOLDOWN - (now - user.lastDaily)) / 3600000);
          const m = Math.floor(((DAILY_COOLDOWN - (now - user.lastDaily)) % 3600000) / 60000);
          const embed = new EmbedBuilder()
            .setColor('#f39c12')
            .setTitle('⏳ انتظر')
            .setDescription(`عود بعد **${h} ساعة و ${m} دقيقة**`);
          await interaction.reply({ embeds: [embed], ephemeral: true });
        }
        break;
      }

      case 'games': {
        const embed = new EmbedBuilder()
          .setColor('#9b59b6')
          .setTitle('🎮 صالة الألعاب')
          .setDescription('ألعاب ممتعة لكسب المال 🎉')
          .addFields(
            { name: '🎲 النرد', value: '!نرد المبلغ', inline: true },
            { name: '🔢 تخمين', value: '!تخمين المبلغ', inline: true },
            { name: '✊ حجر ورق مقص', value: '!حجر المبلغ', inline: true },
            { name: '🪙 عملة', value: '!عملة المبلغ وجه', inline: true },
            { name: '🎣 صيد', value: '!صيد', inline: true },
            { name: '⛏️ تنقيب', value: '!تنقيب', inline: true }
          );
        await interaction.reply({ embeds: [embed], ephemeral: false });
        break;
      }

      case 'help': {
        const embed = new EmbedBuilder()
          .setColor('#95a5a6')
          .setTitle('📖 دليل الأوامر الكامل')
          .addFields(
            { name: '📊 الأسهم والتداول', value: '`!سوق` — عرض الأسعار\n`!شراء رمز الكمية` — شراء أسهم\n`!بيع رمز الكمية` — بيع أسهم\n`!محفظة` — عرض محفظتك', inline: false },
            { name: '🏦 المالية', value: '`!إيداع مبلغ` — إيداع في البنك\n`!سحب مبلغ` — سحب من البنك\n`!حساب` — عرض حسابك', inline: false },
            { name: '🎁 يومي', value: '`!يومي` — مكافأة يومية\n`!عمل` — العمل كل 5 دقائق', inline: false },
            { name: '🎫 اليانصيب', value: '`!تذكرة` — شراء تذكرة يانصيب', inline: false },
            { name: '🏆 التحديات', value: '`!تحديات` — عرض تحدياتك اليومية\n`!إنجازات` — عرض إنجازاتك', inline: false }
          );
        await interaction.reply({ embeds: [embed], ephemeral: false });
        break;
      }
    }
  } catch (e) {
    console.error('❌ خطأ زر:', e);
    await interaction.reply({ content: '⚠️ حدث خطأ', ephemeral: true });
  }
  saveData();
});

// ========== معالجة الأوامر النصية ==========
client.on(Events.MessageCreate, async message => {
  if (message.author.bot || !message.guild) return;
  
  const content = message.content.trim();
  const args = content.split(/\s+/);
  const cmd = args[0].toLowerCase();
  const userId = message.author.id;
  const user = ensureUser(userId);
  const now = Date.now();
  resetChallengesIfNeeded();

  // === القائمة الرئيسية ===
  if (['!قائمة', '!الرئيسية', '!بداية'].includes(cmd)) {
    await sendMainMenu(message.channel);
    return;
  }

  // === سوق الأسهم ===
  if (cmd === '!سوق' || cmd === '!اسهم') {
    let desc = '📈 أسعار الأسهم الحالية:\n\n';
    for (const [sym, stock] of Object.entries(data.stocks)) {
      const arrow = stock.change >= 0 ? '📈' : '📉';
      desc += `${stock.icon} **${sym}** — ${stock.name}\nالسعر: **${stock.price.toFixed(2)} دينار** | ${arrow} ${stock.change >= 0 ? '+' : ''}${stock.change}%\n\n`;
    }
    desc += '🛒 `!شراء رمز الكمية` | 💰 `!بيع رمز الكمية`';
    await message.reply(desc);
    return;
  }

  // === شراء أسهم ===
  if (cmd === '!شراء') {
    const symbol = (args[1] || '').toLowerCase();
    const quantity = parseInt(args[2]);
    const stock = data.stocks[symbol];
    
    if (!stock) {
      await message.reply('❌ رمز سهم غير صالح. استخدم `!سوق` لمعرفة الرموز المتاحة');
      return;
    }
    if (isNaN(quantity) || quantity <= 0) {
      await message.reply('❌ استخدم: `!شراء تك 10`');
      return;
    }
    
    const totalCost = stock.price * quantity;
    if (user.balance < totalCost) {
      await message.reply(`❌ رصيد غير كافي\nالمطلوب: ${totalCost.toFixed(2)} دينار\nمتاح: ${user.balance} دينار`);
      return;
    }
    
    user.balance -= totalCost;
    user.portfolio[symbol] = (user.portfolio[symbol] || 0) + quantity;
    recordTransaction('buy', symbol, quantity, stock.price, userId);
    data.challenges.daily.trade1 = (data.challenges.daily.trade1 || 0) + 1;
    
    await message.reply(`✅ تم الشراء بنجاح!\n🛒 اشتريت: ${quantity} سهم من ${stock.name}\n💰 التكلفة: ${totalCost.toFixed(2)} دينار\n📊 السعر الحالي: ${stock.price.toFixed(2)} دينار`);
    return;
  }

  // === بيع أسهم ===
  if (cmd === '!بيع') {
    const symbol = (args[1] || '').toLowerCase();
    const quantity = parseInt(args[2]);
    const stock = data.stocks[symbol];
    
    if (!stock) {
      await message.reply('❌ رمز سهم غير صالح');
      return;
    }
    if (!user.portfolio[symbol] || user.portfolio[symbol] < quantity) {
      await message.reply(`❌ لا تمتلك كمية كافية\nلديك: ${user.portfolio[symbol] || 0} سهم من ${symbol}`);
      return;
    }
    if (isNaN(quantity) || quantity <= 0) {
      await message.reply('❌ استخدم: `!بيع تك 5`');
      return;
    }
    
    const totalGain = stock.price * quantity;
    const oldQty = user.portfolio[symbol];
    delete user.portfolio[symbol];
    if (oldQty > quantity) user.portfolio[symbol] = oldQty - quantity;
    user.balance += totalGain;
    recordTransaction('sell', symbol, quantity, stock.price, userId);
    
    await message.reply(`✅ تم البيع بنجاح!\n💰 بعت: ${quantity} سهم من ${stock.name}\n📈 الإيراد: ${totalGain.toFixed(2)} دينار`);
    return;
  }

  // === عرض المحفظة ===
  if (cmd === '!محفظة' || cmd === '!اسهمي') {
    let desc = '📦 محفظتك:\n\n';
    const portfolioVal = calculatePortfolioValue(userId);
    
    if (Object.keys(user.portfolio).length === 0) {
      desc += 'محفظتك فارغة! استخدم `!سوق` لبدء التداول 📈';
    } else {
      for (const [sym, qty] of Object.entries(user.portfolio)) {
        const stock = data.stocks[sym];
        if (stock) {
          const value = stock.price * qty;
          desc += `${stock.icon} **${sym}**: ${qty} سهم | ${value.toFixed(2)} دينار\n`;
        }
      }
      desc += `\n━━━━━━━━━━━━━━━\n💰 الإجمالي: **${portfolioVal.toFixed(2)} دينار**`;
    }
    await message.reply(desc);
    return;
  }

  // === البنك: إيداع ===
  if (cmd === '!إيداع' || cmd === '!ايداع') {
    const amount = parseInt(args[1]);
    if (isNaN(amount) || amount <= 0 || amount > user.balance) {
      await message.reply('❌ استخدم: `!إيداع 100`');
      return;
    }
    user.balance -= amount;
    user.bank += amount;
    user.stats.deposit += amount;
    data.challenges.daily.save1 = (data.challenges.daily.save1 || 0) + amount;
    checkAchievements(userId);
    saveData();
    await message.reply(`✅ تم إيداع **${amount} دينار** في البنك 🏦`);
    return;
  }

  // === البنك: سحب ===
  if (cmd === '!سحب') {
    const amount = parseInt(args[1]);
    if (isNaN(amount) || amount <= 0 || amount > user.bank) {
      await message.reply('❌ استخدم: `!سحب 100`');
      return;
    }
    user.bank -= amount;
    user.balance += amount;
    saveData();
    await message.reply(`✅ تم سحب **${amount} دينار** 💳`);
    return;
  }

  // === حسابي ===
  if (cmd === '!حساب' || cmd === '!رصيد') {
    const portfolioVal = calculatePortfolioValue(userId);
    const total = user.balance + user.bank + portfolioVal;
    await message.reply(
      `💳 حسابك:\n` +
      `💰 نقدي: ${user.balance} دينار\n` +
      `🏦 بالبنك: ${user.bank} دينار\n` +
      `📈 أسهم: ${portfolioVal.toFixed(0)} دينار\n` +
      `💎 الإجمالي: ${total.toFixed(0)} دينار`
    );
    return;
  }

  // === يومي ===
  if (cmd === '!يومي' || cmd === '!مكافأة') {
    if (now - user.lastDaily >= DAILY_COOLDOWN) {
      user.streak = user.lastDaily && now - user.lastDaily < DAILY_COOLDOWN + 6 * 60 * 60 * 1000 
        ? (user.streak || 0) + 1 : 1;
      const bonus = Math.floor(DAILY_AMOUNT * (1 + Math.min(user.streak * 0.1, 0.5)));
      user.lastDaily = now;
      user.balance += bonus;
      checkAchievements(userId);
      saveData();
      await message.reply(`✅ حصلت على **${bonus} دينار**!\n🔥 سلسلتك: **${user.streak} يوم متتالي** 🎉`);
    } else {
      const h = Math.floor((DAILY_COOLDOWN - (now - user.lastDaily)) / 3600000);
      const m = Math.floor(((DAILY_COOLDOWN - (now - user.lastDaily)) % 3600000) / 60000);
      await message.reply(`⏳ عود بعد **${h} ساعة و ${m} دقيقة**`);
    }
    return;
  }

  // === عمل ===
  if (cmd === '!عمل' || cmd === '!وظيفة') {
    if (now - user.lastWork >= WORK_COOLDOWN) {
      const amount = Math.floor(Math.random() * (WORK_MAX - WORK_MIN + 1)) + WORK_MIN;
      user.lastWork = now;
      user.balance += amount;
      saveData();
      await message.reply(`✅ انتهيت من العمل وحصلت على **${amount} دينار** 💪`);
    } else {
      const m = Math.ceil((WORK_COOLDOWN - (now - user.lastWork)) / 60000);
      await message.reply(`⏳ استرح قليلاً — يمكنك العمل بعد **${m} دقيقة**`);
    }
    return;
  }

  // === يانصيب ===
  if (cmd === '!تذكرة' || cmd === '!يانصيب') {
    initLottery();
    if (user.balance < LOTTERY_TICKET_PRICE) {
      await message.reply(`❌ تحتاج إلى ${LOTTERY_TICKET_PRICE} دينار`);
      return;
    }
    user.balance -= LOTTERY_TICKET_PRICE;
    data.lotteries.current.pot += LOTTERY_TICKET_PRICE;
    if (!data.lotteries.current.participants.includes(userId)) {
      data.lotteries.current.participants.push(userId);
    }
    user.lotteryTickets = (user.lotteryTickets || 0) + 1;
    const timeLeft = Math.ceil((LOTTERY_DRAW_TIME - (now - data.lotteries.current.createdAt)) / 60000);
    saveData();
    await message.reply(
      `✅ تم شراء التذكرة! 🎫\n` +
      `💰 الجائزة: ${data.lotteries.current.pot} دينار\n` +
      `👥 المشاركون: ${data.lotteries.current.participants.length}\n` +
      `⏳ السحب بعد: ${Math.max(0, timeLeft)} دقيقة`
    );
    return;
  }

  // === التحديات ===
  if (cmd === '!تحديات') {
    let desc = '🎯 تحدياتك اليومية:\n\n';
    for (const ch of DEFAULT_CHALLENGES.daily) {
      const progress = data.challenges.daily[ch.id] || 0;
      const done = progress >= ch.target;
      desc += `${done ? '✅' : '⬜'} **${ch.name}** — ${ch.desc}\nالمكافأة: ${ch.reward} دينار\n`;
      if (done && !data.challenges.daily[ch.id + '_claimed']) {
        user.balance += ch.reward;
        data.challenges.daily[ch.id + '_claimed'] = true;
        desc += `🎉 تمت إضافة المكافأة!\n`;
      }
      desc += '\n';
    }
    saveData();
    await message.reply(desc);
    return;
  }

  // === الإنجازات ===
  if (cmd === '!إنجازات') {
    let desc = '🏆 إنجازاتك:\n\n';
    for (const [id, ach] of Object.entries(ACHIEVEMENTS_LIST)) {
      const unlocked = user.unlockedAchievements.includes(id);
      desc += `${unlocked ? '✅' : '⬜'} ${ach.icon} **${ach.name}** — ${ach.desc}\n`;
    }
    await message.reply(desc);
    return;
  }

  // === الألعاب ===
  if (cmd === '!نرد') {
    const amount = parseInt(args[1]);
    if (isNaN(amount) || amount <= 0 || amount > user.balance) {
      await message.reply('❌ استخدم: `!نرد 50`');
      return;
    }
    const u = Math.floor(Math.random() * 6) + 1;
    const b = Math.floor(Math.random() * 6) + 1;
    if (u > b) {
      user.balance += amount;
      user.stats.gamesWon++;
      await message.reply(`✅ فزت! 🎲 أنت:${u} أنا:${b} +${amount}`);
    } else if (u < b) {
      user.balance -= amount;
      await message.reply(`❌ خسرت 🎲 أنت:${u} أنا:${b} -${amount}`);
    } else {
      await message.reply(`⚖️ تعادل 🎲`);
    }
    user.stats.games++;
    data.challenges.daily.play1 = (data.challenges.daily.play1 || 0) + 1;
    checkAchievements(userId);
    saveData();
    return;
  }

  if (cmd === '!حجر' || cmd === '!ورق' || cmd === '!مقص') {
    const choice = cmd.slice(1);
    const amount = parseInt(args[1]);
    const opts = ['حجر', 'ورق', 'مقص'];
    const bot = opts[Math.floor(Math.random() * 3)];
    if (isNaN(amount) || amount <= 0 || amount > user.balance) {
      await message.reply('❌ استخدم: `!حجر 50`');
      return;
    }
    let res;
    if (choice === bot) res = `⚖️ تعادل! كلانا اختار ${bot}`;
    else if (
      (choice === 'حجر' && bot === 'مقص') ||
      (choice === 'ورق' && bot === 'حجر') ||
      (choice === 'مقص' && bot === 'ورق')
    ) {
      user.balance += amount;
      user.stats.gamesWon++;
      res = `✅ فزت! أنت:${choice} أنا:${bot} +${amount}`;
    } else {
      user.balance -= amount;
      res = `❌ خسرت! أنت:${choice} أنا:${bot} -${amount}`;
    }
    user.stats.games++;
    data.challenges.daily.play1 = (data.challenges.daily.play1 || 0) + 1;
    checkAchievements(userId);
    saveData();
    await message.reply(res);
    return;
  }

  if (cmd === '!عملة') {
    const amount = parseInt(args[1]);
    const pick = (args[2] || '').toLowerCase();
    if (!['وجه', 'خلف'].includes(pick) || isNaN(amount) || amount <= 0 || amount > user.balance) {
      await message.reply('❌ استخدم: `!عملة 50 وجه`');
      return;
    }
    const res = Math.random() < 0.5 ? 'وجه' : 'خلف';
    if (pick === res) {
      user.balance += amount;
      user.stats.gamesWon++;
      await message.reply(`🪙 ${res} — ✅ فزت! +${amount}`);
    } else {
      user.balance -= amount;
      await message.reply(`🪙 ${res} — ❌ خسرت! -${amount}`);
    }
    user.stats.games++;
    data.challenges.daily.play1 = (data.challenges.daily.play1 || 0) + 1;
    checkAchievements(userId);
    saveData();
    return;
  }

  if (cmd === '!صيد') {
    const fish = [
      { e: '🐟', n: 'سمكة صغيرة', v: Math.floor(Math.random() * 15) + 5 },
      { e: '🐠', n: 'سمكة كبيرة', v: Math.floor(Math.random() * 30) + 20 },
      { e: '🐡', n: 'سمكة ذهبية', v: Math.floor(Math.random() * 50) + 40 },
      { e: '🌊', n: 'لا شيء', v: 0 }
    ];
    const f = fish[Math.floor(Math.random() * fish.length)];
    if (f.v > 0) user.balance += f.v;
    await message.reply(f.v > 0 ? `${f.e} اصطدت ${f.n}! +${f.v} دينار` : `${f.e} لم تصطد شيئاً 😅`);
    user.stats.games++;
    data.challenges.daily.play1 = (data.challenges.daily.play1 || 0) + 1;
    checkAchievements(userId);
    saveData();
    return;
  }

  if (cmd === '!تنقيب') {
    const items = [
      { e: '🥇', n: 'ذهب', v: Math.floor(Math.random() * 60) + 50 },
      { e: '💎', n: 'ألماس', v: Math.floor(Math.random() * 100) + 80 },
      { e: '🪙', n: 'عملات قديمة', v: Math.floor(Math.random() * 20) + 10 },
      { e: '🪨', n: 'حجارة', v: 0 }
    ];
    const found = items[Math.floor(Math.random() * items.length)];
    if (found.v > 0) user.balance += found.v;
    await message.reply(found.v > 0 ? `${found.e} وجدت ${found.n}! +${found.v} دينار 🎉` : `${found.e} لم تجد شيئاً 😅`);
    user.stats.games++;
    data.challenges.daily.play1 = (data.challenges.daily.play1 || 0) + 1;
    checkAchievements(userId);
    saveData();
    return;
  }

  // === إداري ===
  if ((cmd === '!تعويض' || cmd === '!أعط') && ADMIN_IDS.includes(userId)) {
    const target = message.mentions.users.first();
    const amount = parseInt(args[2]);
    if (!target || isNaN(amount) || amount <= 0) {
      await message.reply('❌ استخدم: `!تعويض @الشخص 100`');
      return;
    }
    ensureUser(target.id).balance = Math.min(MAX_MONEY, ensureUser(target.id).balance + amount);
    saveData();
    await message.reply(`✅ تم إضافة ${amount} دينار لـ ${target.username}`);
    return;
  }
});

// ========== تشغيل البوت ==========
client.once(Events.ClientReady, () => {
  console.log(`✅ البوت جاهز: ${client.user.tag}`);
  initLottery();
  checkAchievements('init');
  console.log('📊 نظام الأسهم والتداول جاهز');
  console.log('🎯 نظام التحديات والإنجازات جاهز');
});

async function main() {
  loadData();
  resetChallengesIfNeeded();
  await client.login(TOKEN);
}

main().catch(e => {
  console.error('❌ فشل التشغيل:', e);
  process.exit(1);
});

process.on('SIGTERM', async () => {
  saveData();
  await client.destroy().catch(() => {});
  process.exit(0);
});
