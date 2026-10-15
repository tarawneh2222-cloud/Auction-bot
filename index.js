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

// ========== إعداد الخادم ==========
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (_req, res) => {
  res.status(200).send('✅ البوت الاقتصادي يعمل — العملة: الدينار الأردني 🇯🇴');
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
let data = { users: {} };

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('⚠️ خطأ تحميل البيانات:', e.message);
    data = { users: {} };
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
      lastDaily: 0,
      lastWork: 0,
      lastRob: 0,
      createdAt: Date.now()
    };
  }
  return data.users[userId];
}

// ========== الإعدادات ==========
const MAX_MONEY = 1_000_000;
const DAILY_AMOUNT = 50;
const WORK_MIN = 10;
const WORK_MAX = 50;
const ROB_COOLDOWN = 60 * 60 * 1000;
const ROB_CHANCE = 0.4;
const ROB_MIN_TARGET = 50;
const DAILY_COOLDOWN = 24 * 60 * 60 * 1000;
const WORK_COOLDOWN = 5 * 60 * 1000;

// ========== الدوال المساعدة ==========
async function withUser(id, fn) {
  const u = ensureUser(id);
  const r = await fn(u);
  saveData();
  return r;
}

async function attemptRob(robberId, targetId) {
  if (robberId === targetId) return { ok: false, msg: '❌ لا يمكنك سرقة نفسك!' };
  const robber = ensureUser(robberId);
  const target = ensureUser(targetId);
  const now = Date.now();
  
  if (now - robber.lastRob < ROB_COOLDOWN) {
    const m = Math.ceil((ROB_COOLDOWN - (now - robber.lastRob)) / 60000);
    return { ok: false, msg: `⏳ حاول بعد ${m} دقيقة` };
  }
  if (target.balance < ROB_MIN_TARGET) {
    return { ok: false, msg: '❌ رصيده قليل جداً' };
  }
  
  robber.lastRob = now;
  if (Math.random() < ROB_CHANCE) {
    const stolen = Math.floor(target.balance * 0.15);
    target.balance -= stolen;
    robber.balance = Math.min(MAX_MONEY, robber.balance + stolen);
    saveData();
    return { ok: true, success: true, stolen, msg: `✅ سُرقت **${stolen} دينار**! 💰` };
  } else {
    saveData();
    return { ok: true, success: false, msg: '❌ فشلت المحاولة! تم اكتشافك!' };
  }
}

// ========== أحداث البوت ==========
client.once(Events.ClientReady, () => {
  console.log(`✅ البوت جاهز! تم تسجيل الدخول كـ: ${client.user.tag}`);
});

client.on(Events.MessageCreate, async message => {
  if (message.author.bot || !message.guild) return;
  
  const content = message.content.trim();
  if (!content.startsWith('!')) return;
  
  const args = content.slice(1).split(/\s+/);
  const cmd = args[0].toLowerCase();
  const userId = message.author.id;
  
  try {
    // !حساب / !حسابي
    if (['حساب', 'حسابي'].includes(cmd)) {
      const user = ensureUser(userId);
      const embed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle('💰 حسابك')
        .addFields(
          { name: 'الرصيد', value: `${user.balance} دينار`, inline: true },
          { name: 'عضو منذ', value: `<t:${Math.floor(user.createdAt/1000)}:R>`, inline: true }
        );
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('refresh').setLabel('تحديث').setStyle(ButtonStyle.Primary)
      );
      await message.reply({ embeds: [embed], components: [row] });
      return true;
    }
    
    // !يومي / !راتب
    if (['يومي', 'راتب'].includes(cmd)) {
      const user = ensureUser(userId);
      const now = Date.now();
      if (now - user.lastDaily >= DAILY_COOLDOWN) {
        user.lastDaily = now;
        user.balance = Math.min(MAX_MONEY, user.balance + DAILY_AMOUNT);
        saveData();
        await message.reply(`✅ حصلت على **${DAILY_AMOUNT} دينار** كراتب يومي! 🎉`);
      } else {
        const h = Math.floor((DAILY_COOLDOWN - (now - user.lastDaily)) / 3600000);
        const m = Math.floor(((DAILY_COOLDOWN - (now - user.lastDaily)) % 3600000) / 60000);
        await message.reply(`⏳ انتظر ${h} ساعة و ${m} دقيقة للمكافأة التالية`);
      }
      return true;
    }
    
    // !عمل / !دوام
    if (['عمل', 'دوام'].includes(cmd)) {
      const user = ensureUser(userId);
      const now = Date.now();
      if (now - user.lastWork >= WORK_COOLDOWN) {
        const amount = Math.floor(Math.random() * (WORK_MAX - WORK_MIN + 1)) + WORK_MIN;
        user.lastWork = now;
        user.balance = Math.min(MAX_MONEY, user.balance + amount);
        saveData();
        await message.reply(`✅ انتهيت من العمل! حصلت على **${amount} دينار** 💼`);
      } else {
        const m = Math.ceil((WORK_COOLDOWN - (now - user.lastWork)) / 60000);
        await message.reply(`⏳ استرح قليلاً — يمكنك العمل بعد ${m} دقيقة`);
      }
      return true;
    }
    
    // !سرقة / !نهب
    if (cmd === 'سرقة' || cmd === 'نهب') {
      const target = message.mentions.users.first();
      if (!target) {
        await message.reply('❌ استخدم الأمر هكذا: `!سرقة @الشخص`');
        return true;
      }
      const res = await attemptRob(userId, target.id);
      await message.reply(res.msg);
      return true;
    }
    
    // !مساعدة / !اوامر
    if (['مساعدة', 'اوامر', 'اوامر'].includes(cmd)) {
      const embed = new EmbedBuilder()
        .setColor('#3498db')
        .setTitle('📜 أوامر البوت')
        .addFields(
          { name: '!حساب', value: 'عرض رصيدك وحسابك', inline: true },
          { name: '!يومي', value: 'مكافأتك اليومية', inline: true },
          { name: '!عمل', value: 'العمل وكسب المال', inline: true },
          { name: '!سرقة @شخص', value: 'محاولة سرقة شخص', inline: true }
        );
      await message.reply({ embeds: [embed] });
      return true;
    }
    
    return false;
  } catch (e) {
    console.error('❌ خطأ معالجة الأمر:', e);
    await message.reply('⚠️ حدث خطأ أثناء تنفيذ الأمر');
    return true;
  }
});

// معالجة الأزرار
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton()) return;
  
  if (interaction.customId === 'refresh') {
    const user = ensureUser(interaction.user.id);
    const embed = new EmbedBuilder()
      .setColor('#2ecc71')
      .setTitle('💰 حسابك')
      .addFields(
        { name: 'الرصيد', value: `${user.balance} دينار`, inline: true },
        { name: 'عضو منذ', value: `<t:${Math.floor(user.createdAt/1000)}:R>`, inline: true }
      );
    await interaction.update({ embeds: [embed] });
  }
});

// تشغيل البوت
async function main() {
  loadData();
  console.log('📂 تم تحميل البيانات');
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
