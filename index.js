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
