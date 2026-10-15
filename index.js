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
      dailyLast: '',
      gamesPlayed: 0,
      lastJob: {},
      lastRob: 0
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

  // مساعدة الأوامر
  if (content === '!مساعدة' || content === '!اوامر') {
    const embed = new EmbedBuilder()
      .setTitle('📜 قائمة الأوامر')
      .addFields(
        { name: '!قائمة', value: 'عرض القائمة الرئيسية مع الأزرار' },
        { name: '!حساب', value: 'عرض رصيدك النقدي وفي البنك' },
        { name: '!إيداع [المبلغ]', value: 'إيداع أموال في البنك' },
        { name: '!سحب [المبلغ]', value: 'سحب أموال من البنك' },
        { name: '!يومية', value: 'استلام المكافأة اليومية' },
        { name: '!عمل [منجم/مزارع/متجر]', value: 'العمل لكسب المال' },
        { name: '!نرد', value: 'لعبة رمي النرد (مضاعفة الأموال)' },
        { name: '!نهب @الشخص', value: 'محاولة نهب أموال مستخدم آخر 🦹' },
        { name: '!سوق', value: 'عرض أسعار السوق والأسهم' },
        { name: '!الترتيب', value: 'عرض قائمة أغنى اللاعبين' }
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

  // الإيداع في البنك (!إيداع 500 أو !إيداع الكل)
  if (content.startsWith('!إيداع')) {
    const data = readData();
    const user = getUserData(userId);
    const args = content.split(' ');
    
    let amount = 0;
    if (args[1] === 'الكل' || args[1] === 'all') {
      amount = user.balance;
    } else {
      amount = parseInt(args[1]);
    }

    if (isNaN(amount) || amount <= 0) {
      await message.reply('❌ يرجى تحديد مبلغ صحيح للإيداع! مثال: `!إيداع 500` أو `!إيداع الكل`');
      return;
    }

    if (user.balance < amount) {
      await message.reply('❌ ليس لديك هذا المبلغ النقدي في محفظتك!');
      return;
    }

    user.balance -= amount;
    user.bank += amount;
    data.users[userId] = user;
    saveData(data);

    await message.reply(`✅ تم إيداع **${amount} دولار** في البنك بنجاح! 🏦`);
    return;
  }

  // السحب من البنك (!سحب 500 أو !سحب الكل)
  if (content.startsWith('!سحب')) {
    const data = readData();
    const user = getUserData(userId);
    const args = content.split(' ');

    let amount = 0;
    if (args[1] === 'الكل' || args[1] === 'all') {
      amount = user.bank;
    } else {
      amount = parseInt(args[1]);
    }

    if (isNaN(amount) || amount <= 0) {
      await message.reply('❌ يرجى تحديد مبلغ صحيح للسحب! مثال: `!سحب 500` أو `!سحب الكل`');
      return;
    }

    if (user.bank < amount) {
      await message.reply('❌ ليس لديك هذا المبلغ في البنك!');
      return;
    }

    user.bank -= amount;
    user.balance += amount;
    data.users[userId] = user;
    saveData(data);

    await message.reply(`✅ تم سحب **${amount} دولار** من البنك إلى رصيدك النقدي بنجاح! 💰`);
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
    
    await message.reply(`🎁 **تهانينا!** حصلت على مكافأتك اليومية بقيمة **${amount} دولار**! 💰`);
    return;
  }

  // نظام الوظائف (!عمل منجم / مزارع / متجر)
  if (content.startsWith('!عمل')) {
    const data = readData();
    const user = getUserData(userId);
    const args = content.split(' ');
    const jobType = args[1];

    const now = Date.now();
    const cooldown = 5 * 60 * 1000; // 5 دقائق كولداون

    if (!user.lastJob) user.lastJob = {};
    if (user.lastJob[jobType] && now - user.lastJob[jobType] < cooldown) {
      const remaining = Math.ceil((cooldown - (now - user.lastJob[jobType])) / 1000 / 60);
      await message.reply(`⏳ أنت متعب! يجب الانتظار **${remaining} دقائق** قبل العمل في هذه الوظيفة مجدداً.`);
      return;
    }

    let min = 0, max = 0, jobName = '';
    if (jobType === 'منجم') { min = 50; max = 150; jobName = 'منجم ⛏️'; }
    else if (jobType === 'مزارع') { min = 40; max = 120; jobName = 'مزارع 🌾'; }
    else if (jobType === 'متجر') { min = 60; max = 180; jobName = 'متجر 🛒'; }
    else {
      await message.reply('❌ الوظائف المتاحة:\n`!عمل منجم` (50-150$)\n`!عمل مزارع` (40-120$)\n`!عمل متجر` (60-180$)');
      return;
    }

    const earned = Math.floor(Math.random() * (max - min + 1)) + min;
    user.balance += earned;
    user.lastJob[jobType] = now;
    data.users[userId] = user;
    saveData(data);

    await message.reply(`💼 عملت بنجاح كـ **${jobName}** وكسبت **${earned} دولار**! 💵`);
    return;
  }

  // لعبة النرد (!نرد)
  if (content === '!نرد') {
    const data = readData();
    const user = getUserData(userId);
    const cost = 100;

    if (user.balance < cost) {
      await message.reply(`❌ تحتاج إلى **${cost} دولار** نقداً على الأقل للعب النرد!`);
      return;
    }

    user.balance -= cost;
    const playerRoll = Math.floor(Math.random() * 6) + 1;
    const botRoll = Math.floor(Math.random() * 6) + 1;

    if (playerRoll > botRoll) {
      const prize = cost * 2;
      user.balance += prize;
      data.users[userId] = user;
      saveData(data);
      await message.reply(`🎲 رميت النرد: **${playerRoll}** | البوت رمى: **${botRoll}**\n🎉 **فزت!** حصلت على **${prize} دولار**! 💰`);
    } else if (playerRoll === botRoll) {
      user.balance += cost; // استرجاع المبلغ
      data.users[userId] = user;
      saveData(data);
      await message.reply(`🎲 رميت النرد: **${playerRoll}** | البوت رمى: **${botRoll}**\n🤝 **تعادل!** تم استرجاع الـ ${cost} دولار.`);
    } else {
      data.users[userId] = user;
      saveData(data);
      await message.reply(`🎲 رميت النرد: **${playerRoll}** | البوت رمى: **${botRoll}**\n😢 **خسرت!** ذهبت الـ ${cost} دولار.`);
    }
    return;
  }

  // نظام النهب / السرقة الجديد (!نهب @الشخص)
  if (content.startsWith('!نهب') || content.startsWith('!سرقة')) {
    const target = message.mentions.users.first();
    if (!target) {
      await message.reply('❌ يرجى منشن الشخص الذي تريد نهبه! مثال: `!نهب @الشخص`');
      return;
    }
    if (target.id === userId) {
      await message.reply('❌ لا يمكنك نهب نفسك يا فالح! 😂');
      return;
    }
    if (target.bot) {
      await message.reply('❌ لا يمكنك نهب البوتات!');
      return;
    }

    const data = readData();
    const user = getUserData(userId);
    const targetData = getUserData(target.id);

    const now = Date.now();
    const cooldown = 15 * 60 * 1000; // 15 دقيقة كولداون بين عمليات النهب

    if (user.lastRob && now - user.lastRob < cooldown) {
      const remaining = Math.ceil((cooldown - (now - user.lastRob)) / 1000 / 60);
      await message.reply(`⏳ أنت متطلب فترة راحة بعد عملياتك الأخيرة! انتظر **${remaining} دقائق** قبل محاولة النهب مجدداً.`);
      return;
    }

    if (user.balance < 200) {
      await message.reply('❌ يجب أن تمتلك على الأقل **200 دولار** نقداً للمخاطرة ودفع الغرامات المحتملة للشرطة!');
      return;
    }

    if (targetData.balance < 150) {
      await message.reply('❌ هذا الشخص فقير جداً وليس لديه أموال نقدية كافية لكي تستحق المخاطرة!');
      return;
    }

    user.lastRob = now;

    // نسبة النجاح: 45%
    const success = Math.random() < 0.45;

    if (success) {
      // سرقة نسبة تتراوح بين 10% إلى 25% من رصيد الضحية النقدي
      const percent = Math.random() * 0.15 + 0.10; 
      const stolen = Math.floor(targetData.balance * percent);

      targetData.balance -= stolen;
      user.balance += stolen;

      data.users[userId] = user;
      data.users[target.id] = targetData;
      saveData(data);

      await message.reply(`🦹 **عملية نهب ناجحة!** تسللت ببراعة ونجحت في سرقة **${stolen} دولار** من <@${target.id}>! 💰🔥`);
    } else {
      // فشل النهب: دفع غرامة (مثلاً 150 دولار أو نصف الرصيد المتاح بحد أقصى)
      const fine = Math.min(user.balance, 150);
      user.balance -= fine;

      data.users[userId] = user;
      saveData(data);

      await message.reply(`🚨 **فشلت عملية النهب!** قبض عليك الحراس أثناء محاولتك وتم تغريمك بمبلغ **${fine} دولار**! 👮‍♂️❌`);
    }
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
      .setFooter({ text: 'الأسعار تتغير دورياً' });
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
        { name: '🛡️ حماية ضد النهب ليوم - 1000$', value: 'اكتب `!اشتري حماية`' }
      )
      .setColor('#e67e22');
    await message.reply({ embeds: [embed] });
    return;
  }

  // الترتيب
  if (content === '!ترتيب' || content === '!الترتيب') {
    const data = readData();
    const users = Object.entries(data.users)
      .map(([id, u]) => ({ id, total: (u.balance || 0) + (u.bank || 0) }))
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
            'الأوامر المتاحة:\n' +
            '`!إيداع [المبلغ]` أو `!إيداع الكل`\n' +
            '`!سحب [المبلغ]` أو `!سحب الكل`'
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
            '🎲 `!نرد` — رمي النرد (يكلف 100$ ويربح الضعف)\n' +
            '🦹 `!نهب @الشخص` — محاولة سرقة أموال لاعب آخر'
          )
          .setColor('#e74c3c');
        await interaction.reply({ embeds: [embed], ephemeral: true });
        break;
      }

      case 'jobs': {
        const embed = new EmbedBuilder()
          .setTitle('💼 الوظائف المتاحة')
          .setDescription(
            'أداء مهام بسيطة لكسب المال (كل 5 دقائق):\n\n' +
            '⛏️ `!عمل منجم` — 50-150 دولار\n' +
            '🌾 `!عمل مزارع` — 40-120 دولار\n' +
            '🛒 `!عمل متجر` — 60-180 دولار'
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
            '`!مزادات` — عرض المزادات النشطة'
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
            '🛡️ حماية يوم — 1000$ → `!اشتري حماية`'
          )
          .setColor('#e67e22');
        await interaction.reply({ embeds: [embed], ephemeral: true });
        break;
      }

      case 'missions': {
        const embed = new EmbedBuilder()
          .setTitle('🎒 مهماتي')
          .setDescription(
            'المهام اليومية:\n\n' +
            '✅ استخدم !يومية يومياً → 250$\n' +
            '✅ العب لعبة نرد → 50$\n' +
            '✅ قم بعمل ناجح عبر `!عمل`'
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
