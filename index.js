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
  challenges: { daily: {}, weekly: {}, resetDate: Date.now() },
  achievements: {},
  cooperations: {},
  friends: {}
};

const DEFAULT_STOCKS = {
  'تك': { name: 'تقنية العربية', price: 100.00, change: 0, volatility: 0.02, icon: '💻' },
  'بنك': { name: 'بنك الأمان', price: 80.00, change: 0, volatility: 0.015, icon: '🏦' },
  'طاقة': { name: 'شركة الطاقة المتكاملة', price: 120.00, change: 0, volatility: 0.025, icon: '⚡' },
  'غذاء': { name: 'الغذاء الوطني', price: 65.00, change: 0, volatility: 0.012, icon: '🍎' },
  'عقار': { name: 'العقار والاستثمار', price: 95.00, change: 0, volatility: 0.03, icon: '🏢' },
  'ذهب': { name: 'معدن الذهب', price: 200.00, change: 0, volatility: 0.01, icon: '🥇' },
  'سيارة': { name: 'الشركة للسيارات', price: 55.00, change: 0, volatility: 0.04, icon: '🚗' }
};

const ACHIEVEMENTS_LIST = {
  firstTrade: { name: 'أول صفقة', desc: 'أكمل أول عملية شراء', icon: '🎯', reward: 50 },
  rich1000: { name: 'بداية الثراء', desc: 'امتلك 1000 دينار', icon: '💰', reward: 100 },
  rich10000: { name: 'ثري جداً', desc: 'امتلك 10,000 دينار', icon: '👑', reward: 500 },
  investor: { name: 'مستثمر محترف', desc: 'امتلك أسهماً في 3 شركات مختلفة', icon: '📊', reward: 150 },
  trader10: { name: 'متداول نشط', desc: 'أكمل 10 صفقات', icon: '📈', reward: 100 },
  winner5: { name: 'محظوظ', desc: 'اربح 5 مرات في الألعاب', icon: '🏆', reward: 80 },
  firstCoop: { name: 'يد بيد', desc: 'أكمل أول مهمة تعاونية', icon: '🤝', reward: 75 },
  friends5: { name: 'صديق وفي', desc: 'أضف 5 أصدقاء', icon: '💛', reward: 100 }
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
      data.cooperations = saved.cooperations || {};
      data.friends = saved.friends || {};
      console.log('✅ تم تحميل البيانات');
    } else {
      data.stocks = JSON.parse(JSON.stringify(DEFAULT_STOCKS));
      saveData();
      console.log('📄 ملف بيانات جديد');
    }
  } catch (e) {
    console.error('⚠️ خطأ تحميل البيانات:', e.message);
    data.stocks = JSON.parse(JSON.stringify(DEFAULT_STOCKS));
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
      stats: { trades: 0, games: 0, gamesWon: 0, deposit: 0, totalProfit: 0, coopTasks: 0 },
      lastDaily: 0,
      lastWork: 0,
      streak: 0,
      unlockedAchievements: [],
      createdAt: Date.now()
    };
  }
  if (!data.users[userId].portfolio) data.users[userId].portfolio = {};
  if (!data.users[userId].stats) {
    data.users[userId].stats = { trades: 0, games: 0, gamesWon: 0, deposit: 0, totalProfit: 0, coopTasks: 0 };
  }
  if (!data.users[userId].unlockedAchievements) {
    data.users[userId].unlockedAchievements = [];
  }
  return data.users[userId];
}

function addFriend(user1Id, user2Id) {
  if (!data.friends[user1Id]) data.friends[user1Id] = [];
  if (!data.friends[user2Id]) data.friends[user2Id] = [];
  if (!data.friends[user1Id].includes(user2Id)) data.friends[user1Id].push(user2Id);
  if (!data.friends[user2Id].includes(user1Id)) data.friends[user2Id].push(user1Id);
  saveData();
}

function areFriends(user1Id, user2Id) {
  return data.friends[user1Id]?.includes(user2Id) || false;
}

function createCoopTask(creatorId, partnerId, taskName, reward) {
  const taskId = Date.now().toString();
  data.cooperations[taskId] = {
    id: taskId, creator: creatorId, partner: partnerId, name: taskName, reward: reward,
    creatorReady: false, partnerReady: false, completed: false, createdAt: Date.now()
  };
  saveData();
  return taskId;
}

function completeCoopTask(taskId) {
  const task = data.cooperations[taskId];
  if (!task || task.completed) return false;
  task.completed = true;
  const user1 = ensureUser(task.creator);
  const user2 = ensureUser(task.partner);
  user1.balance += task.reward;
  user2.balance += task.reward;
  user1.stats.coopTasks++;
  user2.stats.coopTasks++;
  if (user1.stats.coopTasks === 1) unlockAchievement(task.creator, 'firstCoop');
  if (user2.stats.coopTasks === 1) unlockAchievement(task.partner, 'firstCoop');
  saveData();
  return true;
}

function recordTransaction(type, symbol, amount, price, userId) {
  data.transactions.push({ type, symbol, amount, price, userId, total: amount * price, time: Date.now() });
  if (data.transactions.length > 1000) data.transactions.shift();
  ensureUser(userId).stats.trades++;
  checkAchievements(userId);
  saveData();
}

function updateStockPrices() {
  for (const [symbol, stock] of Object.entries(data.stocks)) {
    const change = (Math.random() - 0.5) * 2 * stock.volatility * stock.price;
    stock.price = Math.max(10, Math.round((stock.price + change) * 100) / 100);
    stock.change = Math.round((change / stock.price) * 10000) / 100;
  }
  saveData();
}
setInterval(updateStockPrices, 5 * 60 * 1000);

function resetChallengesIfNeeded() {
  const now = new Date();
  const lastReset = new Date(data.challenges.resetDate);
  if (now.toDateString() !== lastReset.toDateString()) {
    data.challenges.daily = {};
    data.challenges.resetDate = Date.now();
    saveData();
  }
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

function checkAchievements(userId) {
  const user = ensureUser(userId);
  const netWorth = user.balance + user.bank + calculatePortfolioValue(userId);
  if (user.stats.trades >= 1 && !user.unlockedAchievements.includes('firstTrade')) unlockAchievement(userId, 'firstTrade');
  if (netWorth >= 1000 && !user.unlockedAchievements.includes('rich1000')) unlockAchievement(userId, 'rich1000');
  if (netWorth >= 10000 && !user.unlockedAchievements.includes('rich10000')) unlockAchievement(userId, 'rich10000');
  if (Object.keys(user.portfolio).length >= 3 && !user.unlockedAchievements.includes('investor')) unlockAchievement(userId, 'investor');
  if (user.stats.trades >= 10 && !user.unlockedAchievements.includes('trader10')) unlockAchievement(userId, 'trader10');
  if (user.stats.gamesWon >= 5 && !user.unlockedAchievements.includes('winner5')) unlockAchievement(userId, 'winner5');
  if (data.friends[userId]?.length >= 5 && !user.unlockedAchievements.includes('friends5')) unlockAchievement(userId, 'friends5');
}

function unlockAchievement(userId, achId) {
  const user = ensureUser(userId);
  const ach = ACHIEVEMENTS_LIST[achId];
  if (!ach || user.unlockedAchievements.includes(achId)) return;
  user.unlockedAchievements.push(achId);
  user.balance += ach.reward;
  console.log(`🏆 إنجاز: ${ach.name}`);
  saveData();
}

const DAILY_AMOUNT = 100;
const DAILY_COOLDOWN = 24 * 60 * 60 * 1000;

// ========== إرسال القائمة الرئيسية بالأزرار ==========
async function sendMainMenu(channel) {
  resetChallengesIfNeeded();
  const embed = new EmbedBuilder()
    .setColor('#3498db')
    .setTitle('🏦 القائمة الرئيسية')
    .setDescription('اختر من الأزرار أدناه:');

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('account').setLabel('حسابي').setStyle(ButtonStyle.Primary).setEmoji('💳'),
    new ButtonBuilder().setCustomId('portfolio').setLabel('محفظتي').setStyle(ButtonStyle.Success).setEmoji('📊'),
    new ButtonBuilder().setCustomId('stocks').setLabel('سوق الأسهم').setStyle(ButtonStyle.Primary).setEmoji('📈')
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('friends').setLabel('الأصدقاء').setStyle(ButtonStyle.Success).setEmoji('🤝'),
    new ButtonBuilder().setCustomId('bank').setLabel('البنك').setStyle(ButtonStyle.Secondary).setEmoji('🏛️'),
    new ButtonBuilder().setCustomId('games').setLabel('الألعاب').setStyle(ButtonStyle.Danger).setEmoji('🎮')
  );
  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('daily').setLabel('يومي').setStyle(ButtonStyle.Success).setEmoji('🎁'),
    new ButtonBuilder().setCustomId('achievements').setLabel('الإنجازات').setStyle(ButtonStyle.Secondary).setEmoji('🏆'),
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
            { name: '💎 الإجمالي', value: `${totalAssets.toFixed(0)} دينار`, inline: true },
            { name: '🎮 ألعاب ربحتها', value: `${user.stats.gamesWon} مرة`, inline: true },
            { name: '🏆 إنجازات', value: `${user.unlockedAchievements.length}/${Object.keys(ACHIEVEMENTS_LIST).length}`, inline: true }
          );
        await interaction.reply({ embeds: [embed], ephemeral: false });
        break;
      }
      case 'portfolio': {
        let desc = '📦 محفظة أسهمك:\n\n';
        const portfolioVal = calculatePortfolioValue(userId);
        if (Object.keys(user.portfolio).length === 0) {
          desc += 'محفظتك فارغة!\nاستخدم `!سوق` لمعرفة الأسعار';
        } else {
          for (const [sym, qty] of Object.entries(user.portfolio)) {
            const stock = data.stocks[sym];
            if (stock) {
              const value = stock.price * qty;
              desc += `**${stock.icon} ${sym}**: ${qty} سهم | ${value.toFixed(2)} دينار\n`;
            }
          }
          desc += `\n━━━━━━━━━━━━━━━\n💰 الإجمالي: **${portfolioVal.toFixed(2)} دينار**`;
        }
        const embed = new EmbedBuilder().setColor('#2ecc71').setTitle('📊 محفظتي').setDescription(desc);
        await interaction.reply({ embeds: [embed], ephemeral: false });
        break;
      }
      case 'stocks': {
        let desc = '📈 أسعار الأسهم الحالية:\n\n';
        for (const [sym, stock] of Object.entries(data.stocks)) {
          const arrow = stock.change >= 0 ? '📈' : '📉';
          desc += `${stock.icon} **${sym}** — ${stock.name}: **${stock.price.toFixed(2)} دينار** | ${arrow} ${stock.change >= 0 ? '+' : ''}${stock.change}%\n`;
        }
        desc += '\n🛒 `!شراء رمز الكمية` | 💰 `!بيع رمز الكمية`';
        const embed = new EmbedBuilder().setColor('#3498db').setTitle('📊 سوق الأسهم').setDescription(desc);
        await interaction.reply({ embeds: [embed], ephemeral: false });
        break;
      }
      case 'friends': {
        let desc = '🤝 أصدقاؤك:\n\n';
        const friends = data.friends[userId] || [];
        if (friends.length === 0) {
          desc += 'ليس لديك أصدقاء بعد 😔\nاستخدم `!أضف @الشخص`';
        } else {
          friends.forEach(fid => desc += `✅ <@${fid}>\n`);
          desc += `\n📊 المجموع: ${friends.length}`;
        }
        const embed = new EmbedBuilder().setColor('#f1c40f').setTitle('🤝 الأصدقاء').setDescription(desc);
        await interaction.reply({ embeds: [embed], ephemeral: false });
        break;
      }
      case 'bank': {
        const embed = new EmbedBuilder()
          .setColor('#9b59b6')
          .setTitle('🏛️ البنك')
          .addFields(
            { name: '💰 في الجيب', value: `${user.balance} دينار`, inline: true },
            { name: '🏦 في البنك', value: `${user.bank} دينار`, inline: true }
          )
          .setFooter({ text: '!إيداع مبلغ | !سحب مبلغ' });
        await interaction.reply({ embeds: [embed], ephemeral: false });
        break;
      }
      case 'games': {
        const embed = new EmbedBuilder()
          .setColor('#9b59b6')
          .setTitle('🎮 صالة الألعاب')
          .setDescription('اختر لعبة:')
          .addFields(
            { name: '🎲 النرد', value: '`!نرد المبلغ`', inline: true },
            { name: '🔢 تخمين', value: '`!تخمين المبلغ الرقم`', inline: true },
            { name: '✊ حجر ورق مقص', value: '`!حجر المبلغ اختيارك`', inline: true },
            { name: '🪙 عملة', value: '`!عملة المبلغ وجه/خلف`', inline: true },
            { name: '🎣 صيد', value: '`!صيد`', inline: true },
            { name: '⛏️ تنقيب', value: '`!تنقيب`', inline: true }
          );
        await interaction.reply({ embeds: [embed], ephemeral: false });
        break;
      }
      case 'daily': {
        if (now - user.lastDaily >= DAILY_COOLDOWN) {
          user.streak = user.lastDaily && now - user.lastDaily < DAILY_COOLDOWN + 6 * 60 * 60 * 1000 ? (user.streak || 0) + 1 : 1;
          const bonus = Math.floor(DAILY_AMOUNT * (1 + Math.min(user.streak * 0.1, 0.5)));
          user.lastDaily = now;
          user.balance += bonus;
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
          const embed = new EmbedBuilder().setColor('#f39c12').setTitle('⏳ انتظر').setDescription(`عود بعد **${h} ساعة و ${m} دقيقة**`);
          await interaction.reply({ embeds: [embed], ephemeral: true });
        }
        break;
      }
      case 'achievements': {
        let desc = '🏆 إنجازاتك:\n\n';
        for (const [id, ach] of Object.entries(ACHIEVEMENTS_LIST)) {
          const unlocked = user.unlockedAchievements.includes(id);
          desc += `${unlocked ? '✅' : '⬜'} ${ach.icon} **${ach.name}** — +${ach.reward} دينار\n`;
        }
        const embed = new EmbedBuilder().setColor('#f1c40f').setTitle('🏆 الإنجازات').setDescription(desc);
        await interaction.reply({ embeds: [embed], ephemeral: false });
        break;
      }
      case 'help': {
        const embed = new EmbedBuilder()
          .setColor('#95a5a6')
          .setTitle('📖 دليل الأوامر الكامل')
          .addFields(
            { name: '📋 عام', value: '`!قائمة` — القائمة الرئيسية', inline: false },
            { name: '💰 المالية', value: '`!حساب` `!يومي` `!إيداع مبلغ` `!سحب مبلغ`', inline: false },
            { name: '📊 الأسهم', value: '`!سوق` `!شراء رمز الكمية` `!بيع رمز الكمية` `!محفظة`', inline: false },
            { name: '🤝 الأصدقاء', value: '`!أضف @الشخص` `!أصدقائي` `!هدية @الصديق المبلغ`', inline: false },
            { name: '👥 التعاون', value: '`!مهمة @الصديق اسم المكافأة` `!مهامي` `!أوافق رقم` `!أكمل رقم`', inline: false },
            { name: '🎮 الألعاب', value: '`!نرد المبلغ` `!تخمين المبلغ الرقم` `!حجر المبلغ اختيار` `!عملة المبلغ وجه` `!صيد` `!تنقيب`', inline: false }
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

// ========== معالجة الأوامر النصية + الألعاب ==========
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

  // === حسابي ===
  if (cmd === '!حساب' || cmd === '!رصيد') {
    const portfolioVal = calculatePortfolioValue(userId);
    const totalAssets = user.balance + user.bank + portfolioVal;
    await message.reply(
      `💳 حسابك:\n` +
      `💰 نقدي: **${user.balance}** دينار\n` +
      `🏦 في البنك: **${user.bank}** دينار\n` +
      `📈 الأسهم: **${portfolioVal.toFixed(0)}** دينار\n` +
      `💎 الإجمالي: **${totalAssets.toFixed(0)}** دينار\n` +
      `🎮 ألعاب ربحتها: **${user.stats.gamesWon}** مرة\n` +
      `🏆 إنجازات: **${user.unlockedAchievements.length}/${Object.keys(ACHIEVEMENTS_LIST).length}**`
    );
    return;
  }

  // === يومي ===
  if (cmd === '!يومي' || cmd === '!يوميا') {
    if (now - user.lastDaily >= DAILY_COOLDOWN) {
      user.streak = user.lastDaily && now - user.lastDaily < DAILY_COOLDOWN + 6 * 60 * 60 * 1000 ? (user.streak || 0) + 1 : 1;
      const bonus = Math.floor(DAILY_AMOUNT * (1 + Math.min(user.streak * 0.1, 0.5)));
      user.lastDaily = now;
      user.balance += bonus;
      checkAchievements(userId);
      saveData();
      await message.reply(`✅ حصلت على **${bonus} دينار**!\n🔥 سلسلتك: **${user.streak} يوم متتالي**`);
    } else {
      const h = Math.floor((DAILY_COOLDOWN - (now - user.lastDaily)) / 3600000);
      const m = Math.floor(((DAILY_COOLDOWN - (now - user.lastDaily)) % 3600000) / 60000);
      await message.reply(`⏳ عُد بعد **${h} ساعة و ${m} دقيقة**`);
    }
    return;
  }

  // === إيداع ===
  if (cmd === '!إيداع' || cmd === '!ايداع') {
    const amount = parseInt(args[1]);
    if (isNaN(amount) || amount <= 0 || amount > user.balance) {
      await message.reply('❌ استخدم: `!إيداع 100`');
      return;
    }
    user.balance -= amount;
    user.bank += amount;
    user.stats.deposit += amount;
    checkAchievements(userId);
    saveData();
    await message.reply(`✅ تم إيداع **${amount} دينار** في البنك!\n🏦 رصيدك في البنك: **${user.bank} دينار**`);
    return;
  }

  // === سحب ===
  if (cmd === '!سحب') {
    const amount = parseInt(args[1]);
    if (isNaN(amount) || amount <= 0 || amount > user.bank) {
      await message.reply('❌ استخدم: `!سحب 100`');
      return;
    }
    user.bank -= amount;
    user.balance += amount;
    saveData();
    await message.reply(`✅ تم سحب **${amount} دينار** من البنك!\n💰 رصيدك الحالي: **${user.balance} دينار**`);
    return;
  }

  // === سوق الأسهم ===
  if (cmd === '!سوق' || cmd === '!اسهم') {
    let desc = '📈 أسعار الأسهم الحالية:\n\n';
    for (const [sym, stock] of Object.entries(data.stocks)) {
      const arrow = stock.change >= 0 ? '📈' : '📉';
      desc += `${stock.icon} **${sym}** — ${stock.name}: **${stock.price.toFixed(2)} دينار** | ${arrow} ${stock.change >= 0 ? '+' : ''}${stock.change}%\n`;
    }
    desc += '\n🛒 `!شراء رمز الكمية` | 💰 `!بيع رمز الكمية` | 📊 `!محفظة`';
    await message.reply(desc);
    return;
  }

  // === شراء أسهم ===
  if (cmd === '!شراء') {
    const symbol = (args[1] || '').toLowerCase();
    const quantity = parseInt(args[2]);
    const stock = data.stocks[symbol];
    if (!stock) {
      await message.reply('❌ رمز غير صالح. استخدم `!سوق`');
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
    await message.reply(`✅ تم الشراء!\n🛒 ${quantity} سهم من ${stock.name}\n💰 التكلفة: ${totalCost.toFixed(2)} دينار`);
    return;
  }

  // === بيع أسهم ===
  if (cmd === '!بيع') {
    const symbol = (args[1] || '').toLowerCase();
    const quantity = parseInt(args[2]);
    const stock = data.stocks[symbol];
    if (!stock) {
      await message.reply('❌ رمز غير صالح');
      return;
    }
    if (!user.portfolio[symbol] || user.portfolio[symbol] < quantity) {
      await message.reply(`❌ لا تمتلك هذه الكمية\nلديك: ${user.portfolio[symbol] || 0} سهم`);
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
    await message.reply(`✅ تم البيع!\n💰 الإيراد: ${totalGain.toFixed(2)} دينار`);
    return;
  }

  // === محفظة ===
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

  // === أضف صديق ===
  if (cmd === '!أضف' || cmd === '!صديق') {
    const target = message.mentions.users.first();
    if (!target) {
      await message.reply('❌ استخدم: `!أضف @الشخص`');
      return;
    }
    if (target.id === userId) {
      await message.reply('🤔 لا يمكنك إضافة نفسك!');
      return;
    }
    if (areFriends(userId, target.id)) {
      await message.reply('✅ بالفعل صديقك!');
      return;
    }
    addFriend(userId, target.id);
    checkAchievements(userId);
    await message.reply(`✅ تمت إضافة **${target.username}** كصديق! 🤝`);
    return;
  }

  // === أصدقائي ===
  if (cmd === '!أصدقائي') {
    const friends = data.friends[userId] || [];
    if (friends.length === 0) {
      await message.reply('😔 ليس لديك أصدقاء بعد. استخدم `!أضف @الشخص`');
      return;
    }
    let list = '🤝 أصدقاؤك:\n';
    friends.forEach(fid => list += `✅ <@${fid}>\n`);
    list += `📊 المجموع: ${friends.length}`;
    await message.reply(list);
    return;
  }

  // === هدية ===
  if (cmd === '!هدية') {
    const target = message.mentions.users.first();
    const amount = parseInt(args[2]);
    if (!target || isNaN(amount) || amount <= 0) {
      await message.reply('❌ استخدم: `!هدية @الصديق 100`');
      return;
    }
    if (amount > user.balance) {
      await message.reply('❌ رصيد غير كافٍ');
      return;
    }
    if (!areFriends(userId, target.id)) {
      await message.reply('⚠️ يجب أن يكون صديقاً أولاً');
      return;
    }
    user.balance -= amount;
    ensureUser(target.id).balance += amount;
    saveData();
    await message.reply(`🎁 أرسلت **${amount} دينار** إلى ${target.username}! 🎉`);
    return;
  }

  // === مهمة تعاونية ===
  if (cmd === '!مهمة') {
    const target = message.mentions.users.first();
    const reward = parseInt(args[args.length - 1]);
    if (!target || isNaN(reward) || reward <= 0) {
      await message.reply('❌ استخدم: `!مهمة @الصديق اسم المهمة 200`');
      return;
    }
    if (target.id === userId) {
      await message.reply('🤔 لا يمكن مع نفسك!');
      return;
    }
    if (!areFriends(userId, target.id)) {
      await message.reply('⚠️ أضفه كصديق أولاً');
      return;
    }
    const taskName = args.slice(2, -1).join(' ') || 'مهمة مشتركة';
    const taskId = createCoopTask(userId, target.id, taskName, reward);
    await message.reply(
      `📋 تم إنشاء مهمة!\n🔢 رقمها: **${taskId}**\n👥 الشريك: ${target.username}\n💰 المكافأة لكل: **${reward} دينار**\n\n` +
      `اطلب منه كتابة: \`!أوافق ${taskId}\``
    );
    return;
  }

  // === أوافق على مهمة ===
  if (cmd === '!أوافق') {
    const taskId = args[1];
    if (!taskId || !data.cooperations[taskId]) {
      await message.reply('❌ رقم غير صالح. استخدم `!مهامي`');
      return;
    }
    const task = data.cooperations[taskId];
    if (task.completed) {
      await message.reply('✅ مكتملة بالفعل');
      return;
    }
    if (task.creator !== userId && task.partner !== userId) {
      await message.reply('❌ أنت لست طرفاً فيها');
      return;
    }
    if (task.creator === userId) task.creatorReady = true;
    if (task.partner === userId) task.partnerReady = true;
    saveData();
    const bothReady = task.creatorReady && task.partnerReady;
    await message.reply(
      bothReady
        ? `✅ موافقة من الطرفين! اكتبا: \`!أكمل ${taskId}\``
        : '✅ تم تسجيل موافقتك. بانتظار الشريك ⏳'
    );
    return;
  }

  // === مهامي ===
  if (cmd === '!مهامي') {
    let desc = '👥 مهامك:\n\n';
    let hasTasks = false;
    for (const [tid, task] of Object.entries(data.cooperations)) {
      if (task.creator === userId || task.partner === userId) {
        hasTasks = true;
        const role = task.creator === userId ? 'المنشئ' : 'الشريك';
        const status = task.completed ? '✅ مكتملة' :
          (task.creatorReady && task.partnerReady ? '⏳ جاهزة' :
          (task.creatorReady || task.partnerReady ? '⏳ بانتظار' : '📩 جديدة'));
        desc += `🔢 **${tid}** — ${task.name}\n👤 أنت: ${role} | الحالة: ${status}\n💰 المكافأة: ${task.reward}\n\n`;
      }
    }
    if (!hasTasks) desc += 'لا توجد مهام. أنشئ واحدة بـ `!مهمة @الصديق اسم المكافأة`';
    await message.reply(desc);
    return;
  }

  // === أكمل مهمة ===
  if (cmd === '!أكمل') {
    const taskId = args[1];
    if (!taskId || !data.cooperations[taskId]) {
      await message.reply('❌ رقم غير صالح');
      return;
    }
    const task = data.cooperations[taskId];
    if (task.completed) {
      await message.reply('✅ مكتملة بالفعل');
      return;
    }
    if (task.creator !== userId && task.partner !== userId) {
      await message.reply('❌ أنت لست طرفاً فيها');
      return;
    }
    if (!task.creatorReady || !task.partnerReady) {
      await message.reply('⚠️ يجب أن يوافق الطرفان أولاً بـ `!أوافق ' + taskId + '`');
      return;
    }
    if (completeCoopTask(taskId)) {
      await message.reply(
        `🎉 **تم إنجاز المهمة!** 🎊\n📝 ${task.name}\n💰 حصل كل منكما على **${task.reward} دينار** ✅`
      );
    } else {
      await message.reply('❌ حدث خطأ');
    }
    return;
  }

  // ========== 🎮 الألعاب ==========
  
  // === 🎲 النرد ===
  if (cmd === '!نرد') {
    const bet = parseInt(args[1]);
    if (isNaN(bet) || bet <= 0 || bet > user.balance) {
      await message.reply('❌ استخدم: `!نرد 50`');
      return;
    }
    user.balance -= bet;
    const dice1 = Math.floor(Math.random() * 6) + 1;
    const dice2 = Math.floor(Math.random() * 6) + 1;
    const total = dice1 + dice2;
    const win = total >= 7;
    user.stats.games++;
    if (win) {
      user.balance += bet * 2;
      user.stats.gamesWon++;
      checkAchievements(userId);
      await message.reply(`🎲 النرد: **${dice1} + ${dice2} = ${total}**\n🎉 فزت! ربحت **${bet * 2} دينار** ✅`);
    } else {
      await message.reply(`🎲 النرد: **${dice1} + ${dice2} = ${total}**\n😖 خسرت! خسرت **${bet} دينار** ❌`);
    }
    saveData();
    return;
  }

  // === 🔢 تخمين الرقم ===
  if (cmd === '!تخمين' || cmd === '!رقم') {
    const bet = parseInt(args[1]);
    const guess = parseInt(args[2]);
    if (isNaN(bet) || bet <= 0 || bet > user.balance || isNaN(guess) || guess < 1 || guess > 10) {
      await message.reply('❌ استخدم: `!تخمين 50 7` — الرقم من 1 إلى 10');
      return;
    }
    user.balance -= bet;
    const secret = Math.floor(Math.random() * 10) + 1;
    user.stats.games++;
    if (guess === secret) {
      user.balance += bet * 5;
      user.stats.gamesWon++;
      checkAchievements(userId);
      await message.reply(`🔢 الرقم كان: **${secret}**\n🎉 تطابق تماماً! ربحت **${bet * 5} دينار** ✅`);
    } else {
      await message.reply(`🔢 الرقم كان: **${secret}**\n😖 لم توفق. حاول مرة أخرى! ❌`);
    }
    saveData();
    return;
  }

  // === ✊ حجر ورق مقص ===
  if (['!حجر', '!ورق', '!مقص'].includes(cmd)) {
    const bet = parseInt(args[1]);
    const choice = args[2] || cmd.slice(1);
    const validChoices = ['حجر', 'ورق', 'مقص'];
    if (isNaN(bet) || bet <= 0 || bet > user.balance || !validChoices.includes(choice)) {
      await message.reply('❌ استخدم: `!حجر 50 حجر` أو `!حجر 50 ورق` أو `!حجر 50 مقص`');
      return;
    }
    user.balance -= bet;
    const botChoice = validChoices[Math.floor(Math.random() * 3)];
    let result;
    if (choice === botChoice) {
      user.balance += bet;
      result = '⚖️ تعادل! استرددت رهانك';
    } else if (
      (choice === 'حجر' && botChoice === 'مقص') ||
      (choice === 'ورق' && botChoice === 'حجر') ||
      (choice === 'مقص' && botChoice === 'ورق')
    ) {
      user.balance += bet * 2;
      user.stats.gamesWon++;
      result = `🎉 فزت! اخترت **${choice}** والكمبيوتر **${botChoice}**\nربحت **${bet * 2} دينار** ✅`;
    } else {
      result = `😖 خسرت! اخترت **${choice}** والكمبيوتر **${botChoice}** ❌`;
    }
    user.stats.games++;
    checkAchievements(userId);
    saveData();
    await message.reply(result);
    return;
  }

  // === 🪙 عملة ===
  if (cmd === '!عملة' || cmd === '!نقود') {
    const bet = parseInt(args[1]);
    const side = (args[2] || '').toLowerCase();
    if (isNaN(bet) || bet <= 0 || bet > user.balance || !['وجه', 'خلف'].includes(side)) {
      await message.reply('❌ استخدم: `!عملة 50 وجه` أو `!عملة 50 خلف`');
      return;
    }
    user.balance -= bet;
    const result = Math.random() < 0.5 ? 'وجه' : 'خلف';
    user.stats.games++;
    if (side === result) {
      user.balance += bet * 2;
      user.stats.gamesWon++;
      checkAchievements(userId);
      await message.reply(`🪙 العملة على: **${result}**\n🎉 فزت! ربحت **${bet * 2} دينار** ✅`);
    } else {
      await message.reply(`🪙 العملة على: **${result}**\n😖 خسرت! ❌`);
    }
    saveData();
    return;
  }

  // === 🎣 صيد السمك ===
  if (cmd === '!صيد' || cmd === '!سمك') {
    const fish = [
      { name: 'سمكة صغيرة', emoji: '🐟', reward: 10 },
      { name: 'سمكة كبيرة', emoji: '🐡', reward: 30 },
      { name: 'سمكة ذهبية', emoji: '🐠', reward: 100 },
      { name: 'أخطبوط', emoji: '🐙', reward: 50 },
      { name: 'لا شيء', emoji: '🌊', reward: 0 }
    ];
    const catchFish = fish[Math.floor(Math.random() * fish.length)];
    user.stats.games++;
    if (catchFish.reward > 0) {
      user.balance += catchFish.reward;
      user.stats.gamesWon++;
      checkAchievements(userId);
      await message.reply(`🎣 **ألقيت الشبكة في الماء...**\n\n${catchFish.emoji} اصطدت: **${catchFish.name}**!\n💰 ربحت: **${catchFish.reward} دينار** ✅`);
    } else {
      await message.reply(`🎣 **ألقيت الشبكة في الماء...**\n\n${catchFish.emoji} لم تصطد شيئاً هذه المرة 😔 حاول مجدداً!`);
    }
    saveData();
    return;
  }

   // === ⛏️ تنقيب الذهب ===
  if (cmd === '!تنقيب' || cmd === '!منجم') {
    const finds = [
      { name: 'ذهب خالص', emoji: '🥇', reward: 150 },
      { name: 'فضة', emoji: '🥈', reward: 60 },
      { name: 'نحاس', emoji: '🟤', reward: 20 },
      { name: 'ألماس', emoji: '💎', reward: 250 },
      { name: 'صخور عادية', emoji: '🪨', reward: 0 },
      { name: 'حديد', emoji: '🔩', reward: 15 }
    ];
    const found = finds[Math.floor(Math.random() * finds.length)];
    user.stats.games++;
    if (found.reward > 0) {
      user.balance += found.reward;
      user.stats.gamesWon++;
      checkAchievements(userId);
      await message.reply(`⛏️ **بدأت الحفر في المنجم...**\n\n${found.emoji} وجدت: **${found.name}**!\n💰 ربحت: **${found.reward} دينار** ✅`);
    } else {
      await message.reply(`⛏️ **بدأت الحفر في المنجم...**\n\n${found.emoji} لم تجد شيئاً ذا قيمة 😔 حاول مجدداً!`);
    }
    saveData();
    return;
  }
});

// ========== تشغيل البوت ==========
loadData();

client.login(TOKEN)
  .then(() => console.log('✅ البوت متصل بنجاح!'))
  .catch(err => console.error('❌ خطأ في تسجيل الدخول:', err));

client.on('ready', () => {
  console.log(`✅ ${client.user.tag} جاهز للعمل!`);
});
