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
      bank: 0,
      lastDaily: 0,
      lastWork: 0,
      lastRob: 0,
      lastDeposit: 0,
      lastWithdraw: 0,
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

// ========== رسالة الترحيب الرئيسية ==========
async function sendMainMenu(channel) {
  const embed = new EmbedBuilder()
    .setColor('#3498db')
    .setTitle('🏦 مركز الاقتصاد')
    .setDescription('مرحباً بك! اختر من الأزرار أدناه ما تريد القيام به:');

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('account').setLabel('حسابي').setStyle(ButtonStyle.Primary).setEmoji('💳'),
    new ButtonBuilder().setCustomId('bank').setLabel('البنك').setStyle(ButtonStyle.Secondary).setEmoji('🏛️'),
    new ButtonBuilder().setCustomId('daily').setLabel('المكافأة اليومية').setStyle(ButtonStyle.Success).setEmoji('🎁')
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('portfolio').setLabel('محفظتي').setStyle(ButtonStyle.Primary).setEmoji('📈'),
    new ButtonBuilder().setCustomId('market').setLabel('السوق').setStyle(ButtonStyle.Secondary).setEmoji('📊'),
    new ButtonBuilder().setCustomId('games').setLabel('الألعاب').setStyle(ButtonStyle.Danger).setEmoji('🎮')
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('jobs').setLabel('الوظائف').setStyle(ButtonStyle.Secondary).setEmoji('💼'),
    new ButtonBuilder().setCustomId('properties').setLabel('العقارات').setStyle(ButtonStyle.Secondary).setEmoji('🏠'),
    new ButtonBuilder().setCustomId('leaderboard').setLabel('الترتيب').setStyle(ButtonStyle.Secondary).setEmoji('🏆')
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
          user.lastDaily = now;
          user.balance = Math.min(MAX_MONEY, user.balance + DAILY_AMOUNT);
          saveData();
          const embed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle('🎁 المكافأة اليومية')
            .setDescription(`✅ حصلت على **${DAILY_AMOUNT} دينار**! 🎉\n\nأعد الزيارة غداً للحصول على مكافأتك التالية`);
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

      case 'portfolio': {
        const embed = new EmbedBuilder()
          .setColor('#1abc9c')
          .setTitle('📈 محفظتي')
          .setDescription('هنا تظهر أسهمك وأصولك الاستثمارية')
          .addFields({ name: 'الحالة', value: 'لا توجد أصول حتى الآن — تفضل بزيارة السوق لشراء الأسهم!' });
        await interaction.reply({ embeds: [embed], ephemeral: false });
        break;
      }

      case 'market': {
        const embed = new EmbedBuilder()
          .setColor('#e74c3c')
          .setTitle('📊 السوق المالي')
          .setDescription('أسعار الأسهم والمعادن تتغير باستمرار')
          .addFields(
            { name: 'شركة التكنولوجيا', value: '📈 150 دينار', inline: true },
            { name: 'الذهب', value: '📉 85 دينار/غرام', inline: true },
            { name: 'النفط', value: '📊 72 دينار/برميل', inline: true }
          )
          .setFooter({ text: 'الأسعار تتحدث كل ساعة — استخدم !شراء لبدء التداول' });
        await interaction.reply({ embeds: [embed], ephemeral: false });
        break;
      }

      case 'games': {
        const embed = new EmbedBuilder()
          .setColor('#9b59b6')
          .setTitle('🎮 الألعاب')
          .setDescription('ألعاب ممتعة لكسب المال والمرح')
          .addFields(
            { name: '🎲 النرد', value: 'اكتب !نرد للعب', inline: true },
            { name: '🔢 التخمين', value: 'اكتب !تخمين للعب', inline: true },
            { name: '🃏 ورق', value: 'قريباً...', inline: true }
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

      case 'properties': {
        const embed = new EmbedBuilder()
          .setColor('#e67e22')
          .setTitle('🏠 العقارات')
          .setDescription('اشترِ عقاراً لزيادة دخلك الشهري')
          .addFields(
            { name: 'شقة صغيرة', value: '5,000 دينار — دخل شهري 100 دينار', inline: false },
            { name: 'منزل', value: '20,000 دينار — دخل شهري 500 دينار', inline: false },
            { name: 'مبنى تجاري', value: '100,000 دينار — دخل شهري 3,000 دينار', inline: false }
          );
        await interaction.reply({ embeds: [embed], ephemeral: false });
        break;
      }

      case 'leaderboard': {
        const sorted = Object.entries(data.users)
          .sort((a, b) => (b[1].balance + b[1].bank) - (a[1].balance + a[1].bank))
          .slice(0, 10);
        
        let desc = '';
        sorted.forEach((u, i) => {
          const total = u[1].balance + u[1].bank;
          desc += `${i+1}. <@${u[0]}> — **${total} دينار**\n`;
        });
        
        const embed = new EmbedBuilder()
          .setColor('#f1c40f')
          .setTitle('🏆 قائمة الأغنياء')
          .setDescription(desc || 'لا توجد بيانات حتى الآن!');
        await interaction.reply({ embeds: [embed], ephemeral: false });
        break;
      }

      case 'shop': {
        const embed = new EmbedBuilder()
          .setColor('#27ae60')
          .setTitle('🛍️ المتجر')
          .setDescription('اشترِ ما تحتاجه من هنا')
          .addFields(
            { name: '🛡️ حماية من السرقة', value: '500 دينار — تدوم 24 ساعة', inline: false },
            { name: '💎 ضعف المكافأة اليومية', value: '1,000 دينار — لمرة واحدة', inline: false },
            { name: '🚫 حظر شخص من سرقتك', value: '2,000 دينار — لمدة أسبوع', inline: false }
          );
        await interaction.reply({ embeds: [embed], ephemeral: false });
        break;
      }

      case 'inventory': {
        const embed = new EmbedBuilder()
          .setColor('#8e44ad')
          .setTitle('🎒 مقتنياتي')
          .setDescription('لا تمتلك أي عناصر حتى الآن — تفضل بزيارة المتجر! 🛍️');
        await interaction.reply({ embeds: [embed], ephemeral: false });
        break;
      }

      case 'help': {
        const embed = new EmbedBuilder()
          .setColor('#95a5a6')
          .setTitle('❓ المساعدة')
          .setDescription('دليل استخدام النظام')
          .addFields(
            { name: '!قائمة', value: 'عرض قائمة الأزرار الرئيسية', inline: true },
            { name: '!إيداع المبلغ', value: 'إيداع المال في البنك', inline: true },
            { name: '!سحب المبلغ', value: 'سحب المال من البنك', inline: true },
            { name: '!سرقة @شخص', value: 'محاولة سرقة شخص', inline: true }
          );
        await interaction.reply({ embeds: [embed], ephemeral: false });
        break;
        
      case 'rob': {
        const embed = new EmbedBuilder()
          .setColor('#e74c3c')
          .setTitle('⚡ السرقة / النهب')
          .setDescription('اكتب الأمر في الدردشة هكذا:\n`!سرقة @الشخص`\n\n📊 التفاصيل:\n• فرصة النجاح: 40%\n• نسبة المسروق: 15% من رصيده\n• فترة الانتظار: ساعة كاملة\n• لا يمكن سرقة من رصيده أقل من 50 دينار')
          .setFooter({ text: 'انتبه: قد يتم اكتشافك وفشل محاولتك!' });
        await interaction.reply({ embeds: [embed], ephemeral: false });
        break;
      }

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
  
  // أمر عرض القائمة الرئيسية
  if (['!قائمة', '!الرئيسية', '!بداية', 'الوحة'].includes(content.toLowerCase())) {
    await sendMainMenu(message.channel);
    return;
  }
  
  // !إيداع
  if (content.startsWith('!إيداع ')) {
    const amount = parseInt(content.split(' ')[1]);
    const user = ensureUser(message.author.id);
    if (isNaN(amount) || amount <= 0 || amount > user.balance) {
      await message.reply('❌ مبلغ غير صالح أو رصيدك لا يكفي');
      return;
    }
    user.balance -= amount;
    user.bank += amount;
    saveData();
    await message.reply(`✅ تم إيداع **${amount} دينار** في بنكك! 🏦`);
    return;
  }
  
  // !سحب
  if (content.startsWith('!سحب ')) {
    const amount = parseInt(content.split(' ')[1]);
    const user = ensureUser(message.author.id);
    if (isNaN(amount) || amount <= 0 || amount > user.bank) {
      await message.reply('❌ مبلغ غير صالح أو رصيدك في البنك لا يكفي');
      return;
    }
    user.bank -= amount;
    user.balance += amount;
    saveData();
    await message.reply(`✅ تم سحب **${amount} دينار** من بنكك! 💳`);
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
