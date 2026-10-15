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
let data = { users: {}, lotteries: {} };

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const saved = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      // دمج البيانات القديمة مع الهيكل الجديد
      data.users = saved.users || {};
      data.lotteries = saved.lotteries || {};
      console.log('✅ تم تحميل البيانات بنجاح');
    } else {
      data = { users: {}, lotteries: {} };
      saveData();
      console.log('📄 تم إنشاء ملف بيانات جديد');
    }
  } catch (e) {
    console.error('⚠️ خطأ تحميل البيانات:', e.message);
    data = { users: {}, lotteries: {} };
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

// ========== نظام اليانصيب ==========
function initLottery() {
  if (!data.lotteries) {
    data.lotteries = {};
  }
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
    console.log('🎫 لا يوجد مشاركون في اليانصيب هذه الجولة');
    lottery.createdAt = Date.now();
    saveData();
    return;
  }
  
  const winnerId = lottery.participants[Math.floor(Math.random() * lottery.participants.length)];
  const prize = lottery.pot;
  const winner = ensureUser(winnerId);
  
  winner.balance = Math.min(MAX_MONEY, winner.balance + prize);
  
  try {
    for (const guild of client.guilds.cache.values()) {
      const member = await guild.members.fetch(winnerId).catch(() => null);
      if (member) {
        const embed = new EmbedBuilder()
          .setColor('#f1c40f')
          .setTitle('🎉 تهانينا! لقد فزت باليانصيب!')
          .setDescription(`💰 الجائزة: **${prize} دينار**\n👥 عدد المشاركين: ${lottery.participants.length}`)
          .setTimestamp();
        await member.send({ embeds: [embed] }).catch(() => {});
        break;
      }
    }
  } catch (e) {
    console.log('ℹ️ لم يتم إرسال رسالة خاصة للفائز');
  }
  
  console.log(`🎫 تم السحب! الفائز: ${winnerId} | الجائزة: ${prize} دينار`);
  
  data.lotteries.current = {
    participants: [],
    pot: 0,
    createdAt: Date.now()
  };
  
  saveData();
}

setInterval(() => {
  console.log('🎫 جاري سحب اليانصيب...');
  drawLottery();
}, LOTTERY_DRAW_TIME);

function checkMissedDraw() {
  initLottery();
  const lottery = data.lotteries.current;
  if (Date.now() - lottery.createdAt >= LOTTERY_DRAW_TIME) {
    console.log('🎫 سحب فات — جاري السحب الآن...');
    drawLottery();
  }
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
        const embed = new EmbedBuilder()
          .setColor('#3498db')
          .setTitle('💳 حسابي')
          .addFields(
            { name: '💰 الرصيد الحالي', value: `${user.balance} دينار`, inline: true },
            { name: '🏦 في البنك', value: `${user.bank} دينار`, inline: true },
            { name: '🎮 ألعاب', value: `${user.gamesWon || 0} فوز / ${user.gamesLost || 0} خسارة`, inline: true },
            { name: '🔥 سلسلة يومية', value: `${user.streak || 0} أيام متتالية`, inline: true },
            { name: '📅 عضو منذ', value: `<t:${Math.floor(user.createdAt/1000)}:R>`, inline: true }
          );
        await interaction.reply({ embeds: [embed], ephemeral: false });
        break;
      }

      case 'bank': {
        const embed = new EmbedBuilder()
          .setColor('#9b59b6')
          .setTitle('🏛️ البنك')
          .setDescription('إيداع وسحب الأموال بأمان')
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
          
          const embed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle('🎁 المكافأة اليومية')
            .setDescription(`✅ حصلت على **${totalAmount} دينار**! 🎉\n🔥 سلسلتك: **${user.streak} يوم متتالي**\n\nأعد الزيارة غداً`);
          await interaction.reply({ embeds: [embed], ephemeral: false });
        } else {
          const h = Math.floor((DAILY_COOLDOWN - (now - user.lastDaily)) / 3600000);
          const m = Math.floor(((DAILY_COOLDOWN - (now - user.lastDaily)) % 3600000) / 60000);
          const embed = new EmbedBuilder()
            .setColor('#f39c12')
            .setTitle('⏳ انتظر قليلاً')
            .setDescription(`عود بعد **${h} ساعة و ${m} دقيقة** للمكافأة اليومية`);
          await interaction.reply({ embeds: [embed], ephemeral: false });
        }
        break;
      }

      case 'games': {
        const embed = new EmbedBuilder()
          .setColor('#9b59b6')
          .setTitle('🎮 صالة الألعاب')
          .setDescription('ألعاب ممتعة لكسب المال 🎉')
          .addFields(
            { name: '🎲 النرد', value: 'اكتب: !نرد المبلغ', inline: false },
            { name: '🔢 تخمين الرقم', value: 'اكتب: !تخمين المبلغ', inline: false },
            { name: '✊ حجر ورق مقص', value: 'اكتب: !حجر المبلغ', inline: false },
            { name: '🪙 رمية عملة', value: 'اكتب: !عملة المبلغ وجه', inline: false }
          );
        await interaction.reply({ embeds: [embed], ephemeral: false });
        break;
      }

      case 'lottery': {
        initLottery();
        const lottery = data.lotteries.current;
        const timeLeftMs = LOTTERY_DRAW_TIME - (now - lottery.createdAt);
        const timeLeft = Math.max(0, Math.ceil(timeLeftMs / 60000));
        
        const embed = new EmbedBuilder()
          .setColor('#e74c3c')
          .setTitle('🎫 اليانصيب')
          .setDescription('اشترِ تذكرة واربح الجائزة الكبرى! 🎉')
          .addFields(
            { name: '💰 الجائزة الحالية', value: `**${lottery.pot} دينار**`, inline: true },
            { name: '👥 المشاركون', value: `${lottery.participants.length} شخص`, inline: true },
            { name: '⏳ وقت السحب القادم', value: `${timeLeft} دقيقة`, inline: true },
            { name: '💵 سعر التذكرة', value: `**${LOTTERY_TICKET_PRICE} دينار**`, inline: true },
            { name: 'كيفية المشاركة', value: 'اكتب في الدردشة: `!تذكرة`', inline: false }
          )
          .setFooter({ text: `لديك: ${user.lotteryTickets || 0} تذكرة` });
        await interaction.reply({ embeds: [embed], ephemeral: false });
        break;
      }

      case 'crime': {
        const embed = new EmbedBuilder()
          .setColor('#34495e')
          .setTitle('🎭 مغامرات يومية')
          .setDescription('أوامر ممتعة لكسب المال بشكل عشوائي')
          .addFields(
            { name: '🏃 مهمة مخاطرة', value: 'اكتب: !مهمة — ربح أو غرامة', inline: false },
            { name: '🎣 صيد السمك', value: 'اكتب: !صيد — اصطد واربح', inline: false },
            { name: '⛏️ تنقيب عن كنز', value: 'اكتب: !تنقيب — قد تجد ذهباً', inline: false }
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
            .setTitle('💼 العمل')
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

      case 'help': {
        const embed = new EmbedBuilder()
          .setColor('#95a5a6')
          .setTitle('❓ دليل الأوامر')
          .setDescription('📊 المالية:')
          .addFields(
            { name: '!قائمة', value: 'عرض لوحة التحكم', inline: true },
            { name: '!إيداع مبلغ', value: 'إيداع في البنك', inline: true },
            { name: '!سحب مبلغ', value: 'سحب من البنك', inline: true },
            { name: '!سرقة @شخص', value: 'محاولة سرقة', inline: true },
            { name: '\n🎮 الألعاب:', value: '', inline: false },
            { name: '!نرد مبلغ', value: 'لعبة النرد', inline: true },
            { name: '!تخمين مبلغ', value: 'تخمين رقم', inline: true },
            { name: '!حجر مبلغ', value: 'حجر ورق مقص', inline: true },
            { name: '!عملة مبلغ وجه', value: 'رمي عملة', inline: true },
            { name: '\n🎫 اليانصيب:', value: '', inline: false },
            { name: '!تذكرة', value: 'شراء تذكرة يانصيب', inline: true },
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
  
  if (['!قائمة', '!الرئيسية', '!بداية'].includes(lowerContent)) {
    await sendMainMenu(message.channel);
    return;
  }
  
  if (cmd === '!إيداع' || cmd === '!ايداع') {
    const amount = parseInt(args[1]);
    const user = ensureUser(message.author.id);
    if (isNaN(amount) || amount <= 0 || amount > user.balance) {
      await message.reply('❌ مبلغ غير صالح\nمثال: `!إيداع 100`');
      return;
    }
    user.balance -= amount;
    user.bank += amount;
    saveData();
    await message.reply(`✅ تم إيداع **${amount} دينار**! 🏦`);
    return;
  }
  
  if (cmd === '!سحب') {
    const amount = parseInt(args[1]);
    const user = ensureUser(message.author.id);
    if (isNaN(amount) || amount <= 0 || amount > user.bank) {
      await message.reply('❌ مبلغ غير صالح\nمثال: `!سحب 100`');
      return;
    }
    user.bank -= amount;
    user.balance += amount;
    saveData();
    await message.reply(`✅ تم سحب **${amount} دينار**! 💳`);
    return;
  }

  if (cmd === '!تذكرة' || cmd === '!يانصيب') {
    initLottery();
    const user = ensureUser(message.author.id);
    
    if (user.balance < LOTTERY_TICKET_PRICE) {
      await message.reply(`❌ تحتاج إلى **${LOTTERY_TICKET_PRICE} دينار** لشراء تذكرة`);
      return;
    }
    
    const lottery = data.lotteries.current;
    user.balance -= LOTTERY_TICKET_PRICE;
    lottery.pot += LOTTERY_TICKET_PRICE;
    
    if (!lottery.participants.includes(message.author.id)) {
      lottery.participants.push(message.author.id);
    }
    user.lotteryTickets = (user.lotteryTickets || 0) + 1;
    
    const timeLeft = Math.ceil((LOTTERY_DRAW_TIME - (Date.now() - lottery.createdAt)) / 60000);
    
    saveData();
    await message.reply(
      `✅ تم شراء تذكرة يانصيب! 🎫\n` +
      `💰 الجائزة الحالية: **${lottery.pot} دينار**\n` +
      `👥 المشاركون: ${lottery.participants.length}\n` +
      `⏳ السحب بعد: **${Math.max(0, timeLeft)} دقيقة**\n` +
      `🎫 تذاكرك الكلية: ${user.lotteryTickets}`
    );
    return;
  }

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
      await message.reply(`⏳ انتظر **${m} دقيقة**`);
      return;
    }
    if (targetUser.balance < ROB_MIN_TARGET) {
      await message.reply('❌ رصيد الشخص لا يكفي');
      return;
    }
    
    user.lastRob = now;
    
    if (Math.random() < ROB_CHANCE) {
      const stolen = Math.floor(targetUser.balance * 0.15);
      targetUser.balance -= stolen;
      user.balance = Math.min(MAX_MONEY, user.balance + stolen);
      await message.reply(`✅ نجحت! حصلت على **${stolen} دينار** من ${target.username} 💰`);
    } else {
      await message.reply(`❌ فشلت! تم اكتشافك 😅`);
    }
    saveData();
    return;
  }

  if (cmd === '!نرد') {
    const amount = parseInt(args[1]);
    const user = ensureUser(message.author.id);
    if (isNaN(amount) || amount <= 0 || amount > user.balance) {
      await message.reply('❌ استخدم: `!نرد 50`');
      return;
    }
    const u = Math.floor(Math.random() * 6) + 1;
    const b = Math.floor(Math.random() * 6) + 1;
    if (u > b) {
      user.balance += amount;
      await message.reply(`✅ فزت! 🎲 أنت:${u} أنا:${b} +${amount}`);
    } else if (u < b) {
      user.balance -= amount;
      await message.reply(`❌ خسرت 🎲 أنت:${u} أنا:${b} -${amount}`);
    } else {
      await message.reply(`⚖️ تعادل 🎲 أنت:${u} أنا:${b}`);
    }
    saveData();
    return;
  }

  if (cmd === '!تخمين') {
    const amount = parseInt(args[1]);
    const user = ensureUser(message.author.id);
    if (isNaN(amount) || amount <= 0 || amount > user.balance) {
      await message.reply('❌ استخدم: `!تخمين 50`');
      return;
    }
    const secret = Math.floor(Math.random() * 10) + 1;
    await message.reply('🔢 اختر رقماً من 1 إلى 10 لديك 15 ثانية!');
    
    const filter = m => m.author.id === message.author.id && /^([1-9]|10)$/.test(m.content.trim());
    const collector = message.channel.createMessageCollector({ filter, time: 15000, max: 1 });
    
    collector.on('collect', m => {
      const guess = parseInt(m.content);
      if (guess === secret) {
        user.balance += amount * 2;
        message.channel.send(`✅ صحيح! الرقم ${secret} 🎉 +${amount*2}`);
      } else {
        user.balance -= amount;
        message.channel.send(`❌ خطأ! الرقم كان ${secret} 😔 -${amount}`);
      }
      saveData();
    });
    return;
  }

  if (cmd === '!حجر' || cmd === '!ورق' || cmd === '!مقص') {
    const choice = cmd.slice(1);
    const amount = parseInt(args[1]);
    const user = ensureUser(message.author.id);
    const opts = ['حجر', 'ورق', 'مقص'];
    const bot = opts[Math.floor(Math.random() * 3)];
    
    if (isNaN(amount) || amount <= 0 || amount > user.balance) {
      await message.reply('❌ استخدم: `!حجر 50`');
      return;
    }
    
    let res = '';
    if (choice === bot) res = '⚖️ تعادل!';
    else if (
      (choice === 'حجر' && bot === 'مقص') ||
      (choice === 'ورق' && bot === 'حجر') ||
      (choice === 'مقص' && bot === 'ورق')
    ) {
      user.balance += amount;
      res = `✅ فزت! أنت:${choice} أنا:${bot} +${amount}`;
    } else {
      user.balance -= amount;
      res = `❌ خسرت! أنت:${choice} أنا:${bot} -${amount}`;
    }
    saveData();
    await message.reply(res);
    return;
  }

  if (cmd === '!عملة') {
    const amount = parseInt(args[1]);
    const pick = (args[2] || '').toLowerCase();
    const user = ensureUser(message.author.id);
    if (!['وجه', 'خلف'].includes(pick) || isNaN(amount) || amount <= 0 || amount > user.balance) {
      await message.reply('❌ استخدم: `!عملة 50 وجه`');
      return;
    }
    const res = Math.random() < 0.5 ? 'وجه' : 'خلف';
    if (pick === res) {
      user.balance += amount;
      await message.reply(`🪙 ${res} — ✅ فزت! +${amount}`);
    } else {
      user.balance -= amount;
      await message.reply(`🪙 ${res} — ❌ خسرت! -${amount}`);
    }
    saveData();
    return;
  }

  if (cmd === '!مهمة') {
    const now = Date.now();
    const user = ensureUser(message.author.id);
    if (now - user.lastCrime < CRIME_COOLDOWN) {
      const m = Math.ceil((CRIME_COOLDOWN - (now - user.lastCrime)) / 60000);
      await message.reply(`⏳ انتظر **${m} دقيقة**`);
      return;
    }
    user.lastCrime = now;
    if (Math.random() < 0.55) {
      const reward = Math.floor(Math.random() * 80) + 30;
      user.balance += reward;
      await message.reply(`✅ نجحت المهمة! +${reward} دينار 🎉`);
    } else {
      const fine = Math.floor(Math.random() * 40) + 10;
      user.balance = Math.max(0, user.balance - fine);
      await message.reply(`❌ ألقي القبض عليك! -${fine} دينار 😔`);
    }
    saveData();
    return;
  }

  if (cmd === '!صيد') {
    const user = ensureUser(message.author.id);
    const fish = [
      { e: '🐟', n: 'سمكة صغيرة', v: Math.floor(Math.random() * 15) + 5 },
      { e: '🐠', n: 'سمكة كبيرة', v: Math.floor(Math.random() * 30) + 20 },
      { e: '🐡', n: 'سمكة ذهبية', v: Math.floor(Math.random() * 50) + 40 },
      { e: '🌊', n: 'لا شيء', v: 0 }
    ];
    const f = fish[Math.floor(Math.random() * fish.length)];
    if (f.v > 0) {
      user.balance += f.v;
      await message.reply(`${f.e} اصطدت ${f.n}! +${f.v} دينار`);
    } else {
      await message.reply(`${f.e} لم تصطد شيئاً 😅`);
    }
    saveData();
    return;
  }

  if (cmd === '!تنقيب') {
    const user = ensureUser(message.author.id);
    const items = [
      { e: '🥇', n: 'ذهب', v: Math.floor(Math.random() * 60) + 50 },
      { e: '💎', n: 'ألماس', v: Math.floor(Math.random() * 100) + 80 },
      { e: '🪙', n: 'عملات قديمة', v: Math.floor(Math.random() * 20) + 10 },
      { e: '🪨', n: 'حجارة', v: 0 }
    ];
    const found = items[Math.floor(Math.random() * items.length)];
    if (found.v > 0) {
      user.balance += found.v;
      await message.reply(`${found.e} وجدت ${found.n}! +${found.v} دينار 🎉`);
    } else {
      await message.reply(`${found.e} لم تجد شيئاً 😅`);
    }
    saveData();
    return;
  }

  if (cmd === '!تعويض' || cmd === '!أعط') {
    if (!ADMIN_IDS.includes(message.author.id)) {
      await message.reply('❌ للمدير فقط');
      return;
    }
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
  checkMissedDraw();
  console.log('🎫 نظام اليانصيب جاهز — السحب كل ساعة');
});

async function main() {
  loadData();
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
