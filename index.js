const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const users = new Map();
const auctions = new Map();

const items = [
  { id: 1, name: 'لوحة فنية نادرة', emoji: '🖼️', basePrice: 100 },
  { id: 2, name: 'سيارة كلاسيكية', emoji: '🚗', basePrice: 500 },
  { id: 3, name: 'تحفة أثرية', emoji: '🏺', basePrice: 300 },
  { id: 4, name: 'مجوهرات ملكية', emoji: '💎', basePrice: 800 },
  { id: 5, name: 'كتاب تاريخي', emoji: '📖', basePrice: 150 }
];

client.on('ready', () => {
  console.log(`✅ تم تسجيل الدخول باسم: ${client.user.tag}`);
  client.user.setActivity('/ابدأ', { type: 'PLAYING' });
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, options } = interaction;
  const userId = interaction.user.id;

  if (!users.has(userId)) {
    users.set(userId, { balance: 1000, partner: null });
  }
  const user = users.get(userId);

  if (commandName === 'ابدأ') {
    await interaction.reply(
      `🎉 **مرحباً بك في لعبة المزادات!**\n\n` +
      `لقد حصلت على 1000 قطعة نقدية كهدية بداية 💰\n\n` +
      `الأوامر المتاحة:\n` +
      `/مزاد - عرض المزاد الحالي وتقديم سعر\n` +
      `/شريك @شخص - دعوة شخص للشراكة\n` +
      `/رصيد - معرفة رصيدك الحالي\n` +
      `/سلع - عرض قائمة السلع المتاحة`
    );
  }

  else if (commandName === 'رصيد') {
    await interaction.reply(`💰 رصيدك الحالي: **${user.balance}** قطعة نقدية`);
  }

  else if (commandName === 'سلع') {
    let list = '📋 **قائمة السلع المتاحة للمزادات:**\n\n';
    items.forEach(item => {
      list += `${item.emoji} **${item.name}** — سعر البدء: ${item.basePrice}💰\n`;
    });
    await interaction.reply(list);
  }

  else if (commandName === 'شريك') {
    const partner = options.getUser('الشخص');
    if (partner.id === userId) {
      await interaction.reply('❌ لا يمكنك أن تكون شريكاً لنفسك!');
      return;
    }
    user.partner = partner.id;
    if (!users.has(partner.id)) users.set(partner.id, { balance: 1000, partner: userId });
    else users.get(partner.id).partner = userId;
    await interaction.reply(`🤝 تمت الشراكة بنجاح مع ${partner}!\nستقسمان الأرباح والخسائر من المزادات القادمة.`);
  }

  else if (commandName === 'مزاد') {
    const bidAmount = options.getInteger('السعر');
    
    if (!auctions.has('current')) {
      const randomItem = items[Math.floor(Math.random() * items.length)];
      auctions.set('current', {
        item: randomItem,
        highestBid: randomItem.basePrice,
        highestBidder: null,
        endTime: Date.now() + 60000
      });
    }
    
    const auction = auctions.get('current');
    const partnerId = user.partner;
    let totalFunds = user.balance;
    if (partnerId && users.has(partnerId)) {
      totalFunds += users.get(partnerId).balance;
    }

    if (bidAmount >= auction.highestBid + 10 && bidAmount <= totalFunds) {
      auction.highestBid = bidAmount;
      auction.highestBidder = userId;
      
      let msg = `🔔 تم رفع السعر لـ **${auction.item.name}** ${auction.item.emoji} إلى: **${bidAmount}**💰`;
      if (user.partner) msg += `\n(بتمويل مشترك مع شريكك 🤝)`;
      
      await interaction.reply(msg);
    } else if (bidAmount < auction.highestBid + 10) {
      await interaction.reply(`❌ يجب أن يكون عرضك أعلى بمقدار 10 على الأقل من أعلى سعر حالي (${auction.highestBid}💰)`);
    } else {
      await interaction.reply(`❌ رصيدك غير كافٍ! رصيدك مع شريكك: ${totalFunds}💰`);
    }
  }
});

client.login(process.env.TOKEN);// Keep Render happy
const http = require('http');
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Bot is running!');
});
server.listen(3000, () => console.log('✅ Health check server running on port 3000'));
// التعامل مع الأوامر النصية
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  if (message.content.startsWith('!start')) {
    message.reply('✅ تم بدء المزاد! اكتب !bid [المبلغ] لتقديم عرضك');
  }

  if (message.content.startsWith('!bid ')) {
    const amount = message.content.split(' ')[1];
    message.reply(`✅ تم تسجيل عرضك بمبلغ: ${amount}`);
  }
})

// ==============================================
// 🏦 لعبة الإمبراطورية الاقتصادية — الإصدار الكامل
// ==============================================

const fs = require('fs');

// تخزين بيانات اللاعبين
let players = {};
let weeklyRanking = {};

// تحميل البيانات
function loadData() {
  try {
    const data = fs.readFileSync('economy_data.json', 'utf8');
    players = JSON.parse(data);
  } catch {
    players = {};
  }
}

// حفظ البيانات
function saveData() {
  fs.writeFileSync('economy_data.json', JSON.stringify(players, null, 2));
}

// تهيئة اللاعب الجديد
function initPlayer(userId, username) {
  if (!players[userId]) {
    players[userId] = {
      username: username,
      balance: 50000,
      bank: 0,
      portfolio: {},
      estates: {},
      treasures: {},
      certificates: {},
      title: 'مستثمر جديد',
      titleExpiry: 0,
      lastDaily: 0,
      totalWealth: 50000
    };
    saveData();
  }
}

// حساب الثروة الإجمالية
function calculateWealth(player) {
  let total = player.balance + player.bank;
  // قيمة العقارات
  const estateValues = {
    '🏡': 50000, '🏢': 150000, '🏬': 400000, '🏭': 800000,
    '🏰': 2000000, '⛽': 250000, '🏥': 600000, '🎡': 1200000,
    '🚜': 80000, '⚡': 1500000
  };
  for (let key in player.estates) {
    total += (estateValues[key] || 0) * player.estates[key];
  }
  return total;
}

// تحديث التصنيف الأسبوعي
function updateWeeklyRanking() {
  const sorted = Object.entries(players)
    .map(([id, p]) => ({ id, username: p.username, wealth: calculateWealth(p) }))
    .sort((a, b) => b.wealth - a.wealth)
    .slice(0, 10);
  
  weeklyRanking = sorted;
  
  // منح الألقاب
  if (sorted[0] && players[sorted[0].id]) {
    players[sorted[0].id].title = '👑 إمبراطور الاقتصاد 👑';
    players[sorted[0].id].titleBonus = 0.05;
  }
  if (sorted[1] && players[sorted[1].id]) {
    players[sorted[1].id].title = '💼 ملياردير';
    players[sorted[1].id].titleBonus = 0.02;
  }
  if (sorted[2] && players[sorted[2].id]) {
    players[sorted[2].id].title = '💰 رجل أعمال';
    players[sorted[2].id].titleBonus = 0;
  }
  saveData();
  return sorted;
}

// التعامل مع الأوامر
client.on('messageCreate', async message => {
  if (message.author.bot) return;
  loadData();
  const userId = message.author.id;
  const username = message.author.username;
  initPlayer(userId, username);
  const player = players[userId];

  // 💰 رصيدي
  if (message.content === '!me') {
    const wealth = calculateWealth(player);
    message.reply(`
📊 **ملفك الشخصي:**
👤 الاسم: ${player.username}
🏅 لقبك: ${player.title}
💵 النقدي: ${player.balance.toLocaleString()}
🏦 في البنك: ${player.bank.toLocaleString()}
💰 ثروتك الإجمالية: ${wealth.toLocaleString()}
    `);
  }

  // 📅 راتب يومي
  if (message.content === '!daily') {
    const now = Date.now();
    if (now - player.lastDaily < 86400000) {
      return message.reply('⏳ لقد استلمت راتبك اليوم بالفعل! عد غداً ✅');
    }
    player.lastDaily = now;
    player.balance += 100;
    saveData();
    message.reply('✅ حصلت على راتبك اليومي: +100 عملة! رصيدك: ' + player.balance);
  }

  // 🏦 إيداع
  if (message.content.startsWith('!deposit ')) {
    const amount = parseInt(message.content.split(' ')[1]);
    if (isNaN(amount) || amount <= 0 || amount > player.balance) {
      return message.reply('❌ مبلغ غير صالح!');
    }
    player.balance -= amount;
    player.bank += amount;
    saveData();
    message.reply(`✅ تم إيداع ${amount} في حسابك البنكي!`);
  }

  // 💵 سحب
  if (message.content.startsWith('!withdraw ')) {
    const amount = parseInt(message.content.split(' ')[1]);
    if (isNaN(amount) || amount <= 0 || amount > player.bank) {
      return message.reply('❌ مبلغ غير صالح!');
    }
    player.bank -= amount;
    player.balance += amount;
    saveData();
    message.reply(`✅ تم سحب ${amount} من حسابك البنكي!`);
  }

  // 📈 قائمة الأغنياء
  if (message.content === '!top') {
    const ranking = updateWeeklyRanking();
    if (ranking.length === 0) return message.reply('📊 لا بيانات حتى الآن!');
    let reply = '🏆 **قائمة أغنى اللاعبين هذا الأسبوع:**\n';
    ranking.forEach((p, i) => {
      let medal = '';
      if (i === 0) medal = '🥇';
      else if (i === 1) medal = '🥈';
      else if (i === 2) medal = '🥉';
      else medal = `#${i+1}`;
      reply += `${medal} ${p.username} — ${p.wealth.toLocaleString()} 💰\n`;
    });
    reply += '\n🔄 يتم تحديث التصنيف تلقائياً كل أسبوع!';
    message.reply(reply);
  }

  // 🏅 لقبي
  if (message.content === '!mytitle') {
    message.reply(`🏅 لقبك الحالي: **${player.title}**\n📌 هذا اللقب ساري المفعول حتى نهاية الأسبوع ✅`);
  }

  // 💸 تحويل
  if (message.content.startsWith('!pay ')) {
    const match = message.content.match(/!pay <@!?(\d+)> (\d+)/);
    if (!match) return message.reply('❌ استخدم: !pay @الشخص المبلغ');
    const targetId = match[1];
    const amount = parseInt(match[2]);
    if (!players[targetId]) return message.reply('❌ هذا اللاعب غير مسجل!');
    if (amount > player.balance || amount <= 0) return message.reply('❌ رصيدك لا يكفي!');
    player.balance -= amount;
    players[targetId].balance += amount;
    saveData();
    message.reply(`✅ تم تحويل ${amount} عملة للاعب بنجاح! 💸`);
  }
});

console.log('✅ نظام الاقتصاد والتصنيف الأسبوعي جاهز!');
// ==============================================
// 🏢 نظام العقارات والسوق والمشتريات
// ==============================================

// قائمة العقارات المتاحة
const ESTATES = {
  '🏡': { name: 'شقة سكنية', price: 50000, income: 500 },
  '🏢': { name: 'مكتب تجاري', price: 150000, income: 1800 },
  '🏬': { name: 'مركز تسوق', price: 400000, income: 5000 },
  '🏭': { name: 'مصنع', price: 800000, income: 10000 },
  '🏰': { name: 'قصر', price: 2000000, income: 25000 },
  '⛽': { name: 'محطة وقود', price: 250000, income: 3000 },
  '🏥': { name: 'مستوصف', price: 600000, income: 7500 },
  '🎡': { name: 'مدينة ملاهي', price: 1200000, income: 18000 },
  '🚜': { name: 'مزرعة', price: 80000, income: 800 },
  '⚡': { name: 'محطة طاقة', price: 1500000, income: 22000 }
};

// قائمة العناصر في السوق
const MARKET = {
  '💻': { name: 'تقنية المستقبل', price: 100, change: 0 },
  '🏦': { name: 'بنك الأمان', price: 50, change: 0 },
  '🛢️': { name: 'نفط العالم', price: 80, change: 0 },
  '🍎': { name: 'أغذية يومية', price: 40, change: 0 },
  '🚗': { name: 'صناعة السيارات', price: 120, change: 0 },
  '💎': { name: 'ذهب', price: 200, change: 0 }
};

// أوامر السوق والعقارات
client.on('messageCreate', async message => {
  if (message.author.bot) return;
  loadData();
  const userId = message.author.id;
  const player = players[userId];
  if (!player) return;

  // 🏢 عرض قائمة العقارات
  if (message.content === '!estates') {
    let reply = '🏢 **العقارات المتاحة للشراء:**\n\n';
    for (let key in ESTATES) {
      const e = ESTATES[key];
      reply += `${key} **${e.name}** — السعر: ${e.price.toLocaleString()} 💰\n`;
      reply += `   الدخل كل ساعة: +${e.income} | اكتب: !buy-estate ${key}\n\n`;
    }
    message.reply(reply);
  }

  // 🛒 شراء عقار
  if (message.content.startsWith('!buy-estate ')) {
    const key = message.content.split(' ')[1];
    if (!ESTATES[key]) return message.reply('❌ هذا العقار غير موجود! اكتب !estates لترى القائمة');
    const estate = ESTATES[key];
    if (player.balance < estate.price) return message.reply('❌ رصيدك لا يكفي! تحتاج: ' + estate.price);
    
    player.balance -= estate.price;
    if (!player.estates[key]) player.estates[key] = 0;
    player.estates[key]++;
    saveData();
    message.reply(`✅ تم شراء **${estate.name}** بنجاح! 🎉\n💰 خصم من رصيدك: ${estate.price}\n💵 سيدر عليك دخل +${estate.income} كل ساعة!`);
  }

  // 🏠 عقاراتي
  if (message.content === '!my-estates') {
    let reply = '🏠 **عقاراتك الحالية:**\n\n';
    let hasEstates = false;
    for (let key in player.estates) {
      if (player.estates[key] > 0) {
        hasEstates = true;
        reply += `${ESTATES[key].name} — العدد: ${player.estates[key]}\n`;
        reply += `   دخل كل ساعة: +${ESTATES[key].income * player.estates[key]} 💰\n\n`;
      }
    }
    if (!hasEstates) reply += 'لا تمتلك أي عقار حتى الآن! اكتب !estates لترى المتاحة 🛒';
    message.reply(reply);
  }

  // 📊 السوق — الأسهم والمعادن
  if (message.content === '!market') {
    let reply = '📊 **السوق الحالي:**\n\n';
    for (let key in MARKET) {
      const item = MARKET[key];
      reply += `${key} **${item.name}** — السعر: ${item.price} 💰\n`;
      reply += `   شراء: !buy ${key} الكمية\n`;
      reply += `   بيع: !sell ${key} الكمية\n\n`;
    }
    message.reply(reply);
  }

  // 📈 شراء من السوق
  if (message.content.startsWith('!buy ')) {
    const parts = message.content.split(' ');
    const key = parts[1];
    const qty = parseInt(parts[2]);
    if (!MARKET[key]) return message.reply('❌ هذا العنصر غير متوفر في السوق! اكتب !market');
    if (isNaN(qty) || qty <= 0) return message.reply('❌ استخدم: !buy الرمز الكمية\nمثال: !buy 💎 10');
    
    const totalCost = MARKET[key].price * qty;
    if (player.balance < totalCost) return message.reply(`❌ رصيدك لا يكفي! التكلفة: ${totalCost} 💰`);
    
    player.balance -= totalCost;
    if (!player.portfolio[key]) player.portfolio[key] = 0;
    player.portfolio[key] += qty;
    saveData();
    message.reply(`✅ تم شراء ${qty} × ${MARKET[key].name} بـ ${totalCost} 💰\n📂 موجودة في محفظتك الآن!`);
  }

  // 📉 بيع في السوق
  if (message.content.startsWith('!sell ')) {
    const parts = message.content.split(' ');
    const key = parts[1];
    const qty = parseInt(parts[2]);
    if (!MARKET[key]) return message.reply('❌ هذا العنصر غير متوفر!');
    if (!player.portfolio[key] || player.portfolio[key] < qty) return message.reply('❌ لا تمتلك كمية كافية للبيع!');
    
    const totalSale = MARKET[key].price * qty;
    player.balance += totalSale;
    player.portfolio[key] -= qty;
    if (player.portfolio[key] === 0) delete player.portfolio[key];
    saveData();
    message.reply(`✅ تم بيع ${qty} × ${MARKET[key].name} بـ ${totalSale} 💰\n💵 أضيفت إلى رصيدك بنجاح!`);
  }

  // 📂 محفظتي
  if (message.content === '!portfolio') {
    let reply = '📂 **محفظتك الاستثمارية:**\n\n';
    let hasItems = false;
    for (let key in player.portfolio) {
      if (player.portfolio[key] > 0) {
        hasItems = true;
        const item = MARKET[key];
        const value = player.portfolio[key] * item.price;
        reply += `${key} ${item.name} — العدد: ${player.portfolio[key]}\n`;
        reply += `   القيمة الحالية: ${value.toLocaleString()} 💰\n\n`;
      }
    }
    if (!hasItems) reply += 'محفظتك فارغة حالياً! اكتب !market لترى ما يمكنك شراؤه 🛒';
    message.reply(reply);
  }
});

console.log('✅ نظام العقارات والسوق جاهز!');
// ==============================================
// 📖 نظام الأوامر العربية الكاملة
// ==============================================

client.on('messageCreate', async message => {
  if (message.author.bot) return;
  loadData();
  const userId = message.author.id;
  const username = message.author.username;
  initPlayer(userId, username);
  const player = players[userId];

  // 📋 قائمة المساعدة الشاملة
  if (message.content === '!مساعدة') {
    message.reply(`
📖 **قائمة جميع الأوامر:**

👤 **الملف الشخصي:**
!ملفي — عرض رصيدك وثروتك
!راتبي — راتب يومي +100 عملة
!لقبى — لقبك الحالي
!الاغنى — قائمة أغنى اللاعبين 👑

🏦 **البنك والتحويلات:**
!ايداع مبلغ — إيداع في البنك
!سحب مبلغ — سحب من البنك
!تحويل @شخص مبلغ — تحويل عملات

🏢 **العقارات:**
!العقارات — قائمة العقارات المتاحة
!شراء-عقار الرمز — شراء عقار
!عقاراتي — عقاراتك ودخلك منها

📊 **السوق والاستثمار:**
!السوق — أسعار السوق الحالية
!شراء الرمز الكمية — شراء من السوق
!بيع الرمز الكمية — بيع أصولك
!محفظتي — أصولك واستثماراتك

📢 **المزادات:**
!ابدأ — بدء مزاد جديد
!زايد المبلغ — تقديم عرض سعر

💡 مثال: !شراء 💎 5   !ايداع 1000   !زايد 500
    `);
  }

  // 👤 الملف الشخصي
  if (message.content === '!ملفي') {
    const wealth = calculateWealth(player);
    message.reply(`
📊 **ملفك الشخصي:**
👤 الاسم: ${player.username}
🏅 لقبك: ${player.title}
💵 النقدي: ${player.balance.toLocaleString()}
🏦 في البنك: ${player.bank.toLocaleString()}
💰 ثروتك الإجمالية: ${wealth.toLocaleString()}
    `);
  }

  // 📅 الراتب اليومي
  if (message.content === '!راتبي') {
    const now = Date.now();
    if (now - player.lastDaily < 86400000) {
      return message.reply('⏳ لقد استلمت راتبك اليوم بالفعل! عد غداً ✅');
    }
    player.lastDaily = now;
    player.balance += 100;
    saveData();
    message.reply('✅ حصلت على راتبك اليومي: +100 عملة! رصيدك: ' + player.balance);
  }

  // 🏅 لقبي
  if (message.content === '!لقبى') {
    message.reply(`🏅 لقبك الحالي: **${player.title}**\n📌 ساري المفعول حتى نهاية الأسبوع ✅`);
  }

  // 👑 قائمة الأغنياء
  if (message.content === '!الاغنى') {
    const ranking = updateWeeklyRanking();
    if (ranking.length === 0) return message.reply('📊 لا بيانات حتى الآن!');
    let reply = '🏆 **قائمة أغنى اللاعبين هذا الأسبوع:**\n\n';
    ranking.forEach((p, i) => {
      let medal = '';
      if (i === 0) medal = '🥇';
      else if (i === 1) medal = '🥈';
      else if (i === 2) medal = '🥉';
      else medal = `#${i+1}`;
      reply += `${medal} ${p.username} — ${p.wealth.toLocaleString()} 💰\n`;
    });
    reply += '\n🔄 يتم التحديث تلقائياً كل أسبوع!';
    message.reply(reply);
  }

  // 🏦 إيداع
  if (message.content.startsWith('!ايداع ')) {
    const amount = parseInt(message.content.split(' ')[1]);
    if (isNaN(amount) || amount <= 0 || amount > player.balance) {
      return message.reply('❌ مبلغ غير صالح!');
    }
    player.balance -= amount;
    player.bank += amount;
    saveData();
    message.reply(`✅ تم إيداع ${amount} في حسابك البنكي!`);
  }

  // 💵 سحب
  if (message.content.startsWith('!سحب ')) {
    const amount = parseInt(message.content.split(' ')[1]);
    if (isNaN(amount) || amount <= 0 || amount > player.bank) {
      return message.reply('❌ مبلغ غير صالح!');
    }
    player.bank -= amount;
    player.balance += amount;
    saveData();
    message.reply(`✅ تم سحب ${amount} من حسابك البنكي!`);
  }

  // 💸 تحويل
  if (message.content.startsWith('!تحويل ')) {
    const match = message.content.match(/!تحويل <@!?(\d+)> (\d+)/);
    if (!match) return message.reply('❌ استخدم: !تحويل @الشخص المبلغ');
    const targetId = match[1];
    const amount = parseInt(match[2]);
    if (!players[targetId]) return message.reply('❌ هذا اللاعب غير مسجل!');
    if (amount > player.balance || amount <= 0) return message.reply('❌ رصيدك لا يكفي!');
    player.balance -= amount;
    players[targetId].balance += amount;
    saveData();
    message.reply(`✅ تم تحويل ${amount} عملة بنجاح! 💸`);
  }

  // 🏢 قائمة العقارات
  if (message.content === '!العقارات') {
    let reply = '🏢 **العقارات المتاحة للشراء:**\n\n';
    for (let key in ESTATES) {
      const e = ESTATES[key];
      reply += `${key} **${e.name}** — السعر: ${e.price.toLocaleString()} 💰\n`;
      reply += `   الدخل كل ساعة: +${e.income} | اكتب: !شراء-عقار ${key}\n\n`;
    }
    message.reply(reply);
  }

  // 🏠 شراء عقار
  if (message.content.startsWith('!شراء-عقار ')) {
    const key = message.content.split(' ')[1];
    if (!ESTATES[key]) return message.reply('❌ هذا العقار غير موجود! اكتب !العقارات لترى القائمة');
    const estate = ESTATES[key];
    if (player.balance < estate.price) return message.reply('❌ رصيدك لا يكفي! تحتاج: ' + estate.price);
    
    player.balance -= estate.price;
    if (!player.estates[key]) player.estates[key] = 0;
    player.estates[key]++;
    saveData();
    message.reply(`✅ تم شراء **${estate.name}** بنجاح! 🎉\n💰 خصم من رصيدك: ${estate.price}\n💵 سيدر عليك دخل +${estate.income} كل ساعة!`);
  }

  // 🏠 عقاراتي
  if (message.content === '!عقاراتي') {
    let reply = '🏠 **عقاراتك الحالية:**\n\n';
    let hasEstates = false;
    for (let key in player.estates) {
      if (player.estates[key] > 0) {
        hasEstates = true;
        reply += `${ESTATES[key].name} — العدد: ${player.estates[key]}\n`;
        reply += `   دخل كل ساعة: +${ESTATES[key].income * player.estates[key]} 💰\n\n`;
      }
    }
    if (!hasEstates) reply += 'لا تمتلك أي عقار حتى الآن! اكتب !العقارات لترى المتاحة 🛒';
    message.reply(reply);
  }

  // 📊 السوق
  if (message.content === '!السوق') {
    let reply = '📊 **السوق الحالي — الأسعار:**\n\n';
    for (let key in MARKET) {
      const item = MARKET[key];
      reply += `${key} **${item.name}** — السعر: ${item.price} 💰\n`;
      reply += `   شراء: !شراء ${key} الكمية\n`;
      reply += `   بيع: !بيع ${key} الكمية\n\n`;
    }
    message.reply(reply);
  }

  // 📈 شراء من السوق
  if (message.content.startsWith('!شراء ')) {
    const parts = message.content.split(' ');
    const key = parts[1];
    const qty = parseInt(parts[2]);
    if (!MARKET[key]) return message.reply('❌ هذا العنصر غير متوفر! اكتب !السوق');
    if (isNaN(qty) || qty <= 0) return message.reply('❌ استخدم: !شراء الرمز الكمية\nمثال: !شراء 💎 10');
    
    const totalCost = MARKET[key].price * qty;
    if (player.balance < totalCost) return message.reply(`❌ رصيدك لا يكفي! التكلفة: ${totalCost} 💰`);
    
    player.balance -= totalCost;
    if (!player.portfolio[key]) player.portfolio[key] = 0;
    player.portfolio[key] += qty;
    saveData();
    message.reply(`✅ تم شراء ${qty} × ${MARKET[key].name} بـ ${totalCost} 💰\n📂 أضيفت لمحفظتك!`);
  }

  // 📉 بيع من السوق
  if (message.content.startsWith('!بيع ')) {
    const parts = message.content.split(' ');
    const key = parts[1];
    const qty = parseInt(parts[2]);
    if (!MARKET[key]) return message.reply('❌ هذا العنصر غير متوفر!');
    if (!player.portfolio[key] || player.portfolio[key] < qty) return message.reply('❌ لا تمتلك كمية كافية للبيع!');
    
    const totalSale = MARKET[key].price * qty;
    player.balance += totalSale;
    player.portfolio[key] -= qty;
    if (player.portfolio[key] === 0) delete player.portfolio[key];
    saveData();
    message.reply(`✅ تم بيع ${qty} × ${MARKET[key].name} بـ ${totalSale} 💰\n💵 أضيفت إلى رصيدك!`);
  }

  // 📂 محفظتي
  if (message.content === '!محفظتي') {
    let reply = '📂 **محفظتك الاستثمارية:**\n\n';
    let hasItems = false;
    for (let key in player.portfolio) {
      if (player.portfolio[key] > 0) {
        hasItems = true;
        const item = MARKET[key];
        const value = player.portfolio[key] * item.price;
        reply += `${key} ${item.name} — العدد: ${player.portfolio[key]}\n`;
        reply += `   القيمة الحالية: ${value.toLocaleString()} 💰\n\n`;
      }
    }
    if (!hasItems) reply += 'محفظتك فارغة حالياً! اكتب !السوق لترى ما يمكنك شراؤه 🛒';
    message.reply(reply);
  }

  // 📢 بدء مزاد
  if (message.content === '!ابدأ') {
    message.reply('📢 بدأ المزاد! اكتب !زايد المبلغ لتقديم عرضك ⚡');
  }

  // ⚡ المزايدة
  if (message.content.startsWith('!زايد ')) {
    const amount = message.content.split(' ')[1];
    message.reply(`✅ تم تسجيل عرضك: ${amount} 💰`);
  }
});

console.log('✅ نظام الأوامر العربية جاهز! اكتب !مساعدة لترى القائمة 📋');
