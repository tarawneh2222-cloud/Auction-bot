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
  res.status(200).send('✅ مركز الاقتصاد — الدينار الأردني 🇯🇴');
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

const ADMIN_IDS = ['949062518213599332']; // معرفك للإدارة

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
let data = { users: {}, lotteries: {}, races: {} };

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      console.log('✅ تم تحميل البيانات بنجاح');
    } else {
      data = { users: {}, lotteries: {}, races: {} };
      saveData();
      console.log('📄 تم إنشاء ملف بيانات جديد');
    }
  } catch (e) {
    console.error('⚠️ خطأ تحميل البيانات:', e.message);
    data = { users: {}, lotteries: {}, races: {} };
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
      balance: 100,
      bank: 0,
      lastDaily: 0,
      lastWork: 0,
      lastRob: 0,
      lastCrime: 0,
      lastBet: 0,
      gamesWon: 0,
      gamesLost: 0,
      gamesPlayed: 0,
      streak: 0,
      lotteryTickets: 0,
      achievements: [],
      createdAt: Date.now()
    };
  }
  return data.users[userId];
}

// ========== الإعدادات ==========
const MAX_MONEY = 1_000_000;
const DAILY_AMOUNT = 50;
const WORK_MIN = 15;
const WORK_MAX = 40;
const ROB_COOLDOWN = 60 * 60 * 1000;
const ROB_CHANCE = 0.4;
const ROB_MIN_TARGET = 50;
const DAILY_COOLDOWN = 24 * 60 * 60 * 1000;
const WORK_COOLDOWN = 5 * 60 * 1000;
const CRIME_COOLDOWN = 10 * 60 * 1000;
const LOTTERY_TICKET_PRICE = 10;
const LOTTERY_DRAW_TIME = 60 * 60 * 1000;

// ========== الإنجازات ==========
const ACHIEVEMENTS = {
  FIRST_WIN: { name: '🏆 أول فوز', desc: 'أول لعبة تفوز بها' },
  RICH: { name: '💰 ثري', desc: 'امتلك 10,000 دينار' },
  GAMBLER: { name: '🎲 مقامر محترف', desc: 'أكمل 50 لعبة' },
  SAVIOR: { name: '🛡️ مدخر', desc: 'أودع 1,000 دينار في البنك' },
  DAILY_7: { name: '📅 منتظم أسبوعي', desc: 'احصل على المكافأة اليومية 7 أيام متتالية' },
  CRIMINAL: { name: '😈 مجرم', desc: 'أكمل 10 مهام إجرامية ناجحة' }
};

function checkAchievements(user, userId) {
  const total = user.balance + user.bank;
  if (total >= 10000 && !user.achievements.includes('RICH')) {
    user.achievements.push('RICH');
    return '🎉 إنجاز جديد: 💰 ثري — امتلكت 10,000 دينار!';
  }
  return null;
}

// ========== رسالة الترحيب الرئيسية ==========
async function sendMainMenu(channel) {
  const embed = new EmbedBuilder()
    .setColor('#3498db')
    .setTitle('🏦 مركز الاقتصاد والمتعة')
    .setDescription('مرحباً بك! اختر من الأزرار أدناه ما تريد القيام به:');

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('account').setLabel('حسابي').setStyle(ButtonStyle.Primary).setEmoji('💳'),
    new ButtonBuilder().setCustomId('bank').setLabel('البنك').setStyle(ButtonStyle.Secondary).setEmoji('🏛️'),
    new ButtonBuilder().setCustomId('daily').setLabel('المكافأة اليومية').setStyle(ButtonStyle.Success).setEmoji('🎁')
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('games').setLabel('الألعاب').setStyle(ButtonStyle.Danger).setEmoji('🎮'),
    new ButtonBuilder().setCustomId('lottery').setLabel('اليانصيب').setStyle(ButtonStyle.Primary).setEmoji('🎫'),
    new ButtonBuilder().setCustomId('crime').setLabel('مهام').setStyle(ButtonStyle.Secondary).setEmoji('🎭')
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('jobs').setLabel('الوظائف').setStyle(ButtonStyle.Secondary).setEmoji('💼'),
    new ButtonBuilder().setCustomId('leaderboard').setLabel('الترتيب').setStyle(ButtonStyle.Secondary).setEmoji('🏆'),
    new ButtonBuilder().setCustomId('achievements').setLabel('الإنجازات').setStyle(ButtonStyle.Primary).setEmoji('⭐')
  );

  const row4 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('rob').setLabel('السرقة').setStyle(ButtonStyle.Danger).setEmoji('⚡'),
    new ButtonBuilder().setCustomId('shop').setLabel('المتجر').setStyle(ButtonStyle.Success).setEmoji('🛍️'),
    new ButtonBuilder().setCustomId('inventory').setLabel('مقتنياتي').setStyle(ButtonStyle.Primary).setEmoji('🎒'),
    new ButtonBuilder().setCustomId('help').setLabel('المساعدة').setStyle(ButtonStyle.Secondary).setEmoji('❓')
  );

  await channel.send({ embeds: [embed], components: [row1, row2, row3, row4] });
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
        const embed = new EmbedBuilder()
          .setColor('#3498db')
          .setTitle('💳 حسابي')
          .addFields(
            { name: '💰 الرصيد الحالي', value: `${user.balance} دينار`, inline: true },
            { name: '🏦 في البنك', value: `${user.bank} دينار`, inline: true },
            { name: '🎮 ألعاب', value: `${user.gamesWon || 0} فوز / ${user.gamesLost || 0} خسارة`, inline: true },
            { name: '🔥 سلسلة يومية', value: `${user.streak || 0} أيام متتالية`, inline: true },
            { name: '⭐ إنجازات', value: `${(user.achievements || []).length} إنجاز`, inline: true },
            { name: '📅 عضو منذ', value: `<t:${Math.floor(user.createdAt/1000)}:R>`, inline: true }
          );
        await interaction.reply({ embeds: [embed], ephemeral: false });
        break;
      }

      case 'bank': {
        const embed = new EmbedBuilder()
          .setColor('#9b59b6')
          .setTitle('🏛️ البنك')
          .setDescription('إيداع وسحب الأموال بأمان — ربح فائدة يومية 1%')
          .addFields(
            { name: '💰 في الجيب', value: `${user.balance} دينار`, inline: true },
            { name: '🏦 في البنك', value: `${user.bank} دينار`, inline: true }
          )
          .setFooter({ text: 'استخدم: !إيداع المبلغ أو !سحب المبلغ' });
        await interaction.reply({ embeds: [embed], ephemeral: false });
        break;
      }

      case 'daily': {
        if (now - user.lastDaily >= DAILY_COOLDOWN) {
          // التحقق من السلسلة
          if (user.lastDaily && now - user.lastDaily < DAILY_COOLDOWN + 6 * 60 * 60 * 1000) {
            user.streak = (user.streak || 0) + 1;
          } else {
            user.streak = 1;
          }
          
          const bonusMultiplier = Math.min(user.streak * 0.1, 1.0);
          const totalAmount = Math.floor(DAILY_AMOUNT * (1 + bonusMultiplier));
          
          user.lastDaily = now;
          user.balance = Math.min(MAX_MONEY, user.balance + totalAmount);
          saveData();
          
          const achievementMsg = checkAchievements(user, userId);
          
          const embed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle('🎁 المكافأة اليومية')
            .setDescription(`✅ حصلت على **${totalAmount} دينار**! 🎉\n🔥 سلسلتك: **${user.streak} يوم متتالي**\n\nأعد الزيارة غداً للحصول على مكافأتك التالية${achievementMsg ? `\n\n${achievementMsg}` : ''}`);
          await interaction.reply({ embeds: [embed], ephemeral: false });
        } else {
          const h = Math.floor((DAILY_COOLDOWN - (now - user.lastDaily)) / 3600000);
          const m = Math.floor(((DAILY_COOLDOWN - (now - user.lastDaily)) % 3600000) / 60000);
          const embed = new EmbedBuilder()
            .setColor('#f39c12')
            .setTitle('⏳ انتظر قليلاً')
            .setDescription(`عود بعد **${h} ساعة و ${m} دقيقة** للمكافأة اليومية القادمة`);
          await interaction.reply({ embeds: [embed], ephemeral: false });
        }
        break;
      }

      case 'games': {
        const embed = new EmbedBuilder()
          .setColor('#9b59b6')
          .setTitle('🎮 صالة الألعاب')
          .setDescription('ألعاب ممتعة لكسب المال والمرح 🎉')
          .addFields(
            { name: '🎲 النرد', value: 'اكتب: !نرد المبلغ', inline: false },
            { name: '🔢 تخمين الرقم', value: 'اكتب: !تخمين المبلغ', inline: false },
            { name: '✊ حجر ورق مقص', value: 'اكتب: !حجر المبلغ', inline: false },
            { name: '🎯 رمية العملة', value: 'اكتب: !عملة المبلغ وجه/خلف', inline: false },
            { name: '🔢 أعلى رقم', value: 'اكتب: !رقم المبلغ', inline: false },
            { name: '🎰 الحظ', value: 'اكتب: !حظ المبلغ', inline: false }
          );
        await interaction.reply({ embeds: [embed], ephemeral: false });
        break;
      }

      case 'lottery': {
        if (!data.lotteries.current) {
          data.lotteries.current = {
            participants: [],
            pot: 0,
            createdAt: now
          };
        }
        const timeLeft = Math.ceil((LOTTERY_DRAW_TIME - (now - data.lotteries.current.createdAt)) / 60000);
        const embed = new EmbedBuilder()
          .setColor('#e74c3c')
          .setTitle('🎫 اليانصيب')
          .setDescription(`اشترِ تذكرة بـ **${LOTTERY_TICKET_PRICE} دينار** واربح الجائزة الكبرى!`)
          .addFields(
            { name: '💰 الجائزة الحالية', value: `${data.lotteries.current.pot} دينار`, inline: true },
            { name: '👥 المشاركون', value: `${data.lotteries.current.participants.length} شخص`, inline: true },
            { name: '⏳ الوقت المتبقي', value: `${Math.max(0, timeLeft)} دقيقة`, inline: true },
            { name: 'كيفية المشاركة', value: 'اكتب: !تذكرة لشراء تذكرة واحدة', inline: false }
          );
        await interaction.reply({ embeds: [embed], ephemeral: false });
        break;
      }

      case 'crime': {
        const embed = new EmbedBuilder()
          .setColor('#34495e')
          .setTitle('🎭 مهام ومغامرات')
          .setDescription('مخاطرة بمكافأة كبيرة أو خسارة!')
          .addFields(
            { name: '🏃 مهمة سرية', value: 'اكتب: !مهمة — مخاطرة 50% ربح/خسارة', inline: false },
            { name: '🎰 مقامرة', value: 'اكتب: !قمار المبلغ — ضاعف أو خسر', inline: false },
            { name: '🎣 صيد السمك', value: 'اكتب: !صيد — ربح عشوائي', inline: false },
            { name: '⛏️ تنقيب', value: 'اكتب: !تنقيب — قد تجد كنزاً', inline: false }
          );
        await interaction.reply({ embeds: [embed], ephemeral: false });
        break;
      }

      case 'jobs': {
        if (now - user.lastWork >= WORK_COOLDOWN) {
          const amount = Math.floor(Math.random() * (WORK_MAX - WORK_MIN + 1)) + WORK_MIN;
          user.lastWork = now;
          user.balance = Math.min(MAX_MONEY, user.balance + amount);
          saveData();
          const embed = new EmbedBuilder()
            .setColor('#3498db')
            .setTitle('💼 الوظائف')
            .setDescription(`✅ انتهيت من العمل وحصلت على **${amount} دينار**! 💪`);
          await interaction.reply({ embeds: [embed], ephemeral: false });
        } else {
          const m = Math.ceil((WORK_COOLDOWN - (now - user.lastWork)) / 60000);
          const embed = new EmbedBuilder()
            .setColor('#f39c12')
            .setTitle('💼 استرح قليلاً')
            .setDescription(`يمكنك العودة للعمل بعد **${m} دقيقة**`);
          await interaction.reply({ embeds: [embed], ephemeral: false });
        }
        break;
      }

      case 'leaderboard': {
        const sorted = Object.entries(data.users)
          .sort((a, b) => (b[1].balance + b[1].bank) - (a[1].balance + a[1].bank))
          .slice(0, 10);
        
        let desc = '';
        sorted.forEach((u, i) => {
          const total = u[1].balance + u[1].bank;
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`;
          desc += `${medal} <@${u[0]}> — **${total} دينار**\n`;
        });
        
        const embed = new EmbedBuilder()
          .setColor('#f1c40f')
          .setTitle('🏆 قائمة الأغنياء')
          .setDescription(desc || 'لا توجد بيانات حتى الآن!');
        await interaction.reply({ embeds: [embed], ephemeral: false });
        break;
      }

      case 'achievements': {
        const userAch = user.achievements || [];
        let desc = '';
        for (const [key, ach] of Object.entries(ACHIEVEMENTS)) {
          const unlocked = userAch.includes(key);
          desc += `${unlocked ? '✅' : '🔒'} **${ach.name}** — ${ach.desc}\n`;
        }
        const embed = new EmbedBuilder()
          .setColor('#f1c40f')
          .setTitle('⭐ إنجازاتك')
          .setDescription(desc);
        await interaction.reply({ embeds: [embed], ephemeral: false });
        break;
      }

      case 'rob': {
        const embed = new EmbedBuilder()
          .setColor('#e74c3c')
          .setTitle('⚡ السرقة / النهب')
          .setDescription('اكتب الأمر في الدردشة هكذا:\n`!سرقة @الشخص` أو `!نهب @الشخص`\n\n📊 التفاصيل:\n• فرصة النجاح: 40%\n• نسبة المسروق: 15% من رصيده\n• فترة الانتظار: ساعة كاملة\n• لا يمكن سرقة من رصيده أقل من 50 دينار')
          .setFooter({ text: 'انتبه: قد يتم اكتشافك وفشل محاولتك!' });
        await interaction.reply({ embeds: [embed], ephemeral: false });
        break;
      }

      case 'shop': {
        const embed = new EmbedBuilder()
          .setColor('#27ae60')
          .setTitle('🛍️ المتجر')
          .setDescription('اشترِ ما تحتاجه من هنا')
          .addFields(
            { name: '🛡️ حماية من السرقة', value: '500 دينار — استخدم: !شراء حماية', inline: false },
            { name: '💎 ضعف المكافأة اليومية', value: '1,000 دينار — استخدم: !شراء ضعف', inline: false },
            { name: '🎫 تذكرة يانصيب', value: '10 دينار — استخدم: !تذكرة', inline: false }
          );
        await interaction.reply({ embeds: [embed], ephemeral: false });
        break;
      }

      case 'inventory': {
        const embed = new EmbedBuilder()
          .setColor('#8e44ad')
          .setTitle('🎒 مقتنياتي')
          .setDescription(`🎫 تذاكر اليانصيب: **${user.lotteryTickets || 0} تذكرة**\nلا تمتلك عناصر أخرى حتى الآن — تفضل بزيارة المتجر! 🛍️`);
        await interaction.reply({ embeds: [embed], ephemeral: false });
        break;
      }

      case 'help': {
        const embed = new EmbedBuilder()
          .setColor('#95a5a6')
          .setTitle('❓ دليل الأوامر الكامل')
          .setDescription('📊 الأوامر المالية:')
          .addFields(
            { name: '!قائمة', value: 'عرض القائمة الرئيسية', inline: true },
            { name: '!إيداع المبلغ', value: 'إيداع في البنك', inline: true },
            { name: '!سحب المبلغ', value: 'سحب من البنك', inline: true },
            { name: '!سرقة @شخص', value: 'محاولة سرقة', inline: true },
            { name: '\n🎮 الألعاب:', value: '', inline: false },
            { name: '!نرد مبلغ', value: 'لعب النرد', inline: true },
            { name: '!تخمين مبلغ', value: 'تخمين رقم 1-10', inline: true },
            { name: '!حجر مبلغ', value: 'حجر ورق مقص', inline: true },
            { name: '!عملة مبلغ وجه', value: 'رمي عملة', inline: true },
            { name: '!رقم مبلغ', value: 'أعلى رقم يفوز', inline: true },
            { name: '!حظ مبلغ', value: 'حظك اليوم؟', inline: true },
            { name: '\n🎫 اليانصيب:', value: '', inline: false },
            { name: '!تذكرة', value: 'شراء تذكرة يانصيب', inline: true },
            { name: '\n🎭 مهام:', value: '', inline: false },
            { name: '!مهمة', value: 'مهمة مخاطرة', inline: true },
            { name: '!صيد', value: 'صيد السمك', inline: true },
            { name: '!تنقيب', value: 'تنقيب عن كنز', inline: true },
            { name: '\n🔧 إداري:', value: '', inline: false },
            { name: '!تعويض @شخص مبلغ', value: 'إضافة رصيد', inline: true }
          );
        await interaction.reply({ embeds: [embed], ephemeral: false });
        break;
      }
    }
  } catch (e) {
    console.error('❌ خطأ معالجة الزر:', e);
    await interaction.reply({ content: '⚠️ حدث خطأ، حاول مرة أخرى', ephemeral: true });
  }
  
  saveData();
});

// ========== معالجة الأوامر النصية ==========
client.on(Events.MessageCreate, async message => {
  if (message.author.bot || !message.guild) return;
  
  const content = message.content.trim();
  const lowerContent = content.toLowerCase();
  const args = content.split(' ');
  const cmd = args[0].toLowerCase();
  
  // أمر عرض القائمة الرئيسية
  if (['!قائمة', '!الرئيسية', '!بداية', 'الوحة'].includes(lowerContent)) {
    await sendMainMenu(message.channel);
    return;
  }
  
  // !إيداع
  if (cmd === '!إيداع' || cmd === '!ايداع') {
    const amount = parseInt(args[1]);
    const user = ensureUser(message.author.id);
    if (isNaN(amount) || amount <= 0 || amount > user.balance) {
      await message.reply('❌ مبلغ غير صالح أو رصيدك لا يكفي\nمثال: `!إيداع 100`');
      return;
    }
    user.balance -= amount;
    user.bank += amount;
    const ach = checkAchievements(user, message.author.id);
    saveData();
    await message.reply(`✅ تم إيداع **${amount} دينار** في بنكك! 🏦${ach ? `\n${ach}` : ''}`);
    return;
  }
  
  // !سحب
  if (cmd === '!سحب') {
    const amount = parseInt(args[1]);
    const user = ensureUser(message.author.id);
    if (isNaN(amount) || amount <= 0 || amount > user.bank) {
      await message.reply('❌ مبلغ غير صالح أو رصيدك في البنك لا يكفي\nمثال: `!سحب 100`');
      return;
    }
    user.bank -= amount;
    user.balance += amount;
    saveData();
    await message.reply(`✅ تم سحب **${amount} دينار** من بنكك! 💳`);
    return;
  }

  // !سرقة / !نهب
  if (cmd === '!سرقة' || cmd === '!نهب') {
    const now = Date.now();
    const target = message.mentions.users.first();
    const user = ensureUser(message.author.id);
    
    if (!target) {
      await message.reply('❌ اذكر الشخص مثال: `!سرقة @الشخص`');
      return;
    }
    
    if (target.id === message.author.id) {
      await message.reply('❌ لا يمكنك سرقة نفسك!');
      return;
    }
    
    const targetUser = ensureUser(target.id);
    
    if (now - user.lastRob < ROB_COOLDOWN) {
      const m = Math.ceil((ROB_COOLDOWN - (now - user.lastRob)) / 60000);
      await message.reply(`⏳ انتظر **${m} دقيقة** قبل محاولة السرقة مرة أخرى`);
      return;
    }
    
    if (targetUser.balance < ROB_MIN_TARGET) {
      await message.reply('❌ هذا الشخص لا يمتلك ما يكفي من المال لسرقته');
      return;
    }
    
    user.lastRob = now;
    
    if (Math.random() < ROB_CHANCE) {
      const stolen = Math.floor(targetUser.balance * 0.15);
      targetUser.balance -= stolen;
      user.balance = Math.min(MAX_MONEY, user.balance + stolen);
      saveData();
      await message.reply(`✅ نجحت السرقة! حصلت على **${stolen} دينار** من ${target.username} 💰`);
    } else {
      saveData();
      await message.reply(`❌ فشلت محاولتك! تم اكتشافك وهرب ${target.username} بسلام 😅`);
    }
    return;
  }

  // 🎮 لعبة النرد
  if (cmd === '!نرد') {
    const amount = parseInt(args[1]);
    const user = ensureUser(message.author.id);
    
    if (isNaN(amount) || amount <= 0) {
      await message.reply('❌ استخدم مثال: `!نرد 50`');
      return;
    }
    
    if (amount > user.balance) {
      await message.reply('❌ رصيدك لا يكفي لهذا المبلغ!');
      return;
    }
    
    const userDice = Math.floor(Math.random() * 6) + 1;
    const botDice = Math.floor(Math.random() * 6) + 1;
    
    user.gamesPlayed = (user.gamesPlayed || 0) + 1;
    let resultText = '';
    
    if (userDice > botDice) {
      user.balance = Math.min(MAX_MONEY, user.balance + amount);
      user.gamesWon = (user.gamesWon || 0) + 1;
      resultText = `✅ لقد فزت! 🎉\n🎲 نردك: **${userDice}** | نردي: **${botDice}**\n💰 أضفت **${amount} دينار** إلى رصيدك`;
    } else if (userDice < botDice) {
      user.balance -= amount;
      user.gamesLost = (user.gamesLost || 0) + 1;
      resultText = `❌ لقد خسرت 😔\n🎲 نردك: **${userDice}** | نردي: **${botDice}**\n💸 خسرت **${amount} دينار**`;
    } else {
      resultText = `⚖️ تعادل!\n🎲 نردك: **${userDice}** | نردي: **${botDice}**\nلا شيء تغير`;
    }
    
    saveData();
    await message.reply(resultText);
    return;
  }

  // 🎮 لعبة التخمين
  if (cmd === '!تخمين') {
    const amount = parseInt(args[1]);
    const user = ensureUser(message.author.id);
    
    if (isNaN(amount) || amount <= 0) {
      await message.reply('❌ استخدم مثال: `!تخمين 50`');
      return;
    }
    
    if (amount > user.balance) {
      await message.reply('❌ رصيدك لا يكفي لهذا المبلغ!');
      return;
    }
    
    const secret = Math.floor(Math.random() * 10) + 1;
    user.gamesPlayed = (user.gamesPlayed || 0) + 1;
    
    await message.reply('🔢 اختر رقماً من **1 إلى 10** وأرسله في الدردشة! لديك **15 ثانية** ⏳');
    
    const filter = m => m.author.id === message.author.id && /^([1-9]|10)$/.test(m.content.trim());
    const collector = message.channel.createMessageCollector({ filter, time: 15000, max: 1 });
    
    collector.on('collect', guessMsg => {
      const guess = parseInt(guessMsg.content.trim());
      if (guess === secret) {
        user.balance = Math.min(MAX_MONEY, user.balance + amount * 2);
        user.gamesWon = (user.gamesWon || 0) + 1;
        message.channel.send(`✅ صحيح! الرقم كان **${secret}** 🎉\n💰 حصلت على **${amount * 2} دينار**!`);
      } else {
        user.balance -= amount;
        user.gamesLost = (user.gamesLost || 0) + 1;
        message.channel.send(`❌ خطأ! الرقم الصحيح كان **${secret}** 😔\n💸 خسرت **${amount} دينار**`);
      }
      saveData();
    });
    
    collector.on('end', (_, reason) => {
      if (reason === 'time') {
        message.channel.send('⏳ انتهى الوقت! حاول مرة أخرى لاحقاً');
      }
    });
    return;
  }

  // 🎮 حجر ورق مقص
  if (cmd === '!حجر' || cmd === '!ورق' || cmd === '!مقص') {
    const choice = cmd.replace('!', '');
    const amount = parseInt(args[1]);
    const user = ensureUser(message.author.id);
    
    if (isNaN(amount) || amount <= 0) {
      await message.reply('❌ استخدم مثال: `!حجر 50` أو `!ورق 30` أو `!مقص 100`');
      return;
    }
    
    if (amount > user.balance) {
      await message.reply('❌ رصيدك لا يكفي لهذا المبلغ!');
      return;
    }
    
    const choices = ['حجر', 'ورق', 'مقص'];
    const botChoice = choices[Math.floor(Math.random() * 3)];
    user.gamesPlayed = (user.gamesPlayed || 0) + 1;
    
    let resultText = '';
    
    if (choice === botChoice) {
      resultText = `⚖️ تعادل!\nأنت: ${choice} | أنا: ${botChoice}\nلا شيء تغير`;
    } else if (
      (choice === 'حجر' && botChoice === 'مقص') ||
      (choice === 'ورق' && botChoice === 'حجر') ||
      (choice === 'مقص' && botChoice === 'ورق')
    ) {
      user.balance = Math.min(MAX_MONEY, user.balance + amount);
      user.gamesWon = (user.gamesWon || 0) + 1;
      resultText = `✅ لقد فزت! 🎉\nأنت: ${choice} | أنا: ${botChoice}\n💰 أضفت **${amount} دينار**`;
    } else {
      user.balance -= amount;
      user.gamesLost = (user.gamesLost || 0) + 1;
      resultText = `❌ لقد خسرت 😔\nأنت: ${choice} | أنا: ${botChoice}\n💸 خسرت **${amount} دينار**`;
    }
    
    saveData();
    await message.reply(resultText);
    return;
  }

  // 🎮 رمية عملة
  if (cmd === '!عملة' || cmd === '!عمله') {
    const amount = parseInt(args[1]);
    const pick = (args[2] || '').toLowerCase();
    const user = ensureUser(message.author.id);
    
    if (isNaN(amount) || amount <= 0 || !['وجه', 'خلف'].includes(pick)) {
      await message.reply('❌ استخدم مثال: `!عملة 50 وجه` أو `!عملة 50 خلف`');
      return;
    }
    
    if (amount > user.balance) {
      await message.reply('❌ رصيدك لا يكفي لهذا المبلغ!');
      return;
    }
    
    const result = Math.random() < 0.5 ? 'وجه' : 'خلف';
    user.gamesPlayed = (user.gamesPlayed || 0) + 1;
    
    if (pick === result) {
      user.balance = Math.min(MAX_MONEY, user.balance + amount);
      user.gamesWon = (user.gamesWon || 0) + 1;
      saveData();
      await message.reply(`💰 الرمية: **${result}**\n✅ لقد فزت! أضفت **${amount} دينار** 🎉`);
    } else {
      user.balance -= amount;
      user.gamesLost = (user.gamesLost || 0) + 1;
      saveData();
      await message.reply(`💰 الرمية: **${result}**\n❌ لقد خسرت! خسرت **${amount} دينار** 😔`);
    }
    return;
  }

  // 🎮 أعلى رقم
  if (cmd === '!رقم') {
    const amount = parseInt(args[1]);
    const user = ensureUser(message.author.id);
    
    if (isNaN(amount) || amount <= 0) {
      await message.reply('❌ استخدم مثال: `!رقم 50`');
      return;
    }
    
    if (amount > user.balance) {
      await message.reply('❌ رصيدك لا يكفي لهذا المبلغ!');
      return;
    }
    
    const userNum = Math.floor(Math.random() * 100) + 1;
    const botNum = Math.floor(Math.random() * 100) + 1;
    user.gamesPlayed = (user.gamesPlayed || 0) + 1;
    
    if (userNum > botNum) {
      user.balance = Math.min(MAX_MONEY, user.balance + amount);
      user.gamesWon = (user.gamesWon || 0) + 1;
      saveData();
      await message.reply(`🔢 رقمك: **${userNum}** | رقمي: **${botNum}**\n✅ رقمك أعلى! فزت بـ **${amount} دينار** 🎉`);
    } else if (userNum < botNum) {
      user.balance -= amount;
      user.gamesLost = (user.gamesLost || 0) + 1;
      saveData();
      await message.reply(`🔢 رقمك: **${userNum}** | رقمي: **${botNum}**\n❌ رقمي أعلى! خسرت **${amount} دينار** 😔`);
    } else {
      await message.reply(`🔢 رقمك: **${userNum}** | رقمي: **${botNum}**\n⚖️ تعادل! لا شيء تغير`);
    }
    return;
  }

  // 🎮 لعبة الحظ
  if (cmd === '!حظ') {
    const amount = parseInt(args[1]);
    const user = ensureUser(message.author.id);
    
    if (isNaN(amount) || amount <= 0) {
      await message.reply('❌ استخدم مثال: `!حظ 50`');
      return;
    }
    
    if (amount > user.balance) {
      await message.reply('❌ رصيدك لا يكفي لهذا المبلغ!');
      return;
    }
    
    const luck = Math.random();
    user.gamesPlayed = (user.gamesPlayed || 0) + 1;
    
    if (luck < 0.1) {
      user.balance = Math.min(MAX_MONEY, user.balance + amount * 5);
      user.gamesWon = (user.gamesWon || 0) + 1;
      saveData();
      await message.reply(`🌟 حظ مذهل! ✨\n💰 حصلت على **${amount * 5} دينار** (5 أضعاف المبلغ!) 🎉🎉🎉`);
    } else if (luck < 0.35) {
      user.balance = Math.min(MAX_MONEY, user.balance + amount * 2);
      user.gamesWon = (user.gamesWon || 0) + 1;
      saveData();
      await message.reply(`✨ حظ جيد!\n💰 حصلت على **${amount * 2} دينار** (ضعف المبلغ) 🎉`);
    } else if (luck < 0.55) {
      user.balance = Math.min(MAX_MONEY, user.balance + amount);
      user.gamesWon = (user.gamesWon || 0) + 1;
      saveData();
      await message.reply(`😊 حظ طيب!\n💰 حصلت على **${amount} دينار** 🎉`);
    } else if (luck < 0.8) {
      user.balance -= amount;
      user.gamesLost = (user.gamesLost || 0) + 1;
      saveData();
      await message.reply(`😅 لم يحالفك الحظ\n💸 خسرت **${amount} دينار**`);
    } else {
      user.balance -= Math.floor(amount * 1.5);
      user.gamesLost = (user.gamesLost || 0) + 1;
      saveData();
      await message.reply(`💔 حظ سيء جداً!\n💸 خسرت **${Math.floor(amount * 1.5)} دينار** حاول لاحقاً 😔`);
    }
    return;
  }

  // 🎫 اليانصيب
  if (cmd === '!تذكرة' || cmd === '!يانصيب') {
    const user = ensureUser(message.author.id);
    
    if (user.balance < LOTTERY_TICKET_PRICE) {
      await message.reply(`❌ تحتاج إلى **${LOTTERY_TICKET_PRICE} دينار** لشراء تذكرة`);
      return;
    }
    
    if (!data.lotteries.current) {
      data.lotteries.current = {
        participants: [],
        pot: 0,
        createdAt: Date.now()
      };
    }
    
    user.balance -= LOTTERY_TICKET_PRICE;
    data.lotteries.current.pot += LOTTERY_TICKET_PRICE;
    
    if (!data.lotteries.current.participants.includes(message.author.id)) {
      data.lotteries.current.participants.push(message.author.id);
    }
    user.lotteryTickets = (user.lotteryTickets || 0) + 1;
    
    saveData();
    await message.reply(`✅ تم شراء تذكرة يانصيب بـ **${LOTTERY_TICKET_PRICE} دينار** 🎫\n💰 الجائزة الحالية: **${data.lotteries.current.pot} دينار**\n👥 المشاركون: ${data.lotteries.current.participants.length}`);
    return;
  }

  // 🎭 مهمة
  if (cmd === '!مهمة' || cmd === '!مهمه') {
    const now = Date.now();
    const user = ensureUser(message.author.id);
    
    if (now - user.lastCrime < CRIME_COOLDOWN) {
      const m = Math.ceil((CRIME_COOLDOWN - (now - user.lastCrime)) / 60000);
      await message.reply(`⏳ أنت مطلوب حالياً! انتظر **${m} دقيقة** قبل محاولة مهمة أخرى`);
      return;
    }
    
    user.lastCrime = now;
    const success = Math.random() < 0.55;
    const reward = Math.floor(Math.random() * 80) + 30;
    
    if (success) {
      user.balance = Math.min(MAX_MONEY, user.balance + reward);
      saveData();
      await message.reply(`✅ نجحت المهمة! 🎉\n💰 حصلت على **${reward} دينار**`);
    } else {
      const fine = Math.floor(Math.random() * 40) + 10;
      user.balance = Math.max(0, user.balance - fine);
      saveData();
      await message.reply(`❌ ألقي القبض عليك! 😔\n💸 دفعت غرامة **${fine} دينار**`);
    }
    return;
  }

  // 🎣 صيد السمك
  if (cmd === '!صيد') {
    const user = ensureUser(message.author.id);
    const fish = [
      { name: 'سمكة صغيرة', emoji: '🐟', value: Math.floor(Math.random() * 15) + 5 },
      { name: 'سمكة كبيرة', emoji: '🐠', value: Math.floor(Math.random() * 30) + 20 },
      { name: 'سمكة ذهبية', emoji: '🐡', value: Math.floor(Math.random() * 50) + 40 },
      { name: 'أخطبوط', emoji: '🐙', value: Math.floor(Math.random() * 25) + 15 },
      { name: 'لا شيء', emoji: '🌊', value: 0 }
    ];
    const catchFish = fish[Math.floor(Math.random() * fish.length)];
    
    if (catchFish.value > 0) {
      user.balance = Math.min(MAX_MONEY, user.balance + catchFish.value);
      saveData();
      await message.reply(`${catchFish.emoji} اصطدت **${catchFish.name}**!\n💰 بعتها بـ **${catchFish.value} دينار**`);
    } else {
      await message.reply(`${catchFish.emoji} لم تصطد شيئاً هذه المرة 😅 حاول مجدداً!`);
    }
    return;
  }

  // ⛏️ تنقيب
  if (cmd === '!تنقيب') {
    const user = ensureUser(message.author.id);
    const finds = [
      { name: 'ذهب', emoji: '🥇', value: Math.floor(Math.random() * 60) + 50 },
      { name: 'فضة', emoji: '🥈', value: Math.floor(Math.random() * 35) + 25 },
      { name: 'ألماس', emoji: '💎', value: Math.floor(Math.random() * 100) + 80 },
      { name: 'حجارة عادية', emoji: '🪨', value: 0 },
      { name: 'عملات قديمة', emoji: '🪙', value: Math.floor(Math.random() * 20) + 10 }
    ];
    const found = finds[Math.floor(Math.random() * finds.length)];
    
    if (found.value > 0) {
      user.balance = Math.min(MAX_MONEY, user.balance + found.value);
      saveData();
      await message.reply(`${found.emoji} وجدت **${found.name}**!\n💰 قيمتها: **${found.value} دينار** 🎉`);
    } else {
      await message.reply(`${found.emoji} لم تجد سوى حجارة عادية 😅 حاول في مكان آخر!`);
    }
    return;
  }

  // 🔧 أمر التعويض (للمدير فقط)
  if (cmd === '!تعويض' || cmd === '!أعط' || cmd === '!اضافة') {
    if (!ADMIN_IDS.includes(message.author.id)) {
      await message.reply('❌ هذا الأمر مخصص للمدير فقط');
      return;
    }
    
    const target = message.mentions.users.first();
    let amount = 0;
    
    if (target && args[2]) {
      amount = parseInt(args[2]);
    } else if (args[1]) {
      amount = parseInt(args[1]);
    }
    
    if (!target || isNaN(amount) || amount <= 0) {
      await message.reply('❌ استخدم مثال: `!تعويض @الشخص 100`');
      return;
    }
    
    const targetUser = ensureUser(target.id);
    targetUser.balance = Math.min(MAX_MONEY, targetUser.balance + amount);
    saveData();
    await message.reply(`✅ تم إضافة **${amount} دينار** إلى رصيد ${target.username}`);
    return;
  }
});

// ========== تشغيل البوت ==========
client.once(Events.ClientReady, () => {
  console.log(`✅ البوت جاهز! تم تسجيل الدخول كـ: ${client.user.tag}`);
  console.log(`💡 استخدم الأمر !قائمة لعرض لوحة التحكم`);
  loadData();
});

async function main() {
  loadData();
  await client.login(TOKEN);
}

main().catch(e => {
  console.error('❌ فشل تشغيل البوت:', e);
  process.exit(1);
});

process.on('SIGTERM', async () => {
  console.log('📤 إيقاف البوت...');
  saveData();
  await client.destroy().catch(() => {});
  process.exit(0);
});
