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
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  Events
} = require('discord.js');

// 🌐 خادم الويب لمراقبة التشغيل على Render
const app = express();
app.get('/', (_req, res) => res.status(200).send('✅ البوت يعمل بنجاح تام وحالته مستقرة!'));
app.get('/health', (_req, res) => res.json({ status: 'OK' }));
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 خادم الويب يعمل على المنفذ ${PORT}`);
});

const DATA_PATH = path.join(__dirname, 'data.json');

// 📊 أسعار السوق والأصول
const MARKET_ASSETS = {
  phones: { name: 'هواتف ذكية 📱', price: 1200 },
  cars: { name: 'سيارات فارهة 🚗', price: 15000 },
  stocks: { name: 'أسهم شركات 📊', price: 25000 },
  lands: { name: 'أراضي تجارية 🏙️', price: 60000 }
};

// 🛒 المتجر الشامل والأدوات
const SHOP_ITEMS = {
  shield: { name: 'درع حماية 🛡️', price: 3000, desc: 'يحميك من أول محاولة سرقة ضدك' },
  lockpick: { name: 'أداة خلع أقفال 🗝️', price: 1500, desc: 'تزيد نسبة نجاح السرقة' },
  luckybox: { name: 'صندوق الحظ 🎁', price: 2500, desc: 'يعطيك جائزة عشوائية (من 500$ إلى 10,000$)' },
  energy: { name: 'مشروب طاقة ⚡', price: 1000, desc: 'يلغي فترة الانتظار لرحلة الحيوان الأليف' }
};

// 🏢 المشاريع الاستثمارية
const BUSINESSES = {
  cafe: { name: 'مقهى ☕', cost: 5000, incomePerHour: 100 },
  gas: { name: 'محطة بنزين ⛽', cost: 15000, incomePerHour: 350 },
  tech: { name: 'شركة تكنولوجيا 💻', cost: 50000, incomePerHour: 1200 },
  factory: { name: 'مصنع سيارات 🏭', cost: 120000, incomePerHour: 3000 },
  realestate: { name: 'شركة عقارات 🏙️', cost: 300000, incomePerHour: 8000 }
};

// 🐾 الحيوانات الأليفة
const PETS = {
  dog: { name: 'كلب 🐶', cost: 2000, minFind: 100, maxFind: 500 },
  cat: { name: 'قطة 🐱', cost: 1500, minFind: 80, maxFind: 400 },
  dragon: { name: 'تنين أسطوري 🐲', cost: 20000, minFind: 1000, maxFind: 4000 }
};

function initDatabase() {
  if (!fs.existsSync(DATA_PATH)) {
    fs.writeFileSync(DATA_PATH, JSON.stringify({ users: {} }, null, 2));
  }
}

function readData() {
  initDatabase();
  try {
    const raw = fs.readFileSync(DATA_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed.users) parsed.users = {};
    return parsed;
  } catch (err) {
    return { users: {} };
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

function getUserData(userId) {
  const db = readData();
  if (!db.users[userId]) {
    db.users[userId] = {
      balance: 1000,
      bank: 0,
      dailyLast: '',
      dailyStreak: 0,
      assets: { phones: 0, cars: 0, stocks: 0, lands: 0 },
      inventory: { shield: 0, lockpick: 0, luckybox: 0, energy: 0 },
      businesses: { cafe: 0, gas: 0, tech: 0, factory: 0, realestate: 0 },
      lastClaimedIncome: Date.now(),
      pet: null,
      lastPetHunt: 0,
      marriedTo: null,
      lastRob: 0
    };
    saveData(db);
  }
  return db.users[userId];
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once(Events.ClientReady, () => {
  console.log(`✅ تم تسجيل الدخول بنجاح باسم: ${client.user.tag}`);
});

// معالج الأوامر النصية
client.on(Events.MessageCreate, async message => {
  if (message.author.bot || !message.guild) return;
  const content = message.content.trim();
  const userId = message.author.id;

  // 🏛️ اللوحة الرئيسية التفاعلية
  if (content === '!قائمة' || content === '!القائمة') {
    const embed = new EmbedBuilder()
      .setTitle('🏛️ المركز الاقتصادي والاستثماري')
      .setDescription('اختر القسم المطلوب من الأزرار التفاعلية أدناه:')
      .setColor('#2b90d9');

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('btn_account').setLabel('💳 حسابي').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('btn_daily').setLabel('🎁 اليومية').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('btn_claim_income').setLabel('💵 جمع الأرباح').setStyle(ButtonStyle.Success)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('btn_shop').setLabel('🛒 المتجر').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('btn_market').setLabel('📊 البورصة').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('btn_businesses').setLabel('🏢 المشاريع').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('btn_pets').setLabel('🐾 الحيوانات').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('btn_games').setLabel('🎰 الألعاب').setStyle(ButtonStyle.Danger)
    );

    await message.reply({ embeds: [embed], components: [row1, row2] });
    return;
  }

  // 📜 قائمة الأوامر
  if (content === '!مساعدة' || content === '!اوامر') {
    const embed = new EmbedBuilder()
      .setTitle('📜 قائمة الأوامر الاقتصادية')
      .addFields(
        { name: '🏛️ القائمة العامة', value: '`!قائمة` لعرض لوحة التحكم بالأزرار' },
        { name: '💳 الحساب والبنك', value: '`!حساب` | `!إيداع [مبلغ]` | `!سحب [مبلغ]` | `!تحويل @الشخص [مبلغ]`' },
        { name: '🛒 المتجر والأغراض', value: '`!متجر` لشراء الأغراض التفاعلية | `!استخدام [اسم_الغرض]`' },
        { name: '🏢 الاستثمار والأرض', value: '`!مشاريع` لشراء المشاريع | `!ارباح` لجمع أرباحك' },
        { name: '🕵️ السرقة والزواج', value: '`!نهب @الشخص` لسرقته | `!زواج @الشخص` | `!طلاق`' },
        { name: '🐾 الحيوانات الأليفة', value: '`!الحيوانات` للتبني | `!رحلة` لجلب الأموال والكنوز' },
        { name: '🎰 الألعاب والترفيه', value: '`!سلوتس [مبلغ]` | `!تخمين [1-10] [مبلغ]` | `!سباق [مبلغ]`' }
      )
      .setColor('#3498db');
    await message.reply({ embeds: [embed] });
    return;
  }

  // 💳 الحساب الشخصي
  if (content === '!حساب' || content === '!حسابي') {
    const user = getUserData(userId);
    const petName = user.pet && PETS[user.pet] ? PETS[user.pet].name : 'لا يوجد ❌';
    const spouse = user.marriedTo ? `<@${user.marriedTo}>` : 'أعزب 💔';

    const embed = new EmbedBuilder()
      .setTitle(`💳 حساب اللاعب: ${message.author.username}`)
      .addFields(
        { name: '💰 النقدي', value: `${user.balance.toLocaleString()}$`, inline: true },
        { name: '🏦 البنك', value: `${user.bank.toLocaleString()}$`, inline: true },
        { name: '💍 الشريك', value: spouse, inline: true },
        { name: '🐾 الحيوان الأليف', value: petName, inline: true },
        { name: '🔥 الستريك اليومي', value: `${user.dailyStreak || 0} أيام`, inline: true }
      )
      .setColor('#2ecc71');

    let invList = '';
    for (const key in user.inventory) {
      if (user.inventory[key] > 0) {
        invList += `• ${SHOP_ITEMS[key].name}: **${user.inventory[key]}**\n`;
      }
    }
    if (invList) embed.addFields({ name: '🎒 حقيبة المقتنيات', value: invList, inline: false });

    await message.reply({ embeds: [embed] });
    return;
  }

  // 🛒 المتجر التفاعلي والشراء
  if (content === '!متجر' || content === '!المتجر') {
    const embed = new EmbedBuilder()
      .setTitle('🛒 متجر الأدوات والتجهيزات')
      .setDescription('اختر الغرض الذي تريد شراءه من القائمة المنسدلة أدناه مباشرة: 🛍️')
      .setColor('#f1c40f');

    const selectOptions = [];
    for (const key in SHOP_ITEMS) {
      const item = SHOP_ITEMS[key];
      embed.addFields({ name: item.name, value: `السعر: **${item.price.toLocaleString()}$**\nالوصف: ${item.desc}`, inline: false });
      selectOptions.push(
        new StringSelectMenuOptionBuilder()
          .setLabel(item.name)
          .setValue(`buy_item_${key}`)
          .setDescription(`بسعر ${item.price.toLocaleString()}$`)
      );
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select_shop_buy')
      .setPlaceholder('🛒 اختر غرضاً لشراؤه...')
      .addOptions(selectOptions);

    const row = new ActionRowBuilder().addComponents(selectMenu);
    await message.reply({ embeds: [embed], components: [row] });
    return;
  }

  // 🎁 استخدام العناصر من الحقيبة
  if (content.startsWith('!استخدام') || content.startsWith('!استعمل')) {
    const itemKey = content.split(' ')[1] ? content.split(' ')[1].toLowerCase() : '';
    const mapKey = { 'درع': 'shield', 'صندوق': 'luckybox', 'طاقة': 'energy', 'مشروب': 'energy' }[itemKey];

    if (!mapKey) {
      await message.reply('❌ حدد الغرض المراد استخدامه: `درع` | `صندوق` | `طاقة`');
      return;
    }

    const db = readData();
    const user = getUserData(userId);

    if (!user.inventory || user.inventory[mapKey] <= 0) {
      await message.reply('❌ لا تملك هذا الغرض في حقيبتك!');
      return;
    }

    if (mapKey === 'luckybox') {
      user.inventory.luckybox -= 1;
      const prize = Math.floor(Math.random() * 9500) + 500;
      user.balance += prize;
      db.users[userId] = user;
      saveData(db);
      await message.reply(`🎁 فتحت **صندوق الحظ** وحصلت على **${prize.toLocaleString()}$**! 🎉`);
      return;
    }

    if (mapKey === 'energy') {
      user.inventory.energy -= 1;
      user.lastPetHunt = 0;
      db.users[userId] = user;
      saveData(db);
      await message.reply('⚡ شربت **مشروب الطاقة**! تم إلغاء وقت انتظار رحلة حيوانك الأليف بنجاح!');
      return;
    }

    if (mapKey === 'shield') {
      await message.reply('🛡️ **درع الحماية** يعمل تلقائياً عندما يحاول أحد سرقتك!');
      return;
    }
  }

  // 🕵️ نظام السرقة والنهب
  if (content.startsWith('!نهب') || content.startsWith('!سرقة')) {
    const target = message.mentions.users.first();
    if (!target || target.id === userId || target.bot) {
      await message.reply('❌ طريقة الاستخدام: `!نهب @الشخص`');
      return;
    }

    const db = readData();
    const user = getUserData(userId);
    const targetData = getUserData(target.id);

    const now = Date.now();
    const cooldown = 30 * 60 * 1000; // 30 دقيقة
    if (now - (user.lastRob || 0) < cooldown) {
      const rem = Math.ceil((cooldown - (now - user.lastRob)) / (1000 * 60));
      await message.reply(`⏳ يجب عليك الانتظار **${rem} دقيقة** قبل تنفيذ عملية سرقة جديدة!`);
      return;
    }

    if (targetData.balance < 500) {
      await message.reply('❌ هذا الشخص لا يملك أموالاً كافية في محفظته لسرقته!');
      return;
    }

    user.lastRob = now;

    // التأكد من درع حماية الضحية
    if (targetData.inventory && targetData.inventory.shield > 0) {
      targetData.inventory.shield -= 1;
      db.users[userId] = user;
      db.users[target.id] = targetData;
      saveData(db);
      await message.reply(`🛡️ **فشلت عملية السرقة!** كان <@${target.id}> يمتلك **درع حماية** وتم تصدي الهجوم!`);
      return;
    }

    // نسبة النجاح (تزيد إن كان السارق يملك lockpick)
    let successRate = 0.45;
    if (user.inventory && user.inventory.lockpick > 0) {
      successRate = 0.70;
      user.inventory.lockpick -= 1;
    }

    if (Math.random() < successRate) {
      const stolen = Math.floor(targetData.balance * (Math.random() * 0.3 + 0.1));
      targetData.balance -= stolen;
      user.balance += stolen;
      db.users[userId] = user;
      db.users[target.id] = targetData;
      saveData(db);
      await message.reply(`🥷 **نجحت عملية السرقة!** سرقت **${stolen.toLocaleString()}$** من <@${target.id}>! 💰`);
    } else {
      const fine = Math.min(user.balance, 500);
      user.balance -= fine;
      db.users[userId] = user;
      saveData(db);
      await message.reply(`🚨 **قبضت عليك الشرطة!** فشلت محاولة السرقة وتم تغريمك **${fine.toLocaleString()}$**!`);
    }
    return;
  }

  // 💍 نظام الزواج والطلاق
  if (content.startsWith('!زواج')) {
    const target = message.mentions.users.first();
    if (!target || target.id === userId || target.bot) {
      await message.reply('❌ يرجى تحديد الشخص المراد الزواج منه: `!زواج @الشخص`');
      return;
    }

    const db = readData();
    const user = getUserData(userId);
    const targetData = getUserData(target.id);

    if (user.marriedTo) {
      await message.reply('❌ أنت متزوج بالفعل!');
      return;
    }

    if (targetData.marriedTo) {
      await message.reply('❌ هذا الشخص متزوج بالفعل!');
      return;
    }

    user.marriedTo = target.id;
    targetData.marriedTo = userId;
    db.users[userId] = user;
    db.users[target.id] = targetData;
    saveData(db);

    await message.reply(`💍 **مبروك!** تم الزواج بين <@${userId}> و <@${target.id}> بنجاح! 🎉❤️`);
    return;
  }

  if (content === '!طلاق') {
    const db = readData();
    const user = getUserData(userId);

    if (!user.marriedTo) {
      await message.reply('❌ أنت لست متزوجاً بالأصل!');
      return;
    }

    const exId = user.marriedTo;
    const exData = getUserData(exId);

    user.marriedTo = null;
    exData.marriedTo = null;
    db.users[userId] = user;
    db.users[exId] = exData;
    saveData(db);

    await message.reply(`💔 تم الانفصال والطلاق رسمياً بينك وبين <@${exId}>.`);
    return;
  }

  // 🎁 المكافأة اليومية
  if (content === '!يومية' || content === '!يومي') {
    const db = readData();
    const user = getUserData(userId);
    const today = new Date().toDateString();

    if (user.dailyLast === today) {
      await message.reply('⏳ لقد استلمت مكافأتك اليومية بالفعل! عُد غداً.');
      return;
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (user.dailyLast === yesterday.toDateString()) {
      user.dailyStreak = (user.dailyStreak || 0) + 1;
    } else {
      user.dailyStreak = 1;
    }

    const amount = 300 + ((user.dailyStreak - 1) * 50);
    user.balance += amount;
    user.dailyLast = today;
    db.users[userId] = user;
    saveData(db);

    await message.reply(`🎁 **استلمت مكافأتك اليومية بنجاح!** ربحت **${amount.toLocaleString()}$** (ستريك: ${user.dailyStreak} أيام 🔥)`);
    return;
  }

  // 🏦 الإيداع والسحب والتحويل
  if (content.startsWith('!إيداع')) {
    const args = content.split(' ');
    const db = readData();
    const user = getUserData(userId);
    let amount = args[1] === 'الكل' || args[1] === 'all' ? user.balance : parseInt(args[1]);

    if (isNaN(amount) || amount <= 0 || user.balance < amount) {
      await message.reply('❌ يرجى تحديد مبلغ صحيح للإيداع أو كتابة `!إيداع الكل`.');
      return;
    }

    user.balance -= amount;
    user.bank += amount;
    db.users[userId] = user;
    saveData(db);

    await message.reply(`✅ تم إيداع **${amount.toLocaleString()}$** في البنك بنجاح! 🏦`);
    return;
  }

  if (content.startsWith('!سحب')) {
    const args = content.split(' ');
    const db = readData();
    const user = getUserData(userId);
    let amount = args[1] === 'الكل' || args[1] === 'all' ? user.bank : parseInt(args[1]);

    if (isNaN(amount) || amount <= 0 || user.bank < amount) {
      await message.reply('❌ يرجى تحديد مبلغ صحيح للسحب أو كتابة `!سحب الكل`.');
      return;
    }

    user.bank -= amount;
    user.balance += amount;
    db.users[userId] = user;
    saveData(db);

    await message.reply(`✅ تم سحب **${amount.toLocaleString()}$** إلى محفظتك النقدية! 💰`);
    return;
  }

  if (content.startsWith('!تحويل')) {
    const target = message.mentions.users.first();
    const args = content.split(' ');
    const amount = parseInt(args[2]);

    if (!target || target.id === userId || target.bot || isNaN(amount) || amount <= 0) {
      await message.reply('❌ طريقة الاستخدام الصحيحة: `!تحويل @الشخص [المبلغ]`');
      return;
    }

    const db = readData();
    const user = getUserData(userId);
    const targetData = getUserData(target.id);

    if (user.balance < amount) {
      await message.reply('❌ لا تملك هذا المبلغ نقداً في محفظتك!');
      return;
    }

    user.balance -= amount;
    targetData.balance += amount;
    db.users[userId] = user;
    db.users[target.id] = targetData;
    saveData(db);

    await message.reply(`✅ تم تحويل **${amount.toLocaleString()}$** بنجاح إلى <@${target.id}>! 💸`);
    return;
  }

  // 🐾 متجر الحيوانات وتبنيها والرحلات
  if (content === '!الحيوانات' || content === '!حيوانات') {
    const embed = new EmbedBuilder()
      .setTitle('🐾 متجر الحيوانات الأليفة')
      .setDescription('تبنى حيواناً أليفاً ليرسلك في رحلات استكشافية يجلب لك منها الكنوز والأموال!')
      .addFields(
        { name: '🐶 كلب (2,000$)', value: 'يجلب من الرحلة: 100$ - 500$\nالأمر: `!تبني كلب`', inline: false },
        { name: '🐱 قطة (1,500$)', value: 'تجد من الرحلة: 80$ - 400$\nالأمر: `!تبني قطة`', inline: false },
        { name: '🐲 تنين أسطوري (20,000$)', value: 'يجلب من الرحلة: 1000$ - 4000$\nالأمر: `!تبني تنين`', inline: false }
      )
      .setColor('#e67e22');

    await message.reply({ embeds: [embed] });
    return;
  }

  if (content.startsWith('!تبني')) {
    const type = content.split(' ')[1] ? content.split(' ')[1].toLowerCase() : '';
    const mapKey = { 'كلب': 'dog', 'قطة': 'cat', 'تنين': 'dragon', 'dog': 'dog', 'cat': 'cat', 'dragon': 'dragon' }[type];

    if (!mapKey) {
      await message.reply('❌ اختر حيواناً صحيحاً: `كلب` | `قطة` | `تنين`');
      return;
    }

    const db = readData();
    const user = getUserData(userId);
    const petObj = PETS[mapKey];

    if (user.balance < petObj.cost) {
      await message.reply(`❌ رصيدك لا يكفي! تكلفة تبني **${petObj.name}** هي **${petObj.cost.toLocaleString()}$**.`);
      return;
    }

    user.balance -= petObj.cost;
    user.pet = mapKey;
    db.users[userId] = user;
    saveData(db);

    await message.reply(`🎉 **مبروك!** تبنيت **${petObj.name}** بنجاح! استخدم الأمر \`!رحلة\` لإرساله لجلب الكنوز.`);
    return;
  }

  if (content === '!رحلة' || content === '!رحلة_كنز') {
    const db = readData();
    const user = getUserData(userId);

    if (!user.pet || !PETS[user.pet]) {
      await message.reply('❌ أنت لا تملك حيواناً أليفاً! اكتب `!الحيوانات` لتبني واحد.');
      return;
    }

    const now = Date.now();
    const cooldown = 1 * 60 * 60 * 1000;
    const lastHunt = user.lastPetHunt || 0;

    if (now - lastHunt < cooldown) {
      const remMinutes = Math.ceil((cooldown - (now - lastHunt)) / (1000 * 60));
      await message.reply(`⏳ حيوانك الأليف متعب الآن! انتظر **${remMinutes} دقيقة** قبل الرحلة القادمة أو استخدم مشروب طاقة (\`!استخدام طاقة\`).`);
      return;
    }

    const petObj = PETS[user.pet];
    const prize = Math.floor(Math.random() * (petObj.maxFind - petObj.minFind + 1)) + petObj.minFind;

    user.balance += prize;
    user.lastPetHunt = now;
    db.users[userId] = user;
    saveData(db);

    await message.reply(`🗺️ عاد **${petObj.name}** من رحلته الاستكشافية وجلب لك **${prize.toLocaleString()}$**! 💰✨`);
    return;
  }

  // 🏢 المشاريع والأرباح
  if (content === '!مشاريع') {
    const user = getUserData(userId);
    const b = user.businesses || {};

    const embed = new EmbedBuilder()
      .setTitle('🏢 المشاريع الاستثمارية')
      .setDescription('شراء المشاريع يدر عليك أرباحاً تلقائية بمرور الوقت! لشراء مشروع اكتب `!شراء_مشروع [الاسم]`')
      .addFields(
        { name: '☕ مقهى (5,000$)', value: `المملوك: **${b.cafe || 0}** | الأرباح: 100$/ساعة\nالأمر: \`!شراء_مشروع مقهى\``, inline: false },
        { name: '⛽ محطة بنزين (15,000$)', value: `المملوك: **${b.gas || 0}** | الأرباح: 350$/ساعة\nالأمر: \`!شراء_مشروع بنزين\``, inline: false },
        { name: '💻 شركة تكنولوجيا (50,000$)', value: `المملوك: **${b.tech || 0}** | الأرباح: 1200$/ساعة\nالأمر: \`!شراء_مشروع تكنولوجيا\``, inline: false },
        { name: '🏭 مصنع سيارات (120,000$)', value: `المملوك: **${b.factory || 0}** | الأرباح: 3000$/ساعة\nالأمر: \`!شراء_مشروع مصنع\``, inline: false },
        { name: '🏙️ شركة عقارات (300,000$)', value: `المملوك: **${b.realestate || 0}** | الأرباح: 8000$/ساعة\nالأمر: \`!شراء_مشروع عقارات\``, inline: false }
      )
      .setColor('#8e44ad');

    await message.reply({ embeds: [embed] });
    return;
  }

  if (content.startsWith('!شراء_مشروع')) {
    const type = content.split(' ')[1] ? content.split(' ')[1].toLowerCase() : '';
    const mapKey = { 'مقهى': 'cafe', 'بنزين': 'gas', 'تكنولوجيا': 'tech', 'مصنع': 'factory', 'عقارات': 'realestate' }[type];

    if (!mapKey) {
      await message.reply('❌ حدد مشروعاً صحيحاً: `مقهى` | `بنزين` | `تكنولوجيا` | `مصنع` | `عقارات`');
      return;
    }

    const db = readData();
    const user = getUserData(userId);
    const proj = BUSINESSES[mapKey];

    if (user.balance < proj.cost) {
      await message.reply(`❌ رصيدك النقدي لا يكفي لشراء **${proj.name}**! تكلفته **${proj.cost.toLocaleString()}$**.`);
      return;
    }

    user.balance -= proj.cost;
    if (!user.businesses) user.businesses = {};
    user.businesses[mapKey] = (user.businesses[mapKey] || 0) + 1;
    db.users[userId] = user;
    saveData(db);

    await message.reply(`🎉 **مبروك!** اشتريت **${proj.name}** بنجاح! بدأ المشروع بتوليد الأرباح لك.`);
    return;
  }

  if (content === '!ارباح' || content === '!أرباح') {
    const db = readData();
    const user = getUserData(userId);
    const now = Date.now();
    const last = user.lastClaimedIncome || now;
    const hours = (now - last) / (1000 * 60 * 60);

    const b = user.businesses || {};
    const hourlyIncome = ((b.cafe || 0) * 100) + ((b.gas || 0) * 350) + ((b.tech || 0) * 1200) + ((b.factory || 0) * 3000) + ((b.realestate || 0) * 8000);

    if (hourlyIncome === 0) {
      await message.reply('❌ لا تملك أي مشاريع حالياً لجمع أرباحها! اكتب `!مشاريع` لشراء أفكار استثمارية.');
      return;
    }

    const totalIncome = Math.floor(hourlyIncome * hours);
    if (totalIncome <= 0) {
      await message.reply('⏳ لم تتراكم أرباح كافية بعد، عُد بعد قليل!');
      return;
    }

    user.balance += totalIncome;
    user.lastClaimedIncome = now;
    db.users[userId] = user;
    saveData(db);

    await message.reply(`💵 **تمت إضافة أرباح مشاريعك!** جمعت **${totalIncome.toLocaleString()}$** بنجاح إلى محفظتك! 💰`);
    return;
  }

  // 📊 البورصة والسوق
  if (content === '!سوق') {
    const embed = new EmbedBuilder()
      .setTitle('📊 سوق الأصول والبورصة')
      .setDescription('اختر الأصل الذي ترغب في شرائه من القائمة أدناه: 🛒')
      .setColor('#e67e22');

    const selectOptions = [];
    for (const key in MARKET_ASSETS) {
      const asset = MARKET_ASSETS[key];
      embed.addFields({ name: asset.name, value: `السعر: **${asset.price.toLocaleString()}$**`, inline: true });
      selectOptions.push(
        new StringSelectMenuOptionBuilder()
          .setLabel(asset.name)
          .setValue(`buy_asset_${key}`)
          .setDescription(`شراء بسعر ${asset.price.toLocaleString()}$`)
      );
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select_market_buy')
      .setPlaceholder('🛒 اختر أصلاً لشرائه...')
      .addOptions(selectOptions);

    const row = new ActionRowBuilder().addComponents(selectMenu);
    await message.reply({ embeds: [embed], components: [row] });
    return;
  }

  // 🎰 الألعاب (سلوتس، تخمين، وسباق السيارات)
  if (content.startsWith('!سلوتس') || content.startsWith('!slots')) {
    const args = content.split(' ');
    const bet = parseInt(args[1]);

    if (isNaN(bet) || bet <= 0) {
      await message.reply('❌ يرجى تحديد مبلغ الرهان بشكل صحيح! مثال: `!سلوتس 100`');
      return;
    }

    const db = readData();
    const user = getUserData(userId);
    if (user.balance < bet) {
      await message.reply('❌ رصيدك النقدي لا يكفي لهذا الرهان!');
      return;
    }

    const symbols = ['🍒', '💎', '🍋', '🔔', '⭐'];
    const s1 = symbols[Math.floor(Math.random() * symbols.length)];
    const s2 = symbols[Math.floor(Math.random() * symbols.length)];
    const s3 = symbols[Math.floor(Math.random() * symbols.length)];

    let resultText = '';
    let prize = 0;

    if (s1 === s2 && s2 === s3) {
      prize = bet * 10;
      resultText = `🎉 **جائزة كبرى (10x)!** ربحت **${prize.toLocaleString()}$**!`;
    } else if (s1 === s2 || s2 === s3 || s1 === s3) {
      prize = bet * 2;
      resultText = `✨ **تطابق رائع (2x)!** ربحت **${prize.toLocaleString()}$**!`;
    } else {
      resultText = `😢 **خسرت الرهان!** حظاً أوفر في المرة القادمة.`;
    }

    user.balance -= bet;
    if (prize > 0) user.balance += prize;
    db.users[userId] = user;
    saveData(db);

    await message.reply(`🎰 **[ ${s1} \vert{}${s2} | ${s3} ]**\n\n${resultText}`);
    return;
  }

  if (content.startsWith('!تخمين')) {
    const args = content.split(' ');
    const guess = parseInt(args[1]);
    const bet = parseInt(args[2]);

    if (isNaN(guess) || guess < 1 || guess > 10 || isNaN(bet) || bet <= 0) {
      await message.reply('❌ طريقة الاستخدام: `!تخمين [الرقم من 1-10] [مبلغ الرهان]`\nمثال: `!تخمين 5 100`');
      return;
    }

    const db = readData();
    const user = getUserData(userId);

    if (user.balance < bet) {
      await message.reply('❌ رصيدك النقدي لا يكفي للرهان!');
      return;
    }

    const winningNumber = Math.floor(Math.random() * 10) + 1;
    user.balance -= bet;

    if (guess === winningNumber) {
      const prize = bet * 8;
      user.balance += prize;
      db.users[userId] = user;
      saveData(db);
      await message.reply(`🎯 **أصبت الرقم الصحيح (${winningNumber})!** ربحت **${prize.toLocaleString()}$**! 🔥`);
    } else {
      db.users[userId] = user;
      saveData(db);
      await message.reply(`❌ **خمنت الرقم ${guess}** ولكن الرقم الصحيح كان **${winningNumber}**. خسرت الرهان.`);
    }
    return;
  }

  if (content.startsWith('!سباق')) {
    const args = content.split(' ');
    const bet = parseInt(args[1]);

    if (isNaN(bet) || bet <= 0) {
      await message.reply('❌ يرجى تحديد مبلغ الرهان! مثال: `!سباق 200`');
      return;
    }

    const db = readData();
    const user = getUserData(userId);

    if (user.balance < bet) {
      await message.reply('❌ رصيدك النقدي لا يكفي للشارع بالسباق!');
      return;
    }

    const win = Math.random() < 0.5;
    user.balance -= bet;

    if (win) {
      const prize = bet * 2;
      user.balance += prize;
      db.users[userId] = user;
      saveData(db);
      await message.reply(`🏎️ **فزت بسباق السيارات السريع!** ربحت **${prize.toLocaleString()}$**! 🏁🏆`);
    } else {
      db.users[userId] = user;
      saveData(db);
      await message.reply(`🏎️ **تعطلت سيارتك أثناء السباق!** خسرت مبلغ الرهان (**${bet.toLocaleString()}$**). 💥`);
    }
    return;
  }
});

// معالج التفاعلات والأزرار
client.on(Events.InteractionCreate, async interaction => {
  const userId = interaction.user.id;
  const db = readData();
  const user = getUserData(userId);

  // الشراء من متجر الأدوات والتجهيزات
  if (interaction.isStringSelectMenu() && interaction.customId === 'select_shop_buy') {
    const itemKey = interaction.values[0].replace('buy_item_', '');
    const item = SHOP_ITEMS[itemKey];

    if (!item) {
      await interaction.reply({ content: '❌ الغرض غير موجود!', ephemeral: true });
      return;
    }

    if (user.balance < item.price) {
      await interaction.reply({
        content: `❌ رصيدك النقدي (**${user.balance.toLocaleString()}$**) لا يكفي لشراء ${item.name}!`,
        ephemeral: true
      });
      return;
    }

    user.balance -= item.price;
    if (!user.inventory) user.inventory = {};
    user.inventory[itemKey] = (user.inventory[itemKey] || 0) + 1;
    db.users[userId] = user;
    saveData(db);

    await interaction.reply({
      content: `✅ **تم الشراء بنجاح!** 🎉 اشتريت **${item.name}** بسعر **${item.price.toLocaleString()}$**. لاستخدامه اكتب: \`!استخدام ${itemKey}\``,
      ephemeral: true
    });
    return;
  }

  // الشراء من البورصة والسوق
  if (interaction.isStringSelectMenu() && interaction.customId === 'select_market_buy') {
    const assetKey = interaction.values[0].replace('buy_asset_', '');
    const asset = MARKET_ASSETS[assetKey];

    if (!asset) {
      await interaction.reply({ content: '❌ الأصل غير موجود!', ephemeral: true });
      return;
    }

    if (user.balance < asset.price) {
      await interaction.reply({
        content: `❌ رصيدك النقدي (**${user.balance.toLocaleString()}$**) لا يكفي لشراء ${asset.name}!`,
        ephemeral: true
      });
      return;
    }

    user.balance -= asset.price;
    if (!user.assets) user.assets = {};
    user.assets[assetKey] = (user.assets[assetKey] || 0) + 1;
    db.users[userId] = user;
    saveData(db);

    await interaction.reply({
      content: `✅ **تمت عملية الشراء بنجاح!** 🎉 اشتريت 1 من **${asset.name}** بسعر **${asset.price.toLocaleString()}$**.`,
      ephemeral: true
    });
    return;
  }

  if (!interaction.isButton()) return;

  try {
    switch (interaction.customId) {
      case 'btn_account': {
        const petName = user.pet && PETS[user.pet] ? PETS[user.pet].name : 'لا يوجد ❌';
        await interaction.reply({
          content: `💳 **حسابك الشخصي:**\n• 💰 النقدي: **${user.balance.toLocaleString()}$**\n• 🏦 البنك: **${user.bank.toLocaleString()}$**\n• 🐾 الحيوان الأليف: **${petName}**`,
          ephemeral: true
        });
        break;
      }

      case 'btn_daily': {
        const today = new Date().toDateString();
        if (user.dailyLast === today) {
          await interaction.reply({ content: '⏳ لقد استلمت مكافأتك اليومية بالفعل اليوم!', ephemeral: true });
          return;
        }
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        if (user.dailyLast === yesterday.toDateString()) {
          user.dailyStreak = (user.dailyStreak || 0) + 1;
        } else {
          user.dailyStreak = 1;
        }
        const amount = 300 + ((user.dailyStreak - 1) * 50);
        user.balance += amount;
        user.dailyLast = today;
        db.users[userId] = user;
        saveData(db);
        await interaction.reply({ content: `🎁 مكافأتك اليومية: **${amount.toLocaleString()}$** (ستريك: ${user.dailyStreak} أيام 🔥)`, ephemeral: true });
        break;
      }

      case 'btn_claim_income': {
        const now = Date.now();
        const last = user.lastClaimedIncome || now;
        const hours = (now - last) / (1000 * 60 * 60);
        const b = user.businesses || {};
        const hourlyIncome = ((b.cafe || 0) * 100) + ((b.gas || 0) * 350) + ((b.tech || 0) * 1200) + ((b.factory || 0) * 3000) + ((b.realestate || 0) * 8000);

        if (hourlyIncome === 0) {
          await interaction.reply({ content: '❌ لا تملك مشاريع لجمع أرباحها حالياً!', ephemeral: true });
          return;
        }

        const totalIncome = Math.floor(hourlyIncome * hours);
        if (totalIncome <= 0) {
          await interaction.reply({ content: '⏳ لم تتراكم أرباح كافية بعد، انتظر القليل من الوقت!', ephemeral: true });
          return;
        }

        user.balance += totalIncome;
        user.lastClaimedIncome = now;
        db.users[userId] = user;
        saveData(db);
        await interaction.reply({ content: `💵 **تم جمع أرباح مشاريعك بنجاح:** **${totalIncome.toLocaleString()}$**! 💰`, ephemeral: true });
        break;
      }

      case 'btn_shop':
        await interaction.reply({ content: '🛒 لعرض متجر الأدوات والتجهيزات والشراء التفاعلي اكتب: `!متجر`', ephemeral: true });
        break;

      case 'btn_businesses': {
        const b = user.businesses || {};
        await interaction.reply({
          content: `🏢 **مشاريعك المملوكة حالياً:**\n• مقهى ☕: **${b.cafe || 0}**\n• محطة بنزين ⛽: **${b.gas || 0}**\n• شركة تكنولوجيا 💻: **${b.tech || 0}**\n• مصنع سيارات 🏭: **${b.factory || 0}**\n• شركة عقارات 🏙️: **${b.realestate || 0}**\n\nلشراء المزيد اكتب: \`!مشاريع\``,
          ephemeral: true
        });
        break;
      }

      case 'btn_pets': {
        const petName = user.pet && PETS[user.pet] ? PETS[user.pet].name : 'لا يوجد ❌';
        await interaction.reply({
          content: `🐾 **حالة الحيوان الأليف:**\nالحيوان الحالي: **${petName}**\n• لتبني حيوان جديد اكتب: \`!الحيوانات\`\n• لإرساله في رحلة كنز اكتب: \`!رحلة\``,
          ephemeral: true
        });
        break;
      }

      case 'btn_market':
        await interaction.reply({ content: '📊 لعرض سوق البورصة والشراء التفاعلي اكتب: `!سوق`', ephemeral: true });
        break;

      case 'btn_games':
        await interaction.reply({ content: '🎰 الألعاب المتاحة حالياً:\n• `!سلوتس [المبلغ]`\n• `!تخمين [1-10] [المبلغ]`\n• `!سباق [المبلغ]`', ephemeral: true });
        break;

      default:
        await interaction.reply({ content: '✅ تم الإجراء بنجاح!', ephemeral: true });
        break;
    }
  } catch (err) {
    console.error('Interaction Error:', err);
  }
});

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('❌ خطأ: لم يتم العثور على توكن البوت في متغيرات البيئة (DISCORD_TOKEN)!');
  process.exit(1);
}

client.login(token);
