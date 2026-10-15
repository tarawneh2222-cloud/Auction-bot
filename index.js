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

// خادم ويب لمراقبة UptimeRobot
const web = express();
web.get('/', (_req, res) => {
  res.status(200).send('✅ بوت مزادات يعمل بنجاح');
});
web.get('/health', (_req, res) => {
  res.json({ ok: true });
});
web.listen(Number(process.env.PORT) || 3000, '0.0.0.0');

// مسار ملف البيانات
const DATA_PATH = path.join(__dirname, 'data.json');

// التأكد من وجود ملف البيانات وإنشائه إذا لم يكن موجوداً
function initData() {
  if (!fs.existsSync(DATA_PATH)) {
    fs.writeFileSync(DATA_PATH, JSON.stringify({
      users: {},
      auctions: [],
      missions: {},
      market: { prices: { gold: 100, oil: 50, wheat: 30 } }
    }, null, 2));
  }
}

// قراءة البيانات
function readData() {
  initData();
  try {
    const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    if (!data.users) data.users = {};
    if (!data.auctions) data.auctions = [];
    if (!data.missions) data.missions = {};
    if (!data.market) data.market = { prices: { gold: 100, oil: 50, wheat: 30 } };
    return data;
  } catch (err) {
    return { users: {}, auctions: [], missions: {}, market: { prices: { gold: 100, oil: 50, wheat: 30 } } };
  }
}

// حفظ البيانات
function saveData(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

// الحصول على بيانات المستخدم
function getUserData(userId) {
  const data = readData();
  if (!data.users[userId]) {
    data.users[userId] = {
      balance: 1000,
      bank: 0,
      stocks: { gold: 0, oil: 0, wheat: 0 },
      dailyLast: 0,
      gamesPlayed: 0
    };
  }
  return data.users[userId];
}

// إنشاء العميل
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// عند جاهزية البوت
client.once(Events.ClientReady, () => {
  console.log(`✅ بوت ${client.user.tag} يعمل بنجاح!`);
  console.log('✅ استخدم !قائمة لعرض القائمة الرئيسية');
});

// معالجة الأوامر النصية
client.on(Events.MessageCreate, async message => {
  if (message.author.bot) return;
  const content = message.content.trim();
  const userId = message.author.id;

  // القائمة الرئيسية
  if (content === '!قائمة' || content === '!القائمة') {
    const embed = new EmbedBuilder()
      .setTitle('🏛️ مركز الاقتصاد')
      .setDescription('مرحباً بك! اختر من الأزرار أدناه ما تريد:')
      .setColor('#2b90d9')
      .setFooter({ text: 'اقتصاد افتراضي • لا توجد أموال حقيقية' });

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('account').setLabel('💳 حسابي').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('bank').setLabel('🏦 البنك').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('daily').setLabel('🎁 المكافأة اليومية').setStyle(ButtonStyle.Success)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('portfolio').setLabel('📈 محفظتي').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('market').setLabel('📊 السوق').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('games').setLabel('🎮 الألعاب').setStyle(ButtonStyle.Danger)
    );

    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('jobs').setLabel('💼 الوظائف').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('auctions').setLabel('🏘️ المزادات').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('leaderboard').setLabel('🏆 الترتيب').setStyle(ButtonStyle.Secondary)
    );

    const row4 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('shop').setLabel('🛒 المتجر').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('missions').setLabel('🎒 مهماتي').setStyle(ButtonStyle.Primary)
    );

    await message.reply({ embeds: [embed], components: [row1, row2, row3, row4] });
    return;
  }

  // مساعدة
  if (content === '!مساعدة' || content === '!اوامر') {
    const embed = new EmbedBuilder()
      .setTitle('📜 قائمة الأوامر')
      .addFields(
        { name: '!قائمة', value: 'عرض القائمة الرئيسية مع جميع الخيارات' },
        { name: '!حساب', value: 'عرض رصيدك ومعلومات حسابك' },
        { name: '!بنك', value: 'إيداع وسحب من البنك' },
        { name: '!يومية', value: 'الحصول على مكافأتك اليومية' },
        { name: '!سوق', value: 'أسعار الأسهم والمعادن' },
        { name: '!الترتيب', value: 'أغنى اللاعبين' }
      )
      .setColor('#2ecc71');
    await message.reply({ embeds: [embed] });
    return;
  }

  // حسابي
  if (content === '!حسابي' || content === '!حساب') {
    const user = getUserData(userId);
    const embed = new EmbedBuilder()
      .setTitle(`💳 حسابك — ${message.author.username}`)
      .addFields(
        { name: '💰 النقدي', value: `${user.balance} دولار`, inline: true },
        { name: '🏦 في البنك', value: `${user.bank} دولار`, inline: true },
        { name: '📊 المجموع', value: `${user.balance + user.bank} دولار`, inline: true }
      )
      .setColor('#3498db');
    await message.reply({ embeds: [embed] });
    return;
  }

  // المكافأة اليومية
  if (content === '!يومية' || content === '!يومي') {
    const data = readData();
    const user = getUserData(userId);
    const today = new Date().toDateString();
    
    if (user.dailyLast === today) {
      await message.reply('⏳ لقد حصلت على مكافأتك اليومية بالفعل! عد غداً للحصول على المزيد.');
      return;
    }
    
    const amount = 250;
    user.balance += amount;
    user.dailyLast = today;
    data.users[userId] = user;
    saveData(data);
    
    await message.reply(`🎁 **تهانينا!** حصلت على مكافأتك اليومية بقيمة **${amount} دولار**!💰`);
    return;
  }

  // السوق
  if (content === '!سوق') {
    const data = readData();
    const embed = new EmbedBuilder()
      .setTitle('📊 أسعار السوق الحالية')
      .addFields(
        { name: '🥇 ذهب', value: `${data.market.prices.gold} $`, inline: true },
        { name: '🛢️ نفط', value: `${data.market.prices.oil} $`, inline: true },
        { name: '🌾 قمح', value: `${data.market.prices.wheat} $`, inline: true }
      )
      .setColor('#9b59b6')
      .setFooter({ text: 'الأسعار تتغير دورياً • استخدم !شراء أو !بيع للتداول' });
    await message.reply({ embeds: [embed] });
    return;
  }

  // المتجر
  if (content === '!متجر') {
    const embed = new EmbedBuilder()
      .setTitle('🛒 المتجر')
      .setDescription('قائمة العناصر المتاحة للشراء:')
      .addFields(
        { name: '🎟️ بطاقة سحب عشوائي - 500$', value: 'اكتب `!اشتري سحب`' },
        { name: '🛡️ حماية لمدة يوم - 1000$', value: 'اكتب `!اشتري حماية`' },
        { name: '💰 قرض سريع - فائدة 10%', value: 'اكتب `!قرض [المبلغ]`' }
      )
      .setColor('#e67e22');
    await message.reply({ embeds: [embed] });
    return;
  }

  // الترتيب
  if (content === '!ترتيب' || content === '!الترتيب') {
    const data = readData();
    const users = Object.entries(data.users)
      .map(([id, u]) => ({ id, total: (u.balance || 0) + (u.bank || 0), name: id }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
    
    let desc = '';
    users.forEach((u, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
      desc += `${medal} <@${u.id}> — **${u.total}** دولار\n`;
    });
    
    const embed = new EmbedBuilder()
      .setTitle('🏆 أغنى اللاعبين')
      .setDescription(desc || 'لا توجد بيانات بعد! كن الأول 🔥')
      .setColor('#f1c40f');
    await message.reply({ embeds: [embed] });
    return;
  }
});

// معالجة ضغط الأزرار
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton()) return;
  
  const userId = interaction.user.id;
  const user = getUserData(userId);

  try {
    switch (interaction.customId) {
      case 'account': {
        const embed = new EmbedBuilder()
          .setTitle('💳 معلومات حسابك')
          .addFields(
            { name: '💰 النقدي', value: `${user.balance} دولار`, inline: true },
            { name: '🏦 في البنك', value: `${user.bank} دولار`, inline: true },
            { name: '📊 المجموع', value: `${user.balance + user.bank} دولار`, inline: true }
          )
          .setColor('#3498db');
        await interaction.reply({ embeds: [embed], ephemeral: true });
        break;
      }

      case 'bank': {
        const embed = new EmbedBuilder()
          .setTitle('🏦 البنك')
          .setDescription(
            `رصيدك النقدي: **${user.balance}** دولار\n` +
            `رصيدك في البنك: **${user.bank}** دولار\n\n` +
            'اكتب:\n' +
            '`!إيداع المبلغ` — لوضع المال في البنك\n' +
            '`!سحب المبلغ` — لاسترداد المال من البنك'
          )
          .setColor('#1abc9c');
        await interaction.reply({ embeds: [embed], ephemeral: true });
        break;
      }

      case 'daily': {
        const data = readData();
        const today = new Date().toDateString();
        if (user.dailyLast === today) {
          await interaction.reply({ content: '⏳ لقد استلمت مكافأتك اليومية بالفعل! عد غداً.', ephemeral: true });
        } else {
          const amount = 250;
          user.balance += amount;
          user.dailyLast = today;
          data.users[userId] = user;
          saveData(data);
          await interaction.reply({ content: `🎁 تم إضافة **${amount} دولار** إلى رصيدك بنجاح!`, ephemeral: true });
        }
        break;
      }

      case 'portfolio': {
        const embed = new EmbedBuilder()
          .setTitle('📈 محفظتك الاستثمارية')
          .addFields(
            { name: '🥇 ذهب', value: `${user.stocks.gold || 0} وحدة`, inline: true },
            { name: '🛢️ نفط', value: `${user.stocks.oil || 0} وحدة`, inline: true },
            { name: '🌾 قمح', value: `${user.stocks.wheat || 0} وحدة`, inline: true }
          )
          .setColor('#e74c3c');
        await interaction.reply({ embeds: [embed], ephemeral: true });
        break;
      }

      case 'market': {
        const data = readData();
        const embed = new EmbedBuilder()
          .setTitle('📊 السوق الحالي')
          .addFields(
            { name: '🥇 ذهب', value: `${data.market.prices.gold} $`, inline: true },
            { name: '🛢️ نفط', value: `${data.market.prices.oil} $`, inline: true },
            { name: '🌾 قمح', value: `${data.market.prices.wheat} $`, inline: true }
          )
          .setColor('#9b59b6')
          .setFooter({ text: 'الأسعار تتغير تلقائياً كل فترة' });
        await interaction.reply({ embeds: [embed], ephemeral: true });
        break;
      }

      case 'games': {
        const embed = new EmbedBuilder()
          .setTitle('🎮 الألعاب')
          .setDescription(
            'اختر لعبة:\n\n' +
            '🎲 `!نرد` — رمي النرد • 2x أرباح\n' +
            '🎯 `!رهان مبلغ خيار1 خيار2` — رهان بسيط\n' +
            '🔢 `!تخمين` — تخمين الرقم السري'
          )
          .setColor('#e74c3c');
        await interaction.reply({ embeds: [embed], ephemeral: true });
        break;
      }

      case 'jobs': {
        const embed = new EmbedBuilder()
          .setTitle('💼 الوظائف المتاحة')
          .setDescription(
            'أداء مهام بسيطة لكسب المال:\n\n' +
            '⛏️ `!عمل منجم` — 50-150 دولار\n' +
            '🌾 `!عمل مزارع` — 40-120 دولار\n' +
            '🛒 `!عمل متجر` — 60-180 دولار\n' +
            '⏳ كل وظيفة متاحة كل 5 دقائق'
          )
          .setColor('#d35400');
        await interaction.reply({ embeds: [embed], ephemeral: true });
        break;
      }

      case 'auctions': {
        const data = readData();
        const activeAuctions = data.auctions.filter(a => a.active).length;
        const embed = new EmbedBuilder()
          .setTitle('🏘️ نظام المزادات')
          .setDescription(
            `المزادات النشطة حالياً: **${activeAuctions}**\n\n` +
            'الأوامر المتاحة:\n' +
            '`!مزادات` — عرض المزادات النشطة\n' +
            '`!مزاد سعر وصف` — إنشاء مزاد جديد\n' +
            '`!مزايدة المبلغ` — المشاركة في مزاد'
          )
          .setColor('#8e44ad');
        await interaction.reply({ embeds: [embed], ephemeral: true });
        break;
      }

      case 'leaderboard': {
        const data = readData();
        const users = Object.entries(data.users)
          .map(([id, u]) => ({ id, total: (u.balance || 0) + (u.bank || 0) }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 5);
        
        let desc = '';
        users.forEach((u, i) => {
          const m = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
          desc += `${m} <@${u.id}> — **${u.total}**$\n`;
        });
        
        const embed = new EmbedBuilder()
          .setTitle('🏆 أغنى اللاعبين')
          .setDescription(desc || 'لا بيانات بعد!')
          .setColor('#f1c40f');
        await interaction.reply({ embeds: [embed], ephemeral: true });
        break;
      }

      case 'shop': {
        const embed = new EmbedBuilder()
          .setTitle('🛒 المتجر')
          .setDescription(
            'عناصر للشراء:\n\n' +
            '🎟️ سحب عشوائي — 500$ → `!اشتري سحب`\n' +
            '🛡️ حماية يوم — 1000$ → `!اشتري حماية`\n' +
            '💰 قرض سريع → `!قرض المبلغ`'
          )
          .setColor('#e67e22');
        await interaction.reply({ embeds: [embed], ephemeral: true });
        break;
      }

      case 'missions': {
        const embed = new EmbedBuilder()
          .setTitle('🎒 مهماتي')
          .setDescription(
            'المهام اليومية والأسبوعية:\n\n' +
            '✅ استخدم !يومية يومياً → 250$\n' +
            '✅ العب لعبة واحدة → 50$\n' +
            '✅ شارك في مزاد → 200$\n\n' +
            'تابع إنجازاتك وتسلق الترتيب!'
          )
          .setColor('#16a085');
        await interaction.reply({ embeds: [embed], ephemeral: true });
        break;
      }

      default:
        await interaction.reply({ content: '❌ خيار غير معروف! استخدم !قائمة مجدداً.', ephemeral: true });
        break;
    }
  } catch (err) {
    console.error('Error handling button:', err);
    if (!interaction.replied) {
      await interaction.reply({ content: '❌ حدث خطأ، حاول مرة أخرى.', ephemeral: true });
    }
  }
});

// معالجة الأخطاء
client.on(Events.ShardError, error => {
  console.error('WebSocket error:', error);
});

process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

// تسجيل الدخول
const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('❌ خطأ: متغير البيئة DISCORD_TOKEN غير مُعرف!');
  process.exit(1);
}

client.login(token)
  .then(() => console.log('⏳ جاري الاتصال بالديسكورد...'))
  .catch(err => {
    console.error('❌ فشل تسجيل الدخول:', err.message);
    process.exit(1);
  });
