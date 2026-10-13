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
    console.log('✅ تم تحميل البيانات');
  } else {
    fs.writeFileSync(DATA_PATH, '{}');
    userData = {};
  }
} catch (error) {
  userData = {};
}

const PROPERTIES = [
  { id: 'shop', name: 'متجر صغير', price: 50000, income: 500, emoji: '🏪' },
  { id: 'apartment', name: 'شقة سكنية', price: 150000, income: 1200, emoji: '🏢' },
  { id: 'house', name: 'منزل مستقل', price: 350000, income: 2500, emoji: '🏠' },
  { id: 'building', name: 'مبنى تجاري', price: 800000, income: 6000, emoji: '🏗️' },
  { id: 'tower', name: 'برج استثماري', price: 2000000, income: 15000, emoji: '🗼' }
];

function ensureUserData(userId) {
  if (!userData[userId]) {
    userData[userId] = { balance: 100000, properties: [], lastDaily: null };
  }
  return userData[userId];
}

client.on('ready', () => {
  console.log(`✅ ${client.user.tag}`);
  client.user.setActivity('بناء الإمبراطورية الاقتصادية 💰');
});

client.on('messageCreate', async message => {
  if (message.author.bot) return;
  const userId = message.author.id;
  const user = ensureUserData(userId);
  const content = message.content;

  // === 📋 الأوامر الأساسية ===
  if (content === 'حساب!') {
    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle(`💰 حساب ${message.author.username}`)
      .addFields(
        { name: '💵 الرصيد', value: `${user.balance.toLocaleString()} دولار`, inline: true },
        { name: '🏠 العقارات', value: `${user.properties.length}`, inline: true }
      );
    return message.reply({ embeds: [embed] });
  }
  
  if (content === 'رصيد!') {
    return message.reply(`💵 رصيدك: **${user.balance.toLocaleString()} دولار**`);
  }
  
  if (content === 'مساعدة!') {
    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('📋 قائمة الأوامر')
      .addFields(
        { name: 'حساب!', value: 'عرض بياناتك الكاملة' },
        { name: 'رصيد!', value: 'عرض رصيدك فقط' },
        { name: 'يومي!', value: 'مكافأة يومية' },
        { name: 'سوق!', value: 'عرض العقارات' },
        { name: 'شراء اسم!', value: 'شراء عقار' },
        { name: 'عقاراتي!', value: 'ممتلكاتك' },
        { name: 'بيع اسم!', value: 'بيع عقار' },
        { name: 'قائمة!', value: 'أغنى اللاعبين' },
        { name: 'ألعاب!', value: 'عرض الألعاب المتاحة 🎮' }
      );
    return message.reply({ embeds: [embed] });
  }
  
  if (content === 'يومي!') {
    const today = new Date().toDateString();
    if (user.lastDaily === today) {
      return message.reply('⏰ لقد حصلت على مكافأتك اليومية بالفعل! عد غداً 😊');
    }
    user.lastDaily = today;
    user.balance += 5000;
    saveData();
    return message.reply(`🎁 تم! حصلت على **5,000 دولار**\n💵 رصيدك: ${user.balance.toLocaleString()} دولار`);
  }

  // === 🏠 نظام العقارات ===
  if (content === 'سوق!') {
    let desc = '';
    PROPERTIES.forEach(p => {
      desc += `${p.emoji} **${p.name}** — ${p.price.toLocaleString()} دولار\n    دخل يومي: ${p.income}/يوم\nاكتب: شراء ${p.name}!\n\n`;
    });
    const embed = new EmbedBuilder()
      .setColor('#0099FF')
      .setTitle('🏢 سوق العقارات')
      .setDescription(desc);
    return message.reply({ embeds: [embed] });
  }
  
  if (content.startsWith('شراء ') && content.endsWith('!')) {
    const name = content.slice(6, -1).trim();
    const prop = PROPERTIES.find(p => p.name === name);
    if (!prop) return message.reply('❌ غير موجود! اكتب: سوق!');
    if (user.balance < prop.price) return message.reply('❌ رصيدك غير كافٍ');
    if (user.properties.find(p => p.id === prop.id)) return message.reply('⚠️ تملكه بالفعل!');
    
    user.balance -= prop.price;
    user.properties.push({ ...prop, purchasedAt: Date.now() });
    saveData();
    return message.reply(`✅ تم الشراء!\n${prop.emoji} **${prop.name}**\n💵 رصيدك: ${user.balance.toLocaleString()} دولار\n💰 دخل يومي: +${prop.income} دولار`);
  }
  
  if (content === 'عقاراتي!') {
    if (user.properties.length === 0) {
      return message.reply('🏠 لا تملك عقارات بعد! اكتب: سوق!');
    }
    let desc = '';
    let totalIncome = 0;
    user.properties.forEach(p => {
      desc += `${p.emoji} **${p.name}** — دخل: ${p.income}/يوم\n`;
      totalIncome += p.income;
    });
    const embed = new EmbedBuilder()
      .setColor('#9933FF')
      .setTitle('🏠 عقاراتك')
      .setDescription(desc)
      .addFields({ name: '💰 الدخل اليومي', value: `${totalIncome} دولار` });
    return message.reply({ embeds: [embed] });
  }
  
  if (content.startsWith('بيع ') && content.endsWith('!')) {
    const name = content.slice(4, -1).trim();
    const idx = user.properties.findIndex(p => p.name === name);
    if (idx === -1) return message.reply('❌ لا تملك هذا العقار');
    
    const prop = user.properties[idx];
    const sellPrice = Math.floor(prop.price * 0.7);
    user.balance += sellPrice;
    user.properties.splice(idx, 1);
    saveData();
    return message.reply(`✅ تم البيع!\n💵 استلمت: ${sellPrice.toLocaleString()} دولار\nرصيدك: ${user.balance.toLocaleString()} دولار`);
  }
  
  if (content === 'قائمة!') {
    const sorted = Object.entries(userData)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 10);
    if (sorted.length === 0) return message.reply('📊 لا بيانات لعرضها');
    
    let desc = '';
    sorted.forEach((u, i) => {
      const m = i === 0 ? '👑' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      desc += `${m} <@${u.id}> — ${u.balance.toLocaleString()} دولار — ${u.properties.length} عقار\n`;
    });
    const embed = new EmbedBuilder()
      .setColor('#FF9900')
      .setTitle('🏆 قائمة الأغنى')
      .setDescription(desc);
    return message.reply({ embeds: [embed] });
  }

  // === 🎮 الألعاب ===
  if (content === 'ألعاب!') {
    const embed = new EmbedBuilder()
      .setColor('#FF6600')
      .setTitle('🎮 قائمة الألعاب')
      .addFields(
        { name: 'روليت المبلغ!', value: 'رهان — تضاعف أو تخسر' },
        { name: 'قرعة المبلغ!', value: 'رأس أم ذيل' },
        { name: 'حظوظ المبلغ!', value: 'حظك قد يضاعفك حتى 10 أضعاف!' },
        { name: 'نرد المبلغ!', value: 'لعبة النرد' },
        { name: 'ورقة المبلغ!', value: 'أقوى ورقة تكسب' },
        { name: 'صناديق!', value: 'افتح صندوقاً عشوائياً' },
        { name: 'سباق!', value: 'شاهد نتيجة السباق' },
        { name: 'مزاد سري!', value: 'مزاد القطع النادرة' }
      );
    return message.reply({ embeds: [embed] });
  }
  
  // روليت
  const rMatch = content.match(/^روليت (\d+)!$/);
  if (rMatch) {
    const amt = parseInt(rMatch[1]);
    if (amt < 100) return message.reply('❌ الحد الأدنى: 100 دولار');
    if (user.balance < amt) return message.reply('❌ رصيدك غير كافٍ');
    user.balance -= amt;
    if (Math.random() > 0.48) {
      user.balance += amt * 2;
      saveData();
      return message.reply(`🎊🎉 فزت! +${(amt*2).toLocaleString()} دولار\n💰 رصيدك: ${user.balance.toLocaleString()} دولار`);
    } else {
      saveData();
      return message.reply(`😢 خسرت ${amt.toLocaleString()} دولار\n💵 رصيدك: ${user.balance.toLocaleString()} دولار`);
    }
  }
  
  // قرعة
  const cMatch = content.match(/^قرعة (\d+)!$/);
  if (cMatch) {
    const amt = parseInt(cMatch[1]);
    if (amt < 50) return message.reply('❌ الحد الأدنى: 50 دولار');
    if (user.balance < amt) return message.reply('❌ رصيدك غير كافٍ');
    user.balance -= amt;
    const side = Math.random() > 0.5 ? 'رأس' : 'ذيل';
    if (Math.random() > 0.5) {
      user.balance += Math.floor(amt * 1.8);
      saveData();
      return message.reply(`🪙 ${side} — فزت! +${Math.floor(amt*1.8).toLocaleString()} دولار`);
    } else {
      saveData();
      return message.reply(`🪙 ${side} — خسرت 😢`);
    }
  }
  
  // حظوظ
  const lMatch = content.match(/^حظوظ (\d+)!$/);
  if (lMatch) {
    const amt = parseInt(lMatch[1]);
    if (amt < 100) return message.reply('❌ الحد الأدنى: 100 دولار');
    if (user.balance < amt) return message.reply('❌ رصيدك غير كافٍ');
    user.balance -= amt;
    const roll = Math.random();
    let m = 0;
    if (roll > 0.95) m = 10;
    else if (roll > 0.85) m = 5;
    else if (roll > 0.65) m = 2;
    else if (roll > 0.45) m = 1;
    
    if (m > 0) {
      user.balance += amt * m;
      saveData();
      return message.reply(`🎰 ×${m}! ربحت ${(amt*m).toLocaleString()} دولار! 🎉`);
    } else {
      saveData();
      return message.reply('🎰 💨 لم يحالفك الحظ');
    }
  }
  
  // نرد
  const dMatch = content.match(/^نرد (\d+)!$/);
  if (dMatch) {
    const amt = parseInt(dMatch[1]);
    if (amt < 100) return message.reply('❌ الحد الأدنى: 100 دولار');
    if (user.balance < amt) return message.reply('❌ رصيدك غير كافٍ');
    user.balance -= amt;
    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    const total = d1 + d2;
    let msg = `🎲 النرد: ${d1} + ${d2} = ${total}\n`;
    let win = 0;
    
    if (d1 === d2) {
      win = amt * 2;
      msg += '🎊 زوج متماثل! ×2';
    } else if (total === 7 || total === 11) {
      win = Math.floor(amt * 1.5);
      msg += '✨ 7 أو 11 — ×1.5';
    } else if (total >= 8 && total <= 10) {
      win = Math.floor(amt * 0.5);
      msg += '📈 استرداد نصف المبلغ';
    } else {
      msg += '😢 خسرت';
    }
    
    if (win > 0) user.balance += amt + win;
    saveData();
    msg += `\n💵 رصيدك: ${user.balance.toLocaleString()} دولار`;
    return message.reply(msg);
  }
  
  // ورقة
  const caMatch = content.match(/^ورقة (\d+)!$/);
  if (caMatch) {
    const amt = parseInt(caMatch[1]);
    if (amt < 100) return message.reply('❌ الحد الأدنى: 100 دولار');
    if (user.balance < amt) return message.reply('❌ رصيدك غير كافٍ');
    
    const vals = [2,3,4,5,6,7,8,9,10,11,12,13,14];
    const p = vals[Math.floor(Math.random()*vals.length)];
    const d = vals[Math.floor(Math.random()*vals.length)];
    let msg = `🃏 أنت: **${p}** — الموزع: **${d}**\n`;
    
    if (p > d) {
      user.balance += amt;
      msg += `🎉 فزت! +${amt.toLocaleString()} دولار`;
    } else if (p < d) {
      user.balance -= amt;
      msg += `😢 خسرت ${amt.toLocaleString()} دولار`;
    } else {
      msg += '⚖️ تعادل — لا تغيير';
    }
    saveData();
    msg += `\n💵 رصيدك: ${user.balance.toLocaleString()} دولار`;
    return message.reply(msg);
  }
  
  // صناديق
  if (content === 'صناديق!') {
    const luck = Math.random();
    if (luck > 0.75) {
      const prize = Math.floor(Math.random() * 8000) + 2000;
      user.balance += prize;
      saveData();
      return message.reply(`✨📦 صندوق ذهب نادر!\n💰 +${prize.toLocaleString()} دولار\nرصيدك: ${user.balance.toLocaleString()} دولار`);
    } else if (luck > 0.4) {
      const prize = Math.floor(Math.random() * 1500) + 300;
      user.balance += prize;
      saveData();
      return message.reply(`📦 وجدت نقود\n💰 +${prize.toLocaleString()} دولار`);
    } else {
      return message.reply('📦 فارغ 😔 حاول لاحقاً');
    }
  }
  
  // سباق
  if (content === 'سباق!') {
    const runners = ['🐇 أرنب', '🐢 سلحفاة', '🐕 كلب', '🐈 قط', '🦊 ثعلب'];
    const res = runners.sort(() => Math.random() - 0.5).slice(0, 3);
    return message.reply(`🏁 النتائج:\n🥇 ${res[0]}\n🥈 ${res[1]}\n🥉 ${res[2]}`);
  }
  
  // مزاد سري
  if (content === 'مزاد سري!') {
    const items = [
      { name: 'قطعة أثرية نادرة', min: 50000, emoji: '🏺' },
      { name: 'سيارة كلاسيكية', min: 150000, emoji: '🚗' },
      { name: 'مجوهرات ملكية', min: 300000, emoji: '💎' },
      { name: 'لوحة فنية أصلية', min: 500000, emoji: '🖼️' }
    ];
    const item = items[Math.floor(Math.random() * items.length)];
    return message.reply(`🌫️ **مزاد سري**\nيوجد شيء غامض...\n💡 يبدأ من **${item.min.toLocaleString()} دولار**`);
  }
});

client.login(process.env.DISCORD_TOKEN);
