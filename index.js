const { Client, GatewayIntentBits, Collection, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');

// ─── إعداد ملف البيانات ───
let userData = {};
try {
  userData = JSON.parse(fs.readFileSync('./data.json', 'utf8'));
  console.log('✅ تم تحميل بيانات اللاعبين');
} catch {
  userData = {};
  console.log('📄 ملف بيانات جديد جاهز');
}

// ─── دالة الحفظ التلقائي ───
function saveData() {
  try {
    fs.writeFileSync('./data.json', JSON.stringify(userData, null, 2));
    return true;
  } catch (e) {
    console.error('❌ خطأ في الحفظ:', e);
    return false;
  }
}

// ─── دالة جلب بيانات اللاعب ───
function getUser(id) {
  if (!userData[id]) {
    userData[id] = {
      money: 1000,
      dailyClaimed: null,
      inventory: [],
      stocks: {},
      rareItems: [],
      netWorth: 1000
    };
  }
  return userData[id];
}

// ─── إعداد البوت ───
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const prefix = '.';
const TOKEN = process.env.DISCORD_TOKEN;

// ─── حالة تشغيل البوت ───
client.on('ready', () => {
  console.log(`✅ البوت متصل باسم: ${client.user.tag}`);
});

// ─── بيانات السوق والمنتجات ───
const MARKET_ITEMS = [
  { id: 1, name: 'شقة صغيرة', price: 5000, income: 50 },
  { id: 2, name: 'منزل واسع', price: 15000, income: 180 },
  { id: 3, name: 'محل تجاري', price: 30000, income: 400 },
  { id: 4, name: 'مبنى سكني', price: 80000, income: 1200 },
  { id: 5, name: 'قصر فاخر', price: 500000, income: 8000 }
];

const COMPANIES = [
  { symbol: 'GOLD', name: 'معدن الذهب', price: 1000, change: 0 },
  { symbol: 'OIL', name: 'شركة النفط', price: 800, change: 0 },
  { symbol: 'TECH', name: 'شركة التقنية', price: 500, change: 0 },
  { symbol: 'FOOD', name: 'شركة الغذاء', price: 200, change: 0 }
];

let auctionData = {
  active: false,
  itemName: '',
  itemDesc: '',
  highestBid: 0,
  highestBidder: null,
  endTime: null,
  bids: []
};

// ─── معالجة الأوامر ───
client.on('messageCreate', async message => {
  if (message.author.bot) return;
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift()?.toLowerCase();
  const userId = message.author.id;
  const user = getUser(userId);

  // ─── الحساب ───
  if (command === 'حساب') {
    message.reply(`💰 **رصيدك:** ${user.money.toLocaleString()} عملة\n📦 **ممتلكات:** ${user.inventory.length}\n🏆 **قطع نادرة:** ${user.rareItems.length}`);
  }

  // ─── مكافأة يومية ───
  else if (command === 'يومي') {
    const today = new Date().toDateString();
    if (user.dailyClaimed === today) {
      return message.reply('⏳ لقد استلمت مكافأتك اليوم! عد غداً');
    }
    user.money += 500;
    user.dailyClaimed = today;
    saveData();
    message.reply('✅ تم استلام **500 عملة** — أعود غداً لمكافأة جديدة!');
  }

  // ─── الترتيب الأسبوعي ───
  else if (command === 'ترتيب') {
    const sorted = Object.entries(userData)
      .map(([id, u]) => ({ id, money: u.money }))
      .sort((a, b) => b.money - a.money)
      .slice(0, 5);
    
    let list = '🏆 **أغنى اللاعبين:**\n';
    sorted.forEach((p, i) => {
      list += `${i+1}. <@${p.id}> — ${p.money.toLocaleString()}\n`;
    });
    message.reply(list);
  }

  // ─── السوق ───
  else if (command === 'سوق') {
    let list = '🏠 **السوق العقاري:**\n';
    MARKET_ITEMS.forEach(item => {
      list += `${item.id}. ${item.name} — ${item.price.toLocaleString()} 💰 | دخل يومي: ${item.income}\n`;
    });
    message.reply(list);
  }

  // ─── شراء ───
  else if (command === 'اشترِ') {
    const id = parseInt(args[0]);
    const item = MARKET_ITEMS.find(i => i.id === id);
    if (!item) return message.reply('❌ رقم غير صالح! استخدم `.سوق` لمعرفة الأرقام');
    if (user.inventory.some(i => i.id === item.id)) return message.reply('⚠️ تمتلك هذا العنصر مسبقاً!');
    if (user.money < item.price) return message.reply('❌ رصيدك غير كافٍ!');
    
    user.money -= item.price;
    user.inventory.push({ ...item, purchaseDate: new Date().toISOString() });
    saveData();
    message.reply(`✅ تم شراء **${item.name}** بنجاح! دخل يومي +${item.income}`);
  }

  // ─── ممتلكاتي ───
  else if (command === 'ممتلكاتي') {
    if (user.inventory.length === 0) return message.reply('📦 لا تمتلك أي عقار حتى الآن! استخدم `.سوق` للبدء');
    let list = '📦 **ممتلكاتك:**\n';
    user.inventory.forEach((item, i) => {
      list += `${i+1}. ${item.name} | دخل يومي: ${item.income}\n`;
    });
    message.reply(list);
  }

  // ─── بيع ───
  else if (command === 'بع') {
    const idx = parseInt(args[0]) - 1;
    if (!user.inventory[idx]) return message.reply('❌ رقم غير صالح! استخدم `.ممتلكاتي`');
    
    const item = user.inventory[idx];
    const sellPrice = Math.floor(item.price * 0.7);
    user.money += sellPrice;
    user.inventory.splice(idx, 1);
    saveData();
    message.reply(`✅ بعت **${item.name}** بـ ${sellPrice.toLocaleString()} عملة`);
  }

  // ─── الألعاب ───
  else if (command === 'روليت') {
    const bet = parseInt(args[0]);
    if (!bet || bet < 100) return message.reply('❌ استخدم: `.روليت المبلغ` — الحد الأدنى 100');
    if (user.money < bet) return message.reply('❌ رصيدك غير كافٍ!');
    
    const win = Math.random() > 0.5;
    if (win) {
      user.money += bet;
      message.reply(`🎉 فزت! أضفت **+${bet.toLocaleString()}** إلى رصيدك!`);
    } else {
      user.money -= bet;
      message.reply(`😢 خسرت! خُصم **-${bet.toLocaleString()}** من رصيدك`);
    }
    saveData();
  }

  else if (command === 'صناديق') {
    const prize = Math.floor(Math.random() * 500) + 100;
    user.money += prize;
    saveData();
    message.reply(`📦 فتحت الصندوق ووجدت **${prize} عملة** بداخله! 🪙`);
  }

  else if (command === 'حظ') {
    const roll = Math.random();
    if (roll > 0.85) {
      const big = Math.floor(Math.random() * 1000) + 500;
      user.money += big;
      saveData();
      message.reply(`🌟 حظ سعيد جداً! ربحت **${big} عملة**!`);
    } else if (roll > 0.5) {
      const small = Math.floor(Math.random() * 100) + 50;
      user.money += small;
      saveData();
      message.reply(`🍀 حظ طيب — ربحت **${small} عملة**`);
    } else {
      message.reply('😅 لم يحالفك الحظ هذه المرة — حاول مجدداً!');
    }
  }

  // ─── الشركات والأسهم ───
  else if (command === 'شركات') {
    let list = '📊 **الشركات المتاحة:**\n';
    COMPANIES.forEach(c => {
      list += `${c.symbol} — ${c.name} | السعر: ${c.price}\n`;
    });
    message.reply(list);
  }

  else if (command === 'شراء' && args[0]?.toLowerCase() === 'سهم') {
    const symbol = args[1]?.toUpperCase();
    const qty = parseInt(args[2]);
    const comp = COMPANIES.find(c => c.symbol === symbol);
    if (!comp) return message.reply('❌ رمز شركة غير صالح! استخدم `.شركات`');
    if (!qty || qty < 1) return message.reply('❌ حدد الكمية! مثال: `.شراء سهم GOLD 5`');
    
    const total = comp.price * qty;
    if (user.money < total) return message.reply(`❌ تحتاج إلى ${total.toLocaleString()} عملة لهذه الصفقة`);
    
    user.money -= total;
    if (!user.stocks[symbol]) user.stocks[symbol] = 0;
    user.stocks[symbol] += qty;
    saveData();
    message.reply(`✅ اشتريت **${qty} سهم** من ${comp.name} بـ ${total.toLocaleString()} عملة`);
  }

  else if (command === 'بيع' && args[0]?.toLowerCase() === 'سهم') {
    const symbol = args[1]?.toUpperCase();
    const qty = parseInt(args[2]);
    const comp = COMPANIES.find(c => c.symbol === symbol);
    if (!comp) return message.reply('❌ رمز شركة غير صالح!');
    if (!user.stocks[symbol] || user.stocks[symbol] < qty) return message.reply('❌ لا تمتلك هذا الكمية من الأسهم');
    
    const total = comp.price * qty;
    user.money += total;
    user.stocks[symbol] -= qty;
    if (user.stocks[symbol] <= 0) delete user.stocks[symbol];
    saveData();
    message.reply(`✅ بعت **${qty} سهم** من ${comp.name} بـ ${total.toLocaleString()} عملة`);
  }

  else if (command === 'محفظتي') {
    const items = Object.entries(user.stocks);
    if (items.length === 0) return message.reply('📈 محفظتك فارغة حالياً');
    let list = '📈 **محفظتك الاستثمارية:**\n';
    items.forEach(([sym, qty]) => {
      const c = COMPANIES.find(x => x.symbol === sym);
      list += `${sym} — ${c?.name || sym}: ${qty} سهم | القيمة: ${(c?.price || 0) * qty}\n`;
    });
    message.reply(list);
  }

  // ─── المزادات ───
  else if (command === 'بدء' && args[0]?.toLowerCase() === 'مزاد') {
    if (!message.member.permissions.has('Administrator')) {
      return message.reply('⚠️ فقط المشرفون يمكنهم بدء مزاد');
    }
    if (auctionData.active) return message.reply('⚠️ يوجد مزاد جارٍ بالفعل! أنهِه أولاً');
    
    auctionData = {
      active: true,
      itemName: 'قطعة نادرة مجهولة',
      itemDesc: 'سيتم الكشف عنها عند انتهاء المزاد',
      highestBid: 1000,
      highestBidder: null,
      endTime: Date.now() + 600000,
      bids: []
    };
    message.reply('🔒 **تم بدء مزاد سري جديد!**\nالقطعة: مجهولة حتى النهاية\nسعر البدء: 1,000 عملة\nالمدة: 10 دقائق\nاستخدم `.اعرض المبلغ` للمزايدة');
  }

  else if (command === 'مزاد') {
    if (!auctionData.active) return message.reply('❌ لا يوجد مزاد جارٍ حالياً');
    const remaining = Math.max(0, Math.ceil((auctionData.endTime - Date.now()) / 60000));
    message.reply(`🔒 **مزاد سري جارٍ...**\nالقطعة: مجهولة 🔒\nأعلى عرض: **${auctionData.highestBid.toLocaleString()}** عملة\nالمزايد: ${auctionData.highestBidder ? `<@${auctionData.highestBidder}>` : 'لا أحد بعد'}\nالمتبقي: ${remaining} دقيقة\n\nاستخدم: `.اعرض 2000` للمزايدة`);
  }

  else if (command === 'اعرض') {
    if (!auctionData.active) return message.reply('❌ لا يوجد مزاد جارٍ حالياً');
    const amount = parseInt(args[0]);
    if (!amount || amount <= auctionData.highestBid) {
      return message.reply(`❌ يجب أن يكون عرضك أعلى من **${auctionData.highestBid.toLocaleString()}**`);
    }
    if (user.money < amount) return message.reply('❌ رصيدك غير كافٍ لهذا العرض!');
    
    auctionData.highestBid = amount;
    auctionData.highestBidder = userId;
    auctionData.bids.push({ user: userId, amount, time: new Date().toLocaleTimeString() });
    message.reply(`✅ تم تسجيل عرضك: **${amount.toLocaleString()}** عملة 🎉`);
  }

  else if (command === 'انهاء' && args[0]?.toLowerCase() === 'مزاد') {
    if (!message.member.permissions.has('Administrator')) {
      return message.reply('⚠️ فقط المشرفون يمكنهم إنهاء المزاد');
    }
    if (!auctionData.active) return message.reply('❌ لا يوجد مزاد جارٍ');
    
    if (auctionData.highestBidder) {
      const winner = getUser(auctionData.highestBidder);
      winner.rareItems.push({
        name: 'قطعة أسطورية من المزاد',
        wonFor: auctionData.highestBid,
        date: new Date().toLocaleDateString()
      });
      saveData();
      message.channel.send(`🎉 **المزاد انتهى!**\n🏆 الفائز: <@${auctionData.highestBidder}>\n💰 بمبلغ: ${auctionData.highestBid.toLocaleString()} عملة\n🎁 تمت إضافة القطعة إلى مجموعته!`);
    } else {
      message.channel.send('❌ انتهى المزاد ولم يشارك أحد');
    }
    auctionData.active = false;
  }

  else if (command === 'مجموعتي') {
    if (user.rareItems.length === 0) return message.reply('📦 لم تفز بأي قطعة نادرة حتى الآن! شارك في المزادات');
    let list = '🏅 **مجموعتك النادرة:**\n';
    user.rareItems.forEach((item, i) => {
      list += `${i+1}. ${item.name} — فزت بها بـ ${item.wonFor} 💰\n`;
    });
    message.reply(list);
  }

  // ─── عرض الأوامر ───
  else if (command === 'اوامر') {
    message.reply(`
📋 **جميع الأوامر المتاحة:**

🏦 الحساب:
.حساب — عرض رصيدك
.يومي — مكافأة يومية
.ترتيب — قائمة الأغنى
.اوامر — هذه القائمة

🏠 السوق:
.سوق — العقارات المتاحة
.اشترِ الرقم — شراء عقار
.ممتلكاتي — ما تملكه
.بع الرقم — بيع عقار

🎮 الألعاب:
.روليت المبلغ — مراهنة
.صناديق — ابحث عن ذهب
.حظ — حظك اليوم

📊 الأسهم:
.شركات — قائمة الشركات
.شراء سهم الرمز الكمية
.بيع سهم الرمز الكمية
.محفظتي — أسهمك

🔨 المزادات:
.بدء مزاد — ⚠️ بدء مزاد جديد
.مزاد — حالة المزاد
.اعرض المبلغ — مزايدة
.انهاء مزاد — ⚠️ إنهاء المزاد
.mجموعتي — قطعك النادرة
    `);
  }
});

// ─── تسجيل الدخول ───
client.login(TOKEN);
