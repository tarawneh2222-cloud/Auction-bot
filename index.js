const { Client, GatewayIntentBits, Collection, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const TOKEN = process.env.TOKEN;
const PREFIX = '!';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

client.login(TOKEN).catch(err => console.error('❌ خطأ في تسجيل الدخول:', err));

// ==============================================
// 💾 قاعدة البيانات
// ==============================================
const fs = require('fs');
const path = require('path');
const DATA_FILE = path.join(__dirname, 'data.json');

let users = new Map();

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      users = new Map(Object.entries(data));
    }
  } catch (e) {
    console.log('⚠️ لم يتم العثور على ملف بيانات جديد، سيتم إنشاؤه تلقائياً');
  }
}

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(Object.fromEntries(users), null, 2));
}

loadData();

// ==============================================
// 📊 بيانات اللعبة
// ==============================================
const shops = {
  عقارات: [
    { id: 'house1', name: '🏠 منزل صغير', price: 1000, desc: 'يعطيك 50 💵 يومياً', income: 50 },
    { id: 'house2', name: '🏡 منزل عائلي', price: 5000, desc: 'يعطيك 300 💵 يومياً', income: 300 },
    { id: 'building', name: '🏢 مبنى سكني', price: 20000, desc: 'يعطيك 1500 💵 يومياً', income: 1500 },
    { id: 'tower', name: '🗼 برج تجاري', price: 100000, desc: 'يعطيك 10000 💵 يومياً', income: 10000 }
  ],
  أعمال: [
    { id: 'shop', name: '🏪 محل تجاري', price: 3000, desc: 'يعطيك 150 💵 يومياً', income: 150 },
    { id: 'restaurant', name: '🍽️ مطعم', price: 15000, desc: 'يعطيك 800 💵 يومياً', income: 800 },
    { id: 'factory', name: '🏭 مصنع', price: 80000, desc: 'يعطيك 5000 💵 يومياً', income: 5000 }
  ],
  استثمارات: [
    { id: 'gold', name: '🪙 ذهب', price: 2000, desc: 'قد يرتفع سعره أو ينخفض أسبوعياً', volatile: true },
    { id: 'stocks', name: '📈 أسهم شركة', price: 5000, desc: 'عائد أسبوعي متغير', volatile: true },
    { id: 'land', name: '🌍 أرض', price: 10000, desc: 'تزداد قيمتها بمرور الوقت', income: 200 }
  ]
};

const dailyRewards = new Map();
const weeklyRankings = new Map();

// ==============================================
// 💬 معالج الأوامر الأساسية
// ==============================================
client.on('messageCreate', async message => {
  if (!message.content.startsWith(PREFIX) || message.author.bot) return;
  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();
  const userId = message.author.id;

  // � بداية اللعبة
  if (cmd === 'بداية') {
    if (users.has(userId)) return message.reply('✅ لديك حساب بالفعل! اكتب `!رصيد` لمعرفة رصيدك');
    users.set(userId, {
      balance: 1000,
      level: 1,
      exp: 0,
      investments: [],
      createdAt: Date.now(),
      lastDaily: 0
    });
    saveData();
    message.reply(`
🎉 أهلاً بك في لعبة إمبراطورية الثروة!

💰 رصيدك الأولي: **1000 💵**

📋 الأوامر الأساسية:
!رصيد — معرفة رصيدك
!يومي — جمع مكافأتك اليومية
!متجر — شراء العقارات والأعمال
!استثمارات — استثماراتك الحالية
!أوامر — عرض جميع الأوامر
    `);
  }

  // 💰 عرض الرصيد
  if (cmd === 'رصيد') {
    if (!users.has(userId)) return message.reply('⚠️ اكتب `!بداية` أولاً لإنشاء حسابك!');
    const u = users.get(userId);
    const totalAssets = u.balance + u.investments.reduce((sum, i) => sum + (i.price || 0), 0);
    message.reply(`
💳 **معلومات حسابك:**
💰 الرصيد النقدي: ${u.balance} 💵
📊 إجمالي الثروة: ${totalAssets} 💵
⭐ المستوى: ${u.level}
📅 تاريخ التسجيل: ${new Date(u.createdAt).toLocaleDateString('ar-SA')}
    `);
  }

  // 📅 المكافأة اليومية
  if (cmd === 'يومي') {
    if (!users.has(userId)) return message.reply('⚠️ اكتب `!بداية` أولاً!');
    const now = Date.now();
    const u = users.get(userId);
    if (now - u.lastDaily < 86400000) {
      const hoursLeft = Math.ceil((86400000 - (now - u.lastDaily)) / 3600000);
      return message.reply(`⏳ عُد بعد ${hoursLeft} ساعة لجمع مكافأتك اليومية!`);
    }
    u.lastDaily = now;
    u.balance += 200;
    saveData();
    message.reply(`✅ تم جمع مكافأتك اليومية: +200 💵\n💰 رصيدك الحالي: ${u.balance} 💵`);
  }

  // 🏪 المتجر
  if (cmd === 'متجر') {
    if (!users.has(userId)) return message.reply('⚠️ اكتب `!بداية` أولاً!');
    let text = '🏪 **المتجر — ما الذي تريد شراءه؟**\n\n';
    for (const [cat, items] of Object.entries(shops)) {
      text += `━━ 📂 ${cat} ━━\n`;
      items.forEach(item => {
        text += `${item.name} — ${item.price} 💵\n📝 ${item.desc}\nاكتب: !شراء ${item.id}\n\n`;
      });
    }
    text += '💡 نصيحة: استثمر أموالك لتنميتها!';
    message.reply(text);
  }

  // 🛒 الشراء
  if (cmd === 'شراء') {
    if (!users.has(userId)) return message.reply('⚠️ اكتب `!بداية` أولاً!');
    const itemId = args[0];
    let found = null;
    for (const items of Object.values(shops)) {
      found = items.find(i => i.id === itemId);
      if (found) break;
    }
    if (!found) return message.reply('❌ هذا العنصر غير موجود! اكتب `!متجر` لترى القائمة');
    const u = users.get(userId);
    if (u.balance < found.price) return message.reply('❌ رصيدك غير كافٍ!');
    u.balance -= found.price;
    u.investments.push({ ...found, purchasedAt: Date.now() });
    saveData();
    message.reply(`
✅ **تم الشراء بنجاح!**
${found.name}
💰 السعر: ${found.price} 💵
💳 رصيدك المتبقي: ${u.balance} 💵
📝 ${found.desc}
    `);
  }

  // 📦 استثماراتي
  if (cmd === 'استثماراتي') {
    if (!users.has(userId)) return message.reply('⚠️ اكتب `!بداية` أولاً!');
    const u = users.get(userId);
    if (u.investments.length === 0) return message.reply('📦 لا تمتلك أي استثمارات حتى الآن! اكتب `!متجر` لتبدأ');
    let text = '📦 **استثماراتك الحالية:**\n\n';
    u.investments.forEach((inv, idx) => {
      text += `${idx + 1}. ${inv.name}\n📝 ${inv.desc}\n\n`;
    });
    message.reply(text);
  }

  // 🏆 التصنيف الأسبوعي
  if (cmd === 'تصنيف') {
    const list = Array.from(users.entries())
      .map(([id, u]) => ({ id, name: client.users.cache.get(id)?.username || 'مستخدم', balance: u.balance }))
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 10);
    
    if (list.length === 0) return message.reply('📋 لا يوجد لاعبون مسجلون حتى الآن!');
    
    let text = '🏆 **أغنى 10 لاعبين**\n\n';
    list.forEach((p, i) => {
      let badge = '';
      if (i === 0) badge = '👑 ';
      else if (i === 1) badge = '🥈 ';
      else if (i === 2) badge = '🥉 ';
      text += `${badge}${i + 1}. ${p.name} — ${p.balance} 💵\n`;
    });
    message.reply(text);
  }

  // 📖 جميع الأوامر
  if (cmd === 'أوامر') {
    message.reply(`
📖 **قائمة جميع الأوامر:**

🔹 **الأساسيات:**
!بداية — إنشاء حساب جديد
!رصيد — عرض رصيدك ومعلوماتك
!يومي — جمع مكافأتك اليومية
!تصنيف — عرض أغنى اللاعبين

🔹 **الشراء والاستثمار:**
!متجر — عرض المتجر والسلع المتاحة
!شراء [المعرف] — شراء سلعة من المتجر
!استثماراتي — عرض ما تمتلكه

🔹 **الألعاب التفاعلية:**
!روليت [المبلغ] — راهن واضاعف مالك
!صناديق — افتح صندوق الكنز كل ساعة
!حظ — تعرف على حظك اليومي
!سباق — ابدأ سباق سيارات جماعي
!تحدي @الشخص — تحدي لاعب آخر
!كنز — ابحث عن الكنز المخفي
!سعر — خمن سعر السلعة واربح
    `);
  }

  // 🎰 روليت
  if (cmd === 'روليت') {
    if (!users.has(userId)) return message.reply('⚠️ اكتب `!بداية` أولاً');
    const amount = parseInt(args[0]);
    const u = users.get(userId);
    if (!amount || amount <= 0) return message.reply('❌ استخدم: !روليت 500');
    if (u.balance < amount) return message.reply('❌ رصيدك غير كافٍ!');
    
    const win = Math.random() >= 0.5;
    if (win) {
      u.balance += amount;
      message.reply(`🎰 الروليت تدور...\n🟢 فزت! مبروك 🎉\n💰 ربحت: +${amount} 💵\n💳 رصيدك: ${u.balance} 💵`);
    } else {
      u.balance -= amount;
      message.reply(`🎰 الروليت تدور...\n🔴 خسرت 😔\n💰 خسرت: -${amount} 💵\n💳 رصيدك: ${u.balance} 💵`);
    }
    saveData();
  }

  // 📦 صناديق الكنز
  if (cmd === 'صناديق') {
    if (!users.has(userId)) return message.reply('⚠️ اكتب `!بداية` أولاً');
    const u = users.get(userId);
    const prizes = [
      { text: '💎 جوهرة نادرة!', value: 5000 },
      { text: '💰 كيس ذهب', value: 1500 },
      { text: '🪙 عملات قديمة', value: 300 },
      { text: '📝 صندوق فارغ', value: 0 },
      { text: '💵 حقيبة نقود', value: 800 }
    ];
    const prize = prizes[Math.floor(Math.random() * prizes.length)];
    u.balance += prize.value;
    let msg = `📦 فتحت الصندوق ووجدت:\n\n${prize.text}`;
    msg += prize.value > 0 ? `\n\n✅ ربح: +${prize.value} 💵` : '\n\n😔 لا بأس، حظاً أوفر!';
    msg += `\n💳 رصيدك: ${u.balance} 💵`;
    message.reply(msg);
    saveData();
  }

  // 🔮 حظ
  if (cmd === 'حظ') {
    if (!users.has(userId)) return message.reply('⚠️ اكتب `!بداية` أولاً');
    const u = users.get(userId);
    const luck = Math.random();
    let result = '';
    if (luck > 0.95) {
      u.balance += 3000;
      result = '🌟 حظك ممتاز جداً اليوم!\n💰 هدية الحظ: +3000 💵';
    } else if (luck > 0.7) {
      u.balance += 500;
      result = '✨ يوم جيد ومبشر!\n💰 هدية الحظ: +500 💵';
    } else if (luck > 0.3) {
      result = '😌 يوم عادي، استمر في عملك!';
    } else {
      const loss = Math.min(u.balance, 50);
      u.balance -= loss;
      result = `😅 حظ عاثر قليلاً...\n💰 خسارة بسيطة: -${loss} 💵`;
    }
    message.reply(`🔮 قرأت لك حجر الحظ:\n\n${result}\n💳 رصيدك: ${u.balance} 💵`);
    saveData();
  }
});

// ==============================================
// 🌍 خادم Render — لا تحذف هذا
// ==============================================
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('✅ بوت إمبراطورية الثروة يعمل بنجاح!');
});

app.listen(PORT, () => {
  console.log(`🌍 الخادم يعمل على المنفذ ${PORT}`);
});

// ==============================================
// 📅 توزيع أرباح العقارات يومياً
// ==============================================
setInterval(() => {
  let totalPaid = 0;
  for (const [id, u] of users) {
    let income = 0;
    u.investments.forEach(inv => {
      if (inv.income) income += inv.income;
    });
    if (income > 0) {
      u.balance += income;
      totalPaid += income;
    }
  }
  if (totalPaid > 0) {
    saveData();
    console.log(`💰 تم توزيع أرباح العقارات: ${totalPaid} 💵`);
  }
}, 86400000);

console.log('✅ البوت جاهز ويعمل بنجاح!');
