



const express = require('express');
const fs = require('node:fs');
const path = require('node:path');

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events
} = require('discord.js');

const web = express();

web.get('/', (_req, res) => {
  res.status(200).send('✅ البوت الاقتصادي يعمل');
});

web.get('/health', (_req, res) => {
  res.json({ ok: true });
});

web.listen(Number(process.env.PORT) || 3000, '0.0.0.0');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const DATA_PATH = path.join(__dirname, 'data.json');
const BACKUP_PATH = path.join(__dirname, 'data.backup.json');

const START_BALANCE = 100000;
const DAILY_AMOUNT = 5000;
const PAY_INTERVAL = 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;
const MAX_BALANCE = 9000000000000;

let db = {
  users: {},
  market: {
    stocks: { gold: 100, tech: 75, oil: 90 },
    updatedAt: Date.now()
  }
};

let saveQueue = Promise.resolve();

const PROPERTIES = [
  { id: 'shop', name: 'متجر صغير', price: 50000, income: 500, emoji: '🏪' },
  { id: 'apartment', name: 'شقة سكنية', price: 150000, income: 1200, emoji: '🏢' },
  { id: 'house', name: 'منزل مستقل', price: 350000, income: 2500, emoji: '🏠' },
  { id: 'building', name: 'مبنى تجاري', price: 800000, income: 6000, emoji: '🏗️' },
  { id: 'tower', name: 'برج استثماري', price: 2000000, income: 15000, emoji: '🗼' }
];

const JOBS = [
  { id: 'worker', name: 'عامل', pay: 800, xp: 10, level: 1 },
  { id: 'clerk', name: 'موظف متجر', pay: 1400, xp: 15, level: 2 },
  { id: 'developer', name: 'مبرمج', pay: 2500, xp: 20, level: 4 },
  { id: 'manager', name: 'مدير شركة', pay: 4000, xp: 30, level: 7 },
  { id: 'investor', name: 'مدير استثمار', pay: 6500, xp: 40, level: 10 }
];

const ASSETS = [
  { id: 'gold', name: 'الذهب', emoji: '🪙' },
  { id: 'tech', name: 'قطاع التقنية', emoji: '💻' },
  { id: 'oil', name: 'النفط', emoji: '🛢️' }
];

const money = n => Math.floor(n).toLocaleString('en-US');

function loadData() {
  try {
    if (fs.existsSync(DATA_PATH)) {
      const old = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));

      db = {
        ...db,
        ...old,
        users: old.users || {}
      };

      // ترحيل بيانات الكود القديم
      for (const user of Object.values(db.users)) {
        if (typeof user.cash !== 'number') {
          user.cash = Number(user.balance) || START_BALANCE;
        }

        user.bank ??= 0;
        user.properties ??= [];
        user.investments ??= {};
        user.level ??= 1;
        user.xp ??= 0;
        user.lastDaily ??= 0;
        user.lastPay ??= 0;
      }

      console.log('✅ تم تحميل البيانات');
    } else {
      saveData();
    }
  } catch (err) {
    console.error('خطأ في قراءة البيانات:', err.message);

    try {
      if (fs.existsSync(BACKUP_PATH)) {
        db = JSON.parse(fs.readFileSync(BACKUP_PATH, 'utf8'));
      }
    } catch {
      console.error('تعذر تحميل النسخة الاحتياطية');
    }
  }
}

function saveData() {
  saveQueue = saveQueue.then(async () => {
    const temp = DATA_PATH + '.tmp';

    await fs.promises.writeFile(
      temp,
      JSON.stringify(db, null, 2),
      { mode: 0o600 }
    );

    if (fs.existsSync(DATA_PATH)) {
      await fs.promises.copyFile(DATA_PATH, BACKUP_PATH)
        .catch(() => {});
    }

    await fs.promises.rename(temp, DATA_PATH);
  }).catch(err => {
    console.error('فشل حفظ البيانات:', err.message);
  });

  return saveQueue;
}

function getUser(id) {
  if (!db.users[id]) {
    db.users[id] = {
      cash: START_BALANCE,
      bank: 0,
      properties: [],
      investments: {},
      job: null,
      level: 1,
      xp: 0,
      lastDaily: 0,
      lastPay: 0
    };
  }

  const u = db.users[id];

  if (typeof u.cash !== 'number') {
    u.cash = Number(u.balance) || START_BALANCE;
  }

  if (typeof u.bank !== 'number') u.bank = 0;
  if (!Array.isArray(u.properties)) u.properties = [];
  if (!u.investments || typeof u.investments !== 'object') {
    u.investments = {};
  }

  if (!Number.isFinite(u.level)) u.level = 1;
  if (!Number.isFinite(u.xp)) u.xp = 0;

  return u;
}

function addXP(user, amount) {
  user.xp += amount;
  const gained = [];

  while (user.xp >= user.level * 100 && user.level < 100) {
    user.xp -= user.level * 100;
    user.level++;
    gained.push(user.level);
  }

  return gained;
}

function embed(title, description, color = 0x2ecc71) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setFooter({
      text: 'الاقتصاد الافتراضي • لا توجد أموال حقيقية'
    })
    .setTimestamp();
}

function totalWorth(u) {
  const propertyValue = u.properties.reduce(
    (sum, p) => sum + (Number(p.price) || 0),
    0
  );

  const investments = Object.entries(u.investments).reduce(
    (sum, [id, qty]) => sum + (db.market.stocks[id] || 0) * qty,
    0
  );

  return u.cash + u.bank + propertyValue + investments;
}

function safeAmount(n) {
  return Number.isSafeInteger(n) &&
    n > 0 &&
    n <= MAX_BALANCE;
}

function accountText(u) {
  return [
    `💵 النقد: **${money(u.cash)} دولار**`,
    `🏦 البنك: **${money(u.bank)} دولار**`,
    `💎 القيمة التقريبية: **${money(totalWorth(u))} دولار**`,
    `⭐ المستوى: **${u.level}**`,
    `📊 الخبرة: ${u.xp}/${u.level * 100}`,
    `💼 الوظيفة: ${JOBS.find(j => j.id === u.job)?.name || 'بدون وظيفة'}`,
    `🏠 عدد العقارات: ${u.properties.length}`
  ].join('\n');
}

function dashboardRows() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('dash:account')
        .setLabel('حسابي')
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId('dash:daily')
        .setLabel('المكافأة اليومية')
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId('dash:bank')
        .setLabel('البنك')
        .setStyle(ButtonStyle.Secondary)
    ),

    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('dash:jobs')
        .setLabel('الوظائف')
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId('dash:market')
        .setLabel('الاستثمار')
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId('dash:properties')
        .setLabel('عقاراتي')
        .setStyle(ButtonStyle.Secondary)
    )
  ];
}

const commands = [
  new SlashCommandBuilder()
    .setName('لوحة')
    .setDescription('فتح لوحة التحكم'),

  new SlashCommandBuilder()
    .setName('حساب')
    .setDescription('عرض حسابك الاقتصادي'),

  new SlashCommandBuilder()
    .setName('يومي')
    .setDescription('المكافأة اليومية'),

  new SlashCommandBuilder()
    .setName('سوق')
    .setDescription('سوق العقارات'),

  new SlashCommandBuilder()
    .setName('شراء')
    .setDescription('شراء عقار')
    .addStringOption(o =>
      o.setName('العقار')
        .setDescription('العقار المطلوب')
        .setRequired(true)
        .addChoices(
          ...PROPERTIES.map(p => ({
            name: p.name,
            value: p.id
          }))
        )
    ),

  new SlashCommandBuilder()
    .setName('عقاراتي')
    .setDescription('عرض عقاراتك'),

  new SlashCommandBuilder()
    .setName('بنك')
    .setDescription('إدارة البنك')
    .addSubcommand(s =>
      s.setName('رصيد')
        .setDescription('عرض الرصيد')
    )
    .addSubcommand(s =>
      s.setName('إيداع')
        .setDescription('إيداع أموال')
        .addIntegerOption(o =>
          o.setName('المبلغ')
            .setDescription('المبلغ')
            .setMinValue(1)
            .setRequired(true)
        )
    )
    .addSubcommand(s =>
      s.setName('سحب')
        .setDescription('سحب أموال')
        .addIntegerOption(o =>
          o.setName('المبلغ')
            .setDescription('المبلغ')
            .setMinValue(1)
            .setRequired(true)
        )
    )
    .addSubcommand(s =>
      s.setName('تحويل')
        .setDescription('تحويل أموال للاعب')
        .addUserOption(o =>
          o.setName('اللاعب')
            .setDescription('المستلم')
            .setRequired(true)
        )
        .addIntegerOption(o =>
          o.setName('المبلغ')
            .setDescription('المبلغ')
            .setMinValue(1)
            .setRequired(true)
        )
    ),

  new SlashCommandBuilder()
    .setName('وظائف')
    .setDescription('عرض الوظائف'),

  new SlashCommandBuilder()
    .setName('وظيفة')
    .setDescription('اختيار وظيفة')
    .addStringOption(o =>
      o.setName('الوظيفة')
        .setDescription('الوظيفة')
        .setRequired(true)
        .addChoices(
          ...JOBS.map(j => ({
            name: `${j.name} - مستوى ${j.level}`,
            value: j.id
          }))
        )
    ),

  new SlashCommandBuilder()
    .setName('راتب')
    .setDescription('استلام راتبك'),
new SlashCommandBuilder()
  .setName('استثمار')
  .setDescription('التداول الافتراضي')
  .addSubcommand(s =>
    s.setName('سوق')
    .setDescription('أسعار السوق')
  )
  .addSubcommand(s =>
    s.setName('شراء')
    .setDescription('شراء أصل من السوق')
  ),
]
);

console.log('🔍 جاري فحص المتغيرات...');

if (!process.env.DISCORD_TOKEN) {
  console.error('❌ لم يتم العثور على DISCORD_TOKEN في متغيرات البيئة');
  console.log('💡 تأكد من إضافته في قسم Environment في Render');
  process.exit(1);
} else {
  console.log('✅ تم العثور على التوكن! الطول:', process.env.DISCORD_TOKEN.length);
}

client.login(process.env.DISCORD_TOKEN)
  .then(() => console.log('✅ البوت متصل بنجاح! 🎉'))
  .catch(err => {
    console.error('❌ خطأ في تسجيل الدخول:', err.message);
    process.exit(1);
  });

  
