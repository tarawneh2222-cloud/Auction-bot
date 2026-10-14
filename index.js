'use strict';

const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (_req, res) => res.send('✅ البوت يعمل بكامل طاقته!'));
app.listen(PORT, () => console.log(`🌐 الخادم يعمل على المنفذ ${PORT}`));

const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// بيانات المستخدمين
const userData = new Map();
function getUser(id) {
  if (!userData.has(id)) {
    userData.set(id, {
      balance: 1000,
      bank: 0,
      investments: {},
      lastDaily: 0,
      lastDailyBox: 0
    });
  }
  return userData.get(id);
}

// بيانات السوق والأسهم
const stocks = {
  gold: { name: 'ذهب', icon: '🥇', price: 200, change: 0 },
  silver: { name: 'فضة', icon: '🥈', price: 80, change: 0 },
  tech: { name: 'أسهم تقنية', icon: '💻', price: 100, change: 0 },
  realestate: { name: 'عقارات', icon: '🏘️', price: 150, change: 0 },
  oil: { name: 'نفط', icon: '🛢️', price: 120, change: 0 },
  crypto: { name: 'عملات رقمية', icon: '₿', price: 300, change: 0 }
};

// تحديث أسعار الأسهم كل ساعة
setInterval(() => {
  for (const key in stocks) {
    const changePercent = (Math.random() - 0.5) * 0.2;
    const oldPrice = stocks[key].price;
    stocks[key].price = Math.round(stocks[key].price * (1 + changePercent));
    stocks[key].price = Math.max(10, Math.min(1000, stocks[key].price));
    stocks[key].change = Math.round(((stocks[key].price - oldPrice) / oldPrice) * 100);
  }
}, 3600000);

// معالجة الأوامر
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const user = getUser(interaction.user.id);
  const { commandName, options } = interaction;

  // ========== 📊 الأوامر الرئيسية ==========
  
  if (commandName === 'حسابي') {
    const invCount = Object.keys(user.investments).length;
    await interaction.reply(
      `💰 **معلومات حسابك**\n` +
      `💵 الرصيد: **${user.balance} ريال**\n` +
      `🏦 في البنك: **${user.bank} ريال**\n` +
      `📈 استثماراتك: **${invCount} نوع`
    );
  }

  else if (commandName === 'راتب') {
    const now = Date.now();
    if (now - user.lastDaily < 86400000) {
      return await interaction.reply('⏰ عُد بعد 24 ساعة!');
    }
    user.lastDaily = now;
    user.balance += 200;
    await interaction.reply('✅ استلمت راتبك: **200 ريال** 💵');
  }

  else if (commandName === 'ايداع') {
    const amount = options.getInteger('المبلغ');
    if (amount <= 0 || amount > user.balance) return await interaction.reply('❌ مبلغ غير صالح!');
    user.balance -= amount;
    user.bank += amount;
    await interaction.reply(`✅ أودعت **${amount} ريال**\n💰 رصيد: ${user.balance} | 🏦 بنك: ${user.bank}`);
  }

  else if (commandName === 'سحب') {
    const amount = options.getInteger('المبلغ');
    if (amount <= 0 || amount > user.bank) return await interaction.reply('❌ مبلغ غير صالح!');
    user.bank -= amount;
    user.balance += amount;
    await interaction.reply(`✅ سحبت **${amount} ريال**\n💰 رصيد: ${user.balance} | 🏦 بنك: ${user.bank}`);
  }

  else if (commandName === 'تعويض') {
    if (!interaction.member.permissions.has('Administrator')) {
      return await interaction.reply('❌ غير مسموح لك بهذا الأمر!', { ephemeral: true });
    }
    const targetId = options.getString('المعرف');
    const amount = options.getInteger('المبلغ');
    const targetUser = getUser(targetId);
    targetUser.balance += amount;
    await interaction.reply(`✅ تم تعويض المستخدم بـ **${amount} ريال**`);
  }

  // ========== 📈 الأسهم والاستثمارات ==========

  else if (commandName === 'السوق') {
    let msg = '📊 **أسعار السوق:**\n\n';
    for (const key in stocks) {
      const s = stocks[key];
      const trend = s.change >= 0 ? '📈 +' : '📉 ';
      msg += `${s.icon} **${s.name}**: ${s.price} ريال (${trend}${s.change}%)\n`;
    }
    await interaction.reply(msg);
  }

  else if (commandName === 'شراء') {
    const symbol = options.getString('السهم');
    const qty = options.getInteger('الكمية');
    if (!stocks[symbol]) return await interaction.reply('❌ سهم غير صالح! استخدم /السوق');
    if (qty <= 0) return await interaction.reply('❌ كمية غير صالحة!');
    const total = stocks[symbol].price * qty;
    if (total > user.balance) return await interaction.reply(`❌ رصيدك غير كافٍ! السعر: ${total} ريال`);
    
    user.balance -= total;
    if (!user.investments[symbol]) user.investments[symbol] = { quantity: 0, invested: 0 };
    user.investments[symbol].quantity += qty;
    user.investments[symbol].invested += total;
    
    await interaction.reply(
      `✅ تم الشراء:\n` +
      `${stocks[symbol].icon} **${stocks[symbol].name}** × ${qty}\n` +
      `💰 التكلفة: ${total} ريال\n` +
      `💵 رصيد متبقي: ${user.balance} ريال`
    );
  }

  else if (commandName === 'بيع') {
    const symbol = options.getString('السهم');
    const qty = options.getInteger('الكمية');
    if (!user.investments[symbol] || user.investments[symbol].quantity < qty) {
      return await interaction.reply('❌ لا تمتلك هذا الكمية!');
    }
    const sellPrice = stocks[symbol].price * qty;
    const investedPer = user.investments[symbol].invested / user.investments[symbol].quantity;
    const profit = sellPrice - (investedPer * qty);
    
    user.balance += sellPrice;
    user.investments[symbol].quantity -= qty;
    if (user.investments[symbol].quantity === 0) delete user.investments[symbol];
    
    const profitText = profit >= 0 ? `✅ ربح: +${profit} ريال` : `❌ خسارة: ${profit} ريال`;
    await interaction.reply(
      `✅ تم البيع:\n` +
      `${stocks[symbol].icon} **${stocks[symbol].name}** × ${qty}\n` +
      `💰 المبلغ: ${sellPrice} ريال\n` +
      `${profitText}\n` +
      `💵 رصيد: ${user.balance} ريال`
    );
  }

  else if (commandName === 'محفظة') {
    let msg = '📂 **محفظتك:**\n\n';
    if (Object.keys(user.investments).length === 0) {
      msg += 'لا توجد استثمارات بعد! استخدم /السوق لبدء التداول 📈';
    } else {
      for (const symbol in user.investments) {
        const inv = user.investments[symbol];
        const stock = stocks[symbol];
        const value = stock.price * inv.quantity;
        const profit = value - inv.invested;
        const trend = profit >= 0 ? '📈' : '📉';
        msg += `${stock.icon} **${stock.name}**: ${inv.quantity} سهم\n`;
        msg += `   القيمة: ${value} ريال | تكلفة: ${inv.invested} ريال\n`;
        msg += `   ${trend} ربح/خسارة: ${profit >= 0 ? '+' : ''}${profit} ريال\n\n`;
      }
    }
    await interaction.reply(msg);
  }

  // ========== 🎮 الألعاب ==========

  else if (commandName === 'حظ') {
    const bet = options.getInteger('المبلغ');
    const guess = options.getInteger('الرقم');
    if (bet <= 0 || bet > user.balance) return await interaction.reply('❌ مبلغ غير صالح! رصيدك: ' + user.balance);
    if (guess < 1 || guess > 10) return await interaction.reply('❌ اختر رقماً من 1 إلى 10');
    user.balance -= bet;
    const lucky = Math.floor(Math.random() * 10) + 1;
    if (guess === lucky) {
      user.balance += bet * 5;
      await interaction.reply(`🎯 الرقم كان: **${lucky}**\n🎉 فزت بـ **${bet * 5} ريال**! رصيدك: ${user.balance}`);
    } else {
      await interaction.reply(`🎯 الرقم كان: **${lucky}**\n❌ خسرت **${bet} ريال** رصيدك: ${user.balance}`);
    }
  }

  else if (commandName === 'عملة') {
    const bet = options.getInteger('المبلغ');
    const choice = options.getString('الوجه');
    if (bet <= 0 || bet > user.balance) return await interaction.reply('❌ مبلغ غير صالح! رصيدك: ' + user.balance);
    user.balance -= bet;
    const result = Math.random() < 0.5 ? 'وجه' : 'خلف';
    const emoji = result === 'وجه' ? '👤' : '🏛️';
    if (choice === result) {
      user.balance += bet * 2;
      await interaction.reply(`${emoji} النتيجة: **${result}**\n🎉 فزت! رصيدك: **${user.balance} ريال**`);
    } else {
      await interaction.reply(`${emoji} النتيجة: **${result}**\n❌ خسرت! رصيدك: **${user.balance} ريال**`);
    }
  }

  else if (commandName === 'نرد') {
    const bet = options.getInteger('المبلغ');
    const type = options.getString('النوع');
    if (bet <= 0 || bet > user.balance) return await interaction.reply('❌ مبلغ غير صالح! رصيدك: ' + user.balance);
    user.balance -= bet;
    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    const sum = d1 + d2;
    let won = false, multiplier = 1;
    if (type === 'زوج' && d1 === d2) { won = true; multiplier = 6; }
    else if (type === 'مجموع_زوجي' && sum % 2 === 0) { won = true; multiplier = 2; }
    else if (type === 'مجموع_فردي' && sum % 2 === 1) { won = true; multiplier = 2; }
    else if (type === 'اكبر_من_7' && sum > 7) { won = true; multiplier = 2; }
    else if (type === 'اصغر_من_7' && sum < 7) { won = true; multiplier = 2; }
    if (won) {
      user.balance += bet * multiplier;
      await interaction.reply(`🎲 النرد: **${d1}** + **${d2}** = **${sum}**\n🎉 فزت بـ **${bet * multiplier} ريال**! رصيدك: ${user.balance}`);
    } else {
      await interaction.reply(`🎲 النرد: **${d1}** + **${d2}** = **${sum}**\n❌ خسرت **${bet} ريال** رصيدك: ${user.balance}`);
    }
  }

  else if (commandName === 'ورق') {
    const bet = options.getInteger('المبلغ');
    if (bet <= 0 || bet > user.balance) return await interaction.reply('❌ مبلغ غير صالح! رصيدك: ' + user.balance);
    user.balance -= bet;
    const player = Math.floor(Math.random() * 11) + 16;
    const dealer = Math.floor(Math.random() * 11) + 16;
    let resultText = '';
    if (player > 21) {
      resultText = `🃏 نتيجتك: **${player}** — تجاوزت الـ 21! ❌ خسرت`;
    } else if (dealer > 21 || player > dealer) {
      user.balance += bet * 2;
      resultText = `🃏 نتيجتك: **${player}** | الكازينو: **${dealer}** 🎉 فزت بـ **${bet * 2} ريال**`;
    } else if (player === dealer) {
      user.balance += bet;
      resultText = `🃏 نتيجتك: **${player}** | الكازينو: **${dealer}** ⚖️ تعادل`;
    } else {
      resultText = `🃏 نتيجتك: **${player}** | الكازينو: **${dealer}** ❌ خسرت`;
    }
    await interaction.reply(`${resultText}\n💰 رصيدك: **${user.balance} ريال**`);
  }

  else if (commandName === 'صندوق_يومي') {
    const now = Date.now();
    if (user.lastDailyBox && now - user.lastDailyBox < 86400000) {
      return await interaction.reply('⏰ عُد غداً!');
    }
    const rewards = [50, 75, 100, 150, 200, 250, 500];
    const amount = rewards[Math.floor(Math.random() * rewards.length)];
    user.balance += amount;
    user.lastDailyBox = now;
    await interaction.reply(`📦 وجدت: **${amount} ريال**! 🎉`);
  }
});

// ========== 📋 تسجيل جميع الأوامر ==========

const commands = [
  // الأوامر الرئيسية
  new SlashCommandBuilder().setName('حسابي').setDescription('عرض رصيدك ومعلومات حسابك'),
  new SlashCommandBuilder().setName('راتب').setDescription('استلام راتب يومي'),
  new SlashCommandBuilder()
    .setName('ايداع')
    .setDescription('إيداع في البنك')
    .addIntegerOption(o => o.setName('المبلغ').setDescription('المبلغ').setMinValue(1).setRequired(true)),
  new SlashCommandBuilder()
    .setName('سحب')
    .setDescription('سحب من البنك')
    .addIntegerOption(o => o.setName('المبلغ').setDescription('المبلغ').setMinValue(1).setRequired(true)),
  new SlashCommandBuilder()
    .setName('تعويض')
    .setDescription('إضافة رصيد لمستخدم (للمدراء فقط)')
    .setDefaultMemberPermissions('0')
    .addStringOption(o => o.setName('المعرف').setDescription('معرف المستخدم').setRequired(true))
    .addIntegerOption(o => o.setName('المبلغ').setDescription('المبلغ').setMinValue(1).setRequired(true))
    .addStringOption(o => o.setName('السبب').setDescription('سبب التعويض')),

  // الأسهم والاستثمارات
  new SlashCommandBuilder().setName('السوق').setDescription('أسعار السوق'),
  new SlashCommandBuilder()
    .setName('شراء')
    .setDescription('شراء سهم')
    .addStringOption(o => o.setName('السهم').setDescription('رمز السهم: gold, silver, tech, realestate, oil, crypto').setRequired(true))
    .addIntegerOption(o => o.setName('الكمية').setDescription('العدد').setMinValue(1).setRequired(true)),
  new SlashCommandBuilder()
    .setName('بيع')
    .setDescription('بيع سهم')
    .addStringOption(o => o.setName('السهم').setDescription('رمز السهم').setRequired(true))
    .addIntegerOption(o => o.setName('الكمية').setDescription('العدد').setMinValue(1).setRequired(true)),
  new SlashCommandBuilder().setName('محفظة').setDescription('عرض محفظتك'),

  // الألعاب
  new SlashCommandBuilder()
    .setName('حظ')
    .setDescription('تخمن رقماً 1-10 واربح 5 أضعاف')
    .addIntegerOption(o => o.setName('المبلغ').setDescription('مبلغ الرهان').setMinValue(10).setRequired(true))
    .addIntegerOption(o => o.setName('الرقم').setDescription('رقمك 1-10').setMinValue(1).setMaxValue(10).setRequired(true)),
  new SlashCommandBuilder()
    .setName('عملة')
    .setDescription('وجه أم خلف؟')
    .addIntegerOption(o => o.setName('المبلغ').setDescription('مبلغ الرهان').setMinValue(10).setRequired(true))
    .addStringOption(o => o.setName('الوجه').setDescription('اختر').setChoices({ name: 'وجه', value: 'وجه' }, { name: 'خلف', value: 'خلف' }).setRequired(true)),
  new SlashCommandBuilder()
    .setName('نرد')
    .setDescription('رهان على النرد')
    .addIntegerOption(o => o.setName('المبلغ').setDescription('مبلغ الرهان').setMinValue(10).setRequired(true))
    .addStringOption(o => o.setName('النوع').setDescription('نوع الرهان').setChoices(
      { name: 'نردان متشابهان', value: 'زوج' },
      { name: 'مجموع زوجي', value: 'مجموع_زوجي' },
      { name: 'مجموع فردي', value: 'مجموع_فردي' },
      { name: 'أكبر من 7', value: 'اكبر_من_7' },
      { name: 'أصغر من 7', value: 'اصغر_من_7' }
    ).setRequired(true)),
  new SlashCommandBuilder()
    .setName('ورق')
    .setDescription('لعبة ورق')
    .addIntegerOption(o => o.setName('المبلغ').setDescription('مبلغ الرهان').setMinValue(10).setRequired(true)),
  new SlashCommandBuilder().setName('صندوق_يومي').setDescription('صندوقك اليومي المجاني')
];

// تشغيل البوت
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

client.on('ready', async () => {
  console.log(`✅ ${client.user.username} جاهز!`);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('✅ تم تحميل جميع الأوامر بنجاح!');
  } catch (error) {
    console.error('❌ خطأ:', error);
  }
});

if (!process.env.DISCORD_TOKEN) {
  console.error('❌ لم يتم العثور على التوكن!');
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error('❌ خطأ في تسجيل الدخول:', err);
  process.exit(1);
});
