const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('✅ البوت يعمل'));
app.listen(process.env.PORT || 3000);

const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const DATA_PATH = path.join(__dirname, 'data.json');
let userData = {};

function saveData() {
  try {
    fs.writeFileSync(DATA_PATH, JSON.stringify(userData, null, 2));
    return true;
  } catch (err) {
    console.error(err);
    return false;
  }
}

try {
  if (fs.existsSync(DATA_PATH)) {
    userData = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    console.log('✅ تم تحميل بيانات اللاعبين');
  } else {
    fs.writeFileSync(DATA_PATH, '{}');
    userData = {};
    console.log('📄 ملف بيانات جديد جاهز');
  }
} catch (error) {
  userData = {};
  console.log('⚠️ خطأ في تحميل البيانات');
}

const PROPERTIES = [
  { id: 'shop', name: 'متجر صغير', price: 50000, income: 500, emoji: '🏪' },
  { id: 'apartment', name: 'شقة سكنية', price: 150000, income: 1200, emoji: '🏢' },
  { id: 'house', name: 'منزل مستقل', price: 350000, income: 2500, emoji: '🏠' },
  { id: 'building', name: 'مبنى تجاري', price: 800000, income: 6000, emoji: '🏗️' },
  { id: 'tower', name: 'برج استثماري', price: 2000000, income: 15000, emoji: '🗼' }
];

client.on('ready', () => {
  console.log(`✅ تم تسجيل الدخول باسم: ${client.user.tag}`);
  client.user.setActivity('بناء الإمبراطورية الاقتصادية 💰');
});

function ensureUserData(userId) {
  if (!userData[userId]) {
    userData[userId] = {
      balance: 100000,
      properties: [],
      lastDaily: null
    };
  }
  return userData[userId];
}

client.on('messageCreate', async message => {
  if (message.author.bot) return;
  const userId = message.author.id;
  const user = ensureUserData(userId);

  // حساب!
  if (message.content === 'حساب!') {
    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle(`💰 حساب ${message.author.username}`)
      .addFields(
        { name: '💵 الرصيد', value: `${user.balance.toLocaleString()} دولار`, inline: true },
        { name: '🏠 العقارات', value: `${user.properties.length}`, inline: true }
      );
    message.reply({ embeds: [embed] });
  }

  // رصيد!
  else if (message.content === 'رصيد!') {
    message.reply(`💵 رصيدك الحالي: **${user.balance.toLocaleString()} دولار**`);
  }

  // مساعدة!
  else if (message.content === 'مساعدة!') {
    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('📋 قائمة الأوامر')
      .addFields(
        { name: 'حساب!', value: 'عرض بياناتك الكاملة' },
        { name: 'رصيد!', value: 'عرض رصيدك فقط' },
        { name: 'يومي!', value: 'مكافأتك اليومية' },
        { name: 'سوق!', value: 'عرض العقارات المتاحة للشراء' },
        { name: 'شراء اسم_العقار!', value: 'شراء عقار من السوق' },
        { name: 'عقاراتي!', value: 'عرض ممتلكاتك' },
        { name: 'بيع اسم_العقار!', value: 'بيع عقار تملكه' },
        { name: 'قائمة!', value: 'أغنى اللاعبين' }
      );
    message.reply({ embeds: [embed] });
  }

  // يومي!
  else if (message.content === 'يومي!') {
    const today = new Date().toDateString();
    if (user.lastDaily === today) {
      return message.reply('⏰ لقد حصلت على مكافأتك اليوم بالفعل! عد غداً 😊');
    }
    user.lastDaily = today;
    const reward = 5000;
    user.balance += reward;
    saveData();
    message.reply(`🎁 تم! حصلت على **${reward.toLocaleString()} دولار**!\n💵 رصيدك: ${user.balance.toLocaleString()} دولار`);
  }

  // سوق!
  else if (message.content === 'سوق!') {
    let desc = '';
    PROPERTIES.forEach(p => {
      desc += `${p.emoji} **${p.name}** — ${p.price.toLocaleString()} دولار\n    دخل يومي: ${p.income.toLocaleString()}/يوم — اكتب: شراء ${p.name}!\n\n`;
    });
    const embed = new EmbedBuilder()
      .setColor('#0099FF')
      .setTitle('🏢 سوق العقارات')
      .setDescription(desc);
    message.reply({ embeds: [embed] });
  }

  // شراء
  else if (message.content.startsWith('شراء ') && message.content.endsWith('!')) {
    const name = message.content.slice(6, -1).trim();
    const prop = PROPERTIES.find(p => p.name === name);
    if (!prop) return message.reply('❌ هذا العقار غير موجود! اكتب: سوق! لترى الخيارات المتاحة');
    if (user.balance < prop.price) return message.reply(`❌ رصيدك غير كافٍ! تحتاج إلى **${(prop.price - user.balance).toLocaleString()} دولار** إضافي`);
    if (user.properties.find(p => p.id === prop.id)) return message.reply('⚠️ أنت تملك هذا العقار بالفعل!');
    
    user.balance -= prop.price;
    user.properties.push({ ...prop, purchasedAt: Date.now() });
    saveData();
    message.reply(`✅ تم الشراء بنجاح!\n${prop.emoji} **${prop.name}** أصبح ملكاً لك!\n💵 رصيدك المتبقي: ${user.balance.toLocaleString()} دولار\n💰 دخل يومي: +${prop.income.toLocaleString()} دولار/يوم`);
  }

  // عقاراتي!
  else if (message.content === 'عقاراتي!') {
    if (user.properties.length === 0) {
      return message.reply('🏠 لا تملك أي عقار حتى الآن! اكتب: سوق! لتبدأ الاستثمار');
    }
    let desc = '';
    let totalIncome = 0;
    user.properties.forEach(p => {
      desc += `${p.emoji} **${p.name}** — دخل يومي: ${p.income.toLocaleString()} دولار\n`;
      totalIncome += p.income;
    });
    const embed = new EmbedBuilder()
      .setColor('#9933FF')
      .setTitle('🏠 عقاراتك')
      .setDescription(desc)
      .addFields({ name: '💰 إجمالي الدخل اليومي', value: `${totalIncome.toLocaleString()} دولار/يوم` });
    message.reply({ embeds: [embed] });
  }

  // بيع
  else if (message.content.startsWith('بيع ') && message.content.endsWith('!')) {
    const name = message.content.slice(4, -1).trim();
    const propIndex = user.properties.findIndex(p => p.name === name);
    if (propIndex === -1) return message.reply('❌ لا تملك هذا العقار!');
    
    const prop = user.properties[propIndex];
    const sellPrice = Math.floor(prop.price * 0.7);
    user.balance += sellPrice;
    user.properties.splice(propIndex, 1);
    saveData();
    message.reply(`✅ تم البيع بنجاح!\n${prop.emoji} **${prop.name}**\n💵 استلمت: ${sellPrice.toLocaleString()} دولار (خصم 30%)\nرصيدك الحالي: ${user.balance.toLocaleString()} دولار`);
  }

  // قائمة!
  else if (message.content === 'قائمة!') {
    const sorted = Object.entries(userData)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 10);
    
    if (sorted.length === 0) return message.reply('📊 لا توجد بيانات لعرضها حتى الآن!');
    
    let desc = '';
    sorted.forEach((u, i) => {
      const medal = i === 0 ? '👑' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      desc += `${medal} <@${u.id}> — **${u.balance.toLocaleString()} دولار** — ${u.properties.length} عقار\n`;
    });
    const embed = new EmbedBuilder()
      .setColor('#FF9900')
      .setTitle('🏆 قائمة أغنى اللاعبين')
      .setDescription(desc);
    message.reply({ embeds: [embed] });
  }
});
// ==================== 🎮 مجموعة الألعاب الكاملة ====================

client.on('messageCreate', async message => {
  if (message.author.bot) return;
  const userId = message.author.id;
  const user = ensureUserData(userId);

  // 🎲 1. روليت
  if (/^روليت \d+!$/.test(message.content)) {
    const amount = parseInt(message.content.match(/\d+/)[0]);
    if (amount < 100) return message.reply('❌ الحد الأدنى: 100 دولار');
    if (user.balance < amount) return message.reply('❌ رصيدك غير كافٍ');
    
    user.balance -= amount;
    const win = Math.random() > 0.48;
    if (win) {
      user.balance += amount * 2;
      saveData();
      message.reply(`🎊🎉 فزت! ربحت **${(amount*2).toLocaleString()} دولار**!\n💰 رصيدك: ${user.balance.toLocaleString()} دولار`);
    } else {
      saveData();
      message.reply(`😢 خسرت ${amount.toLocaleString()} دولار\n💵 رصيدك: ${user.balance.toLocaleString()} دولار`);
    }
  }

  // 📦 2. صناديق الكنز
  else if (message.content === 'صناديق!') {
    const luck = Math.random();
    if (luck > 0.75) {
      const prize = Math.floor(Math.random() * 8000) + 2000;
      user.balance += prize;
      saveData();
      message.reply(`✨📦 صندوق ذهب نادر!\n💰 وجدت: **${prize.toLocaleString()} دولار**!\nرصيدك: ${user.balance.toLocaleString()} دولار`);
    } else if (luck > 0.4) {
      const prize = Math.floor(Math.random() * 1500) + 300;
      user.balance += prize;
      saveData();
      message.reply(`📦 وجدت بعض النقود\n💰 +${prize.toLocaleString()} دولار\nرصيدك: ${user.balance.toLocaleString()} دولار`);
    } else {
      message.reply(`📦 الصندوق فارغ 😔 حاول مرة أخرى لاحقاً!`);
    }
  }

  // 🪙 3. قرعة
  else if (/^قرعة \d+!$/.test(message.content)) {
    const amount = parseInt(message.content.match(/\d+/)[0]);
    if (amount < 50) return message.reply('❌ الحد الأدنى: 50 دولار');
    if (user.balance < amount) return message.reply('❌ رصيدك غير كافٍ');
    
    user.balance -= amount;
    const win = Math.random() > 0.5;
    if (win) {
      user.balance += amount * 1.8;
      saveData();
      message.reply(`🪙 ${Math.random()>0.5?'رأس':'ذيل'} — فزت!\n💰 +${(amount*1.8).toLocaleString()} دولار`);
    } else {
      saveData();
      message.reply(`🪙 خسرت ${amount.toLocaleString()} دولار 😔`);
    }
  }

  // 🎯 4. تخمين الرقم
  else if (/^تخمين \d+ \d+!$/.test(message.content)) {
    const [min, max] = message.content.match(/\d+/g).map(Number);
    if (min >= max || max - min < 5) return message.reply('❌ اكتب: تخمين 1 10! مثلاً');
    const target = Math.floor(Math.random() * (max - min + 1)) + min;
    message.reply(`🔢 لقد اخترت رقماً بين **${min}** و **${max}**... اكتب: أجابة الرقم!`);
  }

  // 🎰 5. حظوظ
  else if (/^حظوظ \d+!$/.test(message.content)) {
    const amount = parseInt(message.content.match(/\d+/)[0]);
    if (amount < 100) return message.reply('❌ الحد الأدنى: 100 دولار');
    if (user.balance < amount) return message.reply('❌ رصيدك غير كافٍ');
    
    user.balance -= amount;
    const roll = Math.random();
    let multiplier = 0;
    if (roll > 0.95) multiplier = 10;
    else if (roll > 0.85) multiplier = 5;
    else if (roll > 0.65) multiplier = 2;
    else if (roll > 0.45) multiplier = 1;
    
    if (multiplier > 0) {
      user.balance += amount * multiplier;
      saveData();
      message.reply(`🎰🎉 ×${multiplier}! ربحت **${(amount*multiplier).toLocaleString()} دولار**!`);
    } else {
      saveData();
      message.reply(`🎰 💨 لم يحالفك الحظ هذه المرة`);
    }
  }

  // 🎲 6. نرد
  else if (/^نرد \d+!$/.test(message.content)) {
    const amount = parseInt(message.content.match(/\d+/)[0]);
    if (amount < 100) return message.reply('❌ الحد الأدنى: 100 دولار');
    if (user.balance < amount) return message.reply('❌ رصيدك غير كافٍ');
    
    user.balance -= amount;
    const dice1 = Math.floor(Math.random() * 6) + 1;
    const dice2 = Math.floor(Math.random() * 6) + 1;
    const total = dice1 + dice2;
    let winAmount = 0;
    let msg = `🎲 النرد: **${dice1} + ${dice2} = ${total}**\n`;
    
    if (total === 7 || total === 11) {
      winAmount = amount * 1.5;
      msg += '✨ فوز سريع!';
    } else if (dice1 === dice2) {
      winAmount = amount * 2;
      msg += '🎊 زوج متماثل — مضاعف!';
    } else if (total >= 8 && total <= 10) {
      winAmount = Math.floor(amount * 0.5);
      msg += 'جيد! استرداد نصف المبلغ';
    } else {
      msg += 'خسرت 😔';
    }
    
    if (winAmount > 0) {
      user.balance += amount + winAmount;
      saveData();
      msg += `\n💰 ربحت ${winAmount.toLocaleString()} دولار`;
    }
    saveData();
    msg += `\n💵 رصيدك: ${user.balance.toLocaleString()} دولار`;
    message.reply(msg);
  }

  // 🏆 7. سباق
  else if (message.content === 'سباق!') {
    const runners = ['🐇 أرنب', '🐢 سلحفاة', '🐕 كلب', '🐈 قط', '🦊 ثعلب'];
    const shuffled = runners.sort(() => Math.random() - 0.5).slice(0, 3);
    message.reply(`🏁 بدأ السباق!\n\n🥇 ${shuffled[0]}\n🥈 ${shuffled[1]}\n🥉 ${shuffled[2]}`);
  }

  // 🃏 8. ورقة
  else if (/^ورقة \d+!$/.test(message.content)) {
    const amount = parseInt(message.content.match(/\d+/)[0]);
    if (amount < 100) return message.reply('❌ الحد الأدنى: 100 دولار');
    if (user.balance < amount) return message.reply('❌ رصيدك غير كافٍ');
    
    const cards = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'ج', 'ق', 'ك', 'أ'];
    const values = { '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'ج':11,'ق':12,'ك':13,'أ':14 };
    const suit = ['♥', '♦', '♠', '♣'];
    
    const playerCard = cards[Math.floor(Math.random()*cards.length)];
    const dealerCard = cards[Math.floor(Math.random()*cards.length)];
    const playerSuit = suit[Math.floor(Math.random()*suit.length)];
    const dealerSuit = suit[Math.floor(Math.random()*suit.length)];
    
    let result = '';
    let change = 0;
    
    if (values[playerCard] > values[dealerCard]) {
      result = '🎉 فزت!';
      change = amount;
    } else if (values[playerCard] < values[dealerCard]) {
      result = '😢 خسرت';
      change = -amount;
    } else {
      result = '⚖️ تعادل — استرداد المبلغ';
      change = 0;
    }
    
    user.balance += change;
    saveData();
    
    message.reply(`🃏 أنت: **${playerCard}${playerSuit}**\n🃏 الموزع: **${dealerCard}${dealerSuit}**\n\n${result}\n💵 رصيدك: ${user.balance.toLocaleString()} دولار`);
  }

  // 🌫️ 9. مزاد سري
  else if (message.content === 'مزاد سري!') {
    const items = [
      { name: 'قطعة أثرية نادرة', min: 50000, emoji: '🏺' },
      { name: 'سيارة كلاسيكية', min: 150000, emoji: '🚗' },
      { name: 'مجوهرات ملكية', min: 300000, emoji: '💎' },
      { name: 'لوحة فنية أصلية', min: 500000, emoji: '🖼️' },
      { name: 'تحفة نادرة', min: 750000, emoji: '🏆' }
    ];
    const item = items[Math.floor(Math.random() * items.length)];
    message.reply(`🌫️ **مزاد سري**\nيوجد شيء غامض معروض للمزايدة...\n💡 التلميح: يبدأ من **${item.min.toLocaleString()} دولار**\nاكتب: مزايدة المبلغ! لتشارك`);
  }

  // 📋 قائمة الألعاب
  else if (message.content === 'ألعاب!') {
    const embed = new EmbedBuilder()
      .setColor('#FF6600')
      .setTitle('🎮 قائمة الألعاب')
      .addFields(
        { name: '🎲 روليت المبلغ!', value: 'رهان — تضاعف أو تخسر' },
        { name: '🪙 قرعة المبلغ!', value: 'رأس أم ذيل — مضاعفة 1.8x' },
        { name: '🎰 حظوظ المبلغ!', value: 'حظك قد يضاعف رهانك حتى 10 أضعاف!' },
        { name: '🎲 نرد المبلغ!', value: 'زوج = مضاعف 2x ، 7 أو 11 = 1.5x' },
        { name: '🃏 ورقة المبلغ!', value: 'أوراق — ورقتك أقوى من ورقتي؟' },
        { name: '📦 صناديق!', value: 'افتح صندوقاً عشوائياً كل فترة' },
        { name: '🏁 سباق!', value: 'شاهد نتيجة السباق العشوائي' },
        { name: '🌫️ مزاد سري!', value: 'شارك في مزاد القطع النادرة' }
      );
    message.reply({ embeds: [embed] });
  }
});

client.login(process.env.DISCORD_TOKEN);
