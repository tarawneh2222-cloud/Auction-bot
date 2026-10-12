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
// 🎮 الألعاب الإضافية
// ==============================================
const gameCooldowns = new Map();

function getCooldown(key, id, ms) {
  const now = Date.now();
  const fullKey = `${key}_${id}`;
  if (gameCooldowns.get(fullKey) && now - gameCooldowns.get(fullKey) < ms) {
    return Math.ceil((ms - (now - gameCooldowns.get(fullKey))) / 1000);
  }
  gameCooldowns.set(fullKey, now);
  return 0;
}

// 🏎️ سباق السيارات
client.on('messageCreate', async message => {
  if (!message.content.startsWith(PREFIX) || message.author.bot) return;
  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();
  const userId = message.author.id;

  if (cmd === 'سباق') {
    if (!users.has(userId)) return message.reply('⚠️ اكتب `!بداية` أولاً!');
    const cd = getCooldown('race', userId, 120000);
    if (cd > 0) return message.reply(`⏳ انتظر ${cd} ثانية قبل سباق آخر!`);

    const cars = ['🏎️', '🚗', '🚙', '🚕', '🏁'];
    const players = [
      { name: message.author.username, emoji: cars[Math.floor(Math.random()*cars.length)], pos: 0 }
    ];
    
    message.reply(`🏁 بدأ السباق! سأبدأ أنا أولاً...\nاكتب **!انضم** خلال 15 ثانية للمشاركة!`);
    
    const waitMsg = message;
    const joinCollector = message.channel.createMessageCollector({ 
      filter: m => m.content === '!انضم' && !m.author.bot,
      time: 15000
    });
    
    joinCollector.on('collect', m => {
      if (!users.has(m.author.id)) return;
      players.push({ name: m.author.username, emoji: cars[Math.floor(Math.random()*cars.length)], pos: 0 });
      m.reply(`✅ انضم ${m.author.username} للسباق!`);
    });
    
    joinCollector.on('end', async () => {
      if (players.length < 2) {
        return message.channel.send('⏳ لم ينضم عدد كافٍ من اللاعبين! ابدأ سباقاً جديداً.');
      }
      
      message.channel.send(`🏁 السباق يبدأ بـ ${players.length} متسابقين!`);
      const goal = 15;
      let winner = null;
      
      while (!winner) {
        let display = '';
        for (const p of players) {
          const move = Math.random() > 0.3 ? Math.floor(Math.random()*3)+1 : 0;
          p.pos = Math.min(goal, p.pos + move);
          const track = '█'.repeat(p.pos) + '░'.repeat(goal - p.pos);
          display += `${p.emoji} ${p.name}\n${track} ${p.pos}/${goal}\n\n`;
          if (p.pos >= goal && !winner) winner = p;
        }
        const m = await message.channel.send(display);
        await new Promise(r => setTimeout(r, 700));
        await m.delete().catch(()=>{});
      }
      
      const prize = players.length * 100;
      const winnerId = players.find(p => p.name === winner.name)?.id || userId;
      if (!users.has(winnerId)) users.set(winnerId, { balance: 0 });
      users.get(winnerId).balance += prize;
      
      message.channel.send(`🏆 فاز **${winner.emoji} ${winner.name}**!\n💰 الجائزة: +${prize} 💵`);
      saveData();
    });
  }

  // 🗺️ البحث عن الكنز
  if (cmd === 'كنز') {
    if (!users.has(userId)) return message.reply('⚠️ اكتب `!بداية` أولاً!');
    const cd = getCooldown('treasure', userId, 1800000);
    if (cd > 0) return message.reply(`⏳ عُد بعد ${Math.ceil(cd/60)} دقيقة!`);

    const areas = ['🌲 الغابة', '🕳️ الكهف', '🌊 النهر', '⛰️ القمة'];
    const correct = Math.floor(Math.random() * 4);
    let attempts = 3;
    
    message.reply(`🗺️ اختر منطقة للبحث:\n1️⃣ ${areas[0]}\n2️⃣ ${areas[1]}\n3️⃣ ${areas[2]}\n4️⃣ ${areas[3]}\n\nاكتب الرقم! لديك 3 محاولات`);
    
    const filter = m => m.author.id === userId && /^[1-4]$/.test(m.content);
    const collector = message.channel.createMessageCollector({ filter, time: 60000 });
    
    collector.on('collect', m => {
      const choice = parseInt(m.content) - 1;
      attempts--;
      
      if (choice === correct) {
        collector.stop();
        const prize = Math.random() > 0.8 ? 3000 : Math.random() > 0.5 ? 800 : 150;
        const u = users.get(userId);
        u.balance += prize;
        saveData();
        m.reply(`💎 وجدت الكنز في **${areas[choice]}**!\n💰 ربح: +${prize} 💵`);
      } else if (attempts > 0) {
        m.reply(`🔍 لا يوجد شيء هنا! تبقى ${attempts} محاولات`);
      } else {
        collector.stop();
        m.reply(`😔 انتهت المحاولات! الكنز كان في **${areas[correct]}**`);
      }
    });
  }

  // 🏷️ تخمين السعر
  if (cmd === 'سعر') {
    if (!users.has(userId)) return message.reply('⚠️ اكتب `!بداية` أولاً!');
    const cd = getCooldown('price', userId, 60000);
    if (cd > 0) return message.reply(`⏳ انتظر ${cd} ثانية!`);

    const items = [
      { name: 'ساعة ذكية ⌚', min: 100, max: 500 },
      { name: 'حقيبة فاخرة 👜', min: 200, max: 800 },
      { name: 'هاتف محمول 📱', min: 800, max: 2000 },
      { name: 'دراجة هوائية 🚴', min: 300, max: 1200 }
    ];
    const item = items[Math.floor(Math.random() * items.length)];
    const actualPrice = Math.floor(Math.random() * (item.max - item.min)) + item.min;
    
    message.reply(`🏷️ **خمن سعر: ${item.name}**\n💡 بين ${item.min} و ${item.max} عملة\nاكتب رقمك في الدردشة! لديك 30 ثانية ⏳`);
    
    const guesses = new Map();
    const filter = m => !isNaN(parseInt(m.content)) && parseInt(m.content) > 0;
    const collector = message.channel.createMessageCollector({ filter, time: 30000 });
    
    collector.on('collect', m => {
      if (!guesses.has(m.author.id)) {
        guesses.set(m.author.id, parseInt(m.content));
        m.react('✅');
      }
    });
    
    collector.on('end', () => {
      if (guesses.size === 0) {
        return message.channel.send(`⏳ انتهى الوقت! السعر الحقيقي كان: **${actualPrice}** 💵`);
      }
      
      let closestId = null, minDiff = Infinity;
      for (const [gId, g] of guesses) {
        const diff = Math.abs(g - actualPrice);
        if (diff < minDiff) {
          minDiff = diff;
          closestId = gId;
        }
      }
      
      const prize = Math.floor(actualPrice * 0.05);
      if (!users.has(closestId)) users.set(closestId, { balance: 0 });
      users.get(closestId).balance += prize;
      saveData();
      
      message.channel.send(`
⏰ انتهى الوقت! السعر الحقيقي: **${actualPrice}** 💵

🏆 الفائز: <@${closestId}> — تخمينك: ${guesses.get(closestId)}
💰 الربح: +${prize} 💵
      `);
    });
  }

  // ⚔️ تحدي لاعب آخر
  if (cmd === 'تحدي' && message.mentions.users.size > 0) {
    if (!users.has(userId)) return message.reply('⚠️ اكتب `!بداية` أولاً!');
    const target = message.mentions.users.first();
    if (target.id === userId) return message.reply('❌ لا يمكنك تحدي نفسك!');
    
    message.reply(`⚔️ **${message.author.username}** يتحدى **${target.username}**!\n\nعلى ${target.username} الرد بكتابة **!اقبل** خلال 30 ثانية`);
    
    const confirmFilter = m => m.content === '!اقبل' && m.author.id === target.id;
    const confirm = message.channel.createMessageCollector({ filter: confirmFilter, time: 30000 });
    
    confirm.on('collect', () => {
      confirm.stop();
      message.channel.send(`⚔️ بدأت المعركة!\nاختيارات: 1=⚔️ هجوم | 2=🛡️ دفاع | 3=✨ ضربة قوية\nاكتب الرقم في الدردشة!`);
      
      const choices = new Map();
      const choiceFilter = m => ['1','2','3'].includes(m.content) && 
        [userId, target.id].includes(m.author.id);
      
      const choiceCol = message.channel.createMessageCollector({ filter: choiceFilter, time: 30000 });
      
      choiceCol.on('collect', m => {
        choices.set(m.author.id, m.content);
        m.react('✅');
        if (choices.size === 2) choiceCol.stop();
      });
      
      choiceCol.on('end', () => {
        if (choices.size < 2) {
          return message.channel.send('⏳ لم يكمل اللاعبون اختياراتهم!');
        }
        
        const p1c = choices.get(userId);
        const p2c = choices.get(target.id);
        const names = { '1':'⚔️ هجوم', '2':'🛡️ دفاع', '3':'✨ ضربة قوية' };
        
        let result = '';
        const beats = { '1':'2', '2':'3', '3':'1' };
        
        if (p1c === p2c) {
          result = '🤝 تعادل! لا أحد يربح ولا يخسر';
        } else if (beats[p1c] === p2c) {
          const p = users.get(userId);
          p.balance += 200;
          result = `🏆 فاز **${message.author.username}**!\n💰 +200 💵`;
        } else {
          const t = users.get(target.id);
          t.balance += 200;
          result = `🏆 فاز **${target.username}**!\n💰 +200 💵`;
        }
        
        message.channel.send(`
⚔️ النتيجة:

**${message.author.username}**: ${names[p1c]}
**${target.username}**: ${names[p2c]}

${result}
        `);
        saveData();
      });
    });
    
    confirm.on('end', () => {
      if (!confirm.collected.size) {
        message.channel.send(`⏳ لم يقبل التحدي في الوقت المحدد.`);
      }
    });
  }
});

// ==============================================
// 📈 نظام التداول والأسواق المالية
// ==============================================

// أسعار السوق الأساسية
const marketAssets = {
  GOLD:   { name: '🪙 ذهب',               price: 1000,  change: 0, minPrice: 600,  maxPrice: 2000  },
  STOCK:  { name: '📈 أسهم شركات',         price: 500,   change: 0, minPrice: 200,  maxPrice: 1200  },
  COIN:   { name: '💱 عملة رقمية',         price: 100,   change: 0, minPrice: 30,   maxPrice: 500   },
  GEM:    { name: '💎 أحجار كريمة',        price: 2000,  change: 0, minPrice: 1000, maxPrice: 4000  },
  REAL:   { name: '🏡 عقارات سوقية',       price: 1500,  change: 0, minPrice: 800,  maxPrice: 3000  }
};

const newsEvents = [
  { text: '🌟 استقرار اقتصادي', effect: { STOCK: 1.08 }, msg: 'ارتفاع الأسهم بنسبة 8% ⬆️' },
  { text: '⚒️ اكتشاف منجم ذهب جديد', effect: { GOLD: 0.92 }, msg: 'انخفاض الذهب بنسبة 8% ⬇️ — فرصة شراء!' },
  { text: '🔥 طلب عالمي على العقارات', effect: { REAL: 1.12 }, msg: 'ارتفاع العقارات بنسبة 12% ⬆️' },
  { text: '🚀 تحديث تكنولوجي كبير', effect: { COIN: 1.20 }, msg: 'قفزة العملة الرقمية بنسبة 20% ⚡⬆️' },
  { text: '📉 توترات اقتصادية عالمية', effect: { GOLD: 1.05, STOCK: 0.90 }, msg: 'الذهب ملاذ آمن +5% ⬆️ والأسهم تنخفض ⬇️' },
  { text: '💎 معرض أحجار كريمة نادرة', effect: { GEM: 1.15 }, msg: 'ارتفاع الأحجار الكريمة بنسبة 15% ⬆️' },
  { text: '🏗️ مشاريع تطوير عقاري ضخمة', effect: { REAL: 1.07, STOCK: 1.04 }, msg: 'سوق العقارات والأسهم يزدهر ⬆️' },
  { text: '🌊 هدوء في الأسواق', effect: {}, msg: 'الأسواق مستقرة حالياً 🙂' }
];

// محفظة كل لاعب
function getPortfolio(userId) {
  const u = users.get(userId);
  if (!u.portfolio) u.portfolio = { GOLD:0, STOCK:0, COIN:0, GEM:0, REAL:0, lastUpdate: Date.now() };
  return u.portfolio;
}

// تحديث أسعار السوق عشوائياً
function updateMarketPrices() {
  for (const [symbol, asset] of Object.entries(marketAssets)) {
    const volatility = symbol === 'COIN' ? 0.08 : symbol === 'STOCK' ? 0.04 : 0.02;
    const change = 1 + (Math.random() - 0.5) * 2 * volatility;
    asset.price = Math.round(asset.price * change);
    asset.price = Math.max(asset.minPrice, Math.min(asset.maxPrice, asset.price));
    asset.change = Math.round((change - 1) * 1000) / 10;
  }
}

// تشغيل حدث عشوائي
function triggerRandomNews(channel) {
  const news = newsEvents[Math.floor(Math.random() * newsEvents.length)];
  let effectText = '';
  
  for (const [sym, multiplier] of Object.entries(news.effect)) {
    marketAssets[sym].price = Math.round(marketAssets[sym].price * multiplier);
    marketAssets[sym].price = Math.max(marketAssets[sym].minPrice, Math.min(marketAssets[sym].maxPrice, marketAssets[sym].price));
    marketAssets[sym].change = Math.round((multiplier - 1) * 1000) / 10;
    effectText += `${marketAssets[sym].name}: ${marketAssets[sym].price} 💵\n`;
  }
  
  channel.send(`
📰 **خبر عاجل:** ${news.text}
📢 ${news.msg}
${effectText}
⏰ السوق يتغير باستمرار — اغتنم الفرصة!
  `);
}

// تحديث الأسعار كل ساعة
setInterval(() => {
  updateMarketPrices();
  console.log('📈 تم تحديث أسعار السوق');
}, 3600000);

// أخبار عشوائية كل 2-4 ساعات
setInterval(() => {
  // سيتم تشغيلها عند توفر قناة — نعتمد على التحديث اليدوي للأسعار
}, 9000000);

// ==============================================
// 💬 أوامر نظام التداول
// ==============================================
client.on('messageCreate', async message => {
  if (!message.content.startsWith(PREFIX) || message.author.bot) return;
  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const cmd = args.shift().toLowerCase();
  const userId = message.author.id;

  // 📊 عرض السوق
  if (cmd === 'سوق' || cmd === 'اسعار') {
    if (!users.has(userId)) return message.reply('⚠️ اكتب `!بداية` أولاً!');
    
    let text = '📊 **أسعار السوق الحالية:**\n\n';
    for (const [sym, asset] of Object.entries(marketAssets)) {
      const trend = asset.change > 0 ? '📈' : asset.change < 0 ? '📉' : '➡️';
      text += `${trend} **${sym}** — ${asset.name}\nالسعر: **${asset.price}** 💵 (${asset.change > 0 ? '+' : ''}${asset.change}%)\n\n`;
    }
    text += '💡 استخدم: `اشترِ الرمز الكمية` أو `بعِ الرمز الكمية`\nمثال: `اشترِ GOLD 5`';
    message.reply(text);
  }

  // 🛒 شراء
  if (cmd === 'اشترِ' || cmd === 'اشترى' || cmd === 'شراء') {
    if (!users.has(userId)) return message.reply('⚠️ اكتب `!بداية` أولاً!');
    const symbol = args[0]?.toUpperCase();
    const amount = parseInt(args[1]);
    
    if (!marketAssets[symbol]) return message.reply('❌ رمز غير صالح! استخدم: GOLD, STOCK, COIN, GEM, REAL');
    if (!amount || amount <= 0) return message.reply('❌ حدد الكمية! مثال: `اشترِ GOLD 2`');
    
    const totalCost = marketAssets[symbol].price * amount;
    const u = users.get(userId);
    const portfolio = getPortfolio(userId);
    
    if (u.balance < totalCost) {
      return message.reply(`❌ رصيدك غير كافٍ!\nالمطلوب: ${totalCost} 💵\nمتاح: ${u.balance} 💵`);
    }
    
    u.balance -= totalCost;
    portfolio[symbol] += amount;
    saveData();
    
    message.reply(`
✅ **تم الشراء بنجاح!**
📦 الكمية: ${amount} × ${marketAssets[symbol].name}
💰 السعر الواحد: ${marketAssets[symbol].price} 💵
💳 المجموع المخصوم: ${totalCost} 💵
💵 رصيدك المتبقي: ${u.balance} 💵
    `);
  }

  // 💰 بيع
  if (cmd === 'بعِ' || cmd === 'بيع') {
    if (!users.has(userId)) return message.reply('⚠️ اكتب `!بداية` أولاً!');
    const symbol = args[0]?.toUpperCase();
    const amount = parseInt(args[1]);
    
    if (!marketAssets[symbol]) return message.reply('❌ رمز غير صالح!');
    if (!amount || amount <= 0) return message.reply('❌ حدد الكمية! مثال: `بعِ GOLD 2`');
    
    const portfolio = getPortfolio(userId);
    if (portfolio[symbol] < amount) {
      return message.reply(`❌ لا تمتلك كمية كافية!\nلديك: ${portfolio[symbol]} فقط`);
    }
    
    const totalGain = marketAssets[symbol].price * amount;
    const u = users.get(userId);
    
    portfolio[symbol] -= amount;
    u.balance += totalGain;
    saveData();
    
    message.reply(`
✅ **تم البيع بنجاح!**
📦 الكمية المباعة: ${amount} × ${marketAssets[symbol].name}
💰 السعر الواحد: ${marketAssets[symbol].price} 💵
💵 المجموع المضاف: ${totalGain} 💵
💳 رصيدك الحالي: ${u.balance} 💵
    `);
  }

  // 📦 محفظتي
  if (cmd === 'محفظتي' || cmd === 'محفظة') {
    if (!users.has(userId)) return message.reply('⚠️ اكتب `!بداية` أولاً!');
    const portfolio = getPortfolio(userId);
    let text = '📦 **محفظتك الاستثمارية:**\n\n';
    let totalValue = 0, initialValue = 0;
    let hasAssets = false;
    
    for (const [sym, qty] of Object.entries(portfolio)) {
      if (sym === 'lastUpdate') continue;
      if (qty > 0) {
        hasAssets = true;
        const currentPrice = marketAssets[sym].price;
        const value = qty * currentPrice;
        totalValue += value;
        text += `${marketAssets[sym].name}: **${qty} وحدة**\nالقيمة الحالية: ${value} 💵 (${currentPrice} لكل وحدة)\n\n`;
      }
    }
    
    if (!hasAssets) {
      text += '📭 محفظتك فارغة حالياً! استخدم `!سوق` لترى ما يمكنك شراؤه 📈';
    } else {
      text += `💰 **إجمالي قيمة المحفظة:** ${totalValue} 💵`;
    }
    
    message.reply(text);
  }

  // 📰 خبر عشوائي
  if (cmd === 'خبر' || cmd === 'سوق_خبر') {
    if (!users.has(userId)) return message.reply('⚠️ اكتب `!بداية` أولاً!');
    triggerRandomNews(message.channel);
  }

  // 🔄 تحديث الأسعار يدوياً
  if (cmd === 'تحديث_الاسعار' || cmd === 'تحديث_السوق') {
    if (!users.has(userId)) return message.reply('⚠️ اكتب `!بداية` أولاً!');
    updateMarketPrices();
    message.reply('✅ تم تحديث أسعار السوق! اكتب `!سوق` للاطلاع عليها 📊');
  }
});
// ==============================================
// 📊 نظام الاستثمار والأصول المتغيرة
// ==============================================

// قائمة الأصول والأسعار
const assetsData = {
  سيارات:      { emoji: '🚗',  basePrice: 86203,   price: 86203,   trend: -1 },
  أسهم:        { emoji: '📊',  basePrice: 37840,   price: 37840,   trend: -1 },
  أراضي:       { emoji: '🏙️', basePrice: 127286,  price: 127286,  trend: -1 },
  قطارات:      { emoji: '🚄',  basePrice: 2027054, price: 2027054, trend: 1  },
  هواتف:       { emoji: '📱',  basePrice: 20000,   price: 20000,   trend: -1 },
  شركات:       { emoji: '💻',  basePrice: 80425,   price: 80425,   trend: 0  },
  سيرفرات:     { emoji: '📺',  basePrice: 37462,   price: 37462,   trend: -1 },
  بوتات:       { emoji: '🤖',  basePrice: 52964,   price: 52964,   trend: -1 },
  طائرات:      { emoji: '✈️',  basePrice: 134814,  price: 134814,  trend: -1 },
  ملاعب:       { emoji: '🏟️', basePrice: 5421179, price: 5421179, trend: -1 },
  ذهب:         { emoji: '🪙',  basePrice: 2500,    price: 2500,    trend: 0  },
  فضة:         { emoji: '🥈',  basePrice: 350,     price: 350,     trend: 1  },
  منازل:       { emoji: '🏠',  basePrice: 15000,   price: 15000,   trend: 1  },
  مزارع:       { emoji: '🌾',  basePrice: 8500,    price: 8500,    trend: 0  },
  محلات:       { emoji: '🏪',  basePrice: 12000,   price: 12000,   trend: 1  },
  فنادق:       { emoji: '🏨',  basePrice: 95000,   price: 95000,   trend: 1  },
  سفن:         { emoji: '🚢',  basePrice: 450000,  price: 450000,  trend: -1 },
  طائرات_خاصة:{ emoji: '🛩️',  basePrice: 850000,  price: 850000,  trend: -1 },
  بنوك:        { emoji: '🏦',  basePrice: 250000,  price: 250000,  trend: 1  },
  مصانع:       { emoji: '🏭',  basePrice: 150000,  price: 150000,  trend: 0  },
  متاجر_الكترونية:{ emoji: '🛒', basePrice: 45000, price: 45000, trend: 1 },
  عقارات_فاخرة:{ emoji: '🏰',  basePrice: 500000,  price: 500000,  trend: 0  },
  محطات_طاقة:  { emoji: '⚡',  basePrice: 350000,  price: 350000,  trend: 1  },
  مستشفيات:   { emoji: '🏥',  basePrice: 400000,  price: 400000,  trend: 0  }
};

// تحديث الأسعار كل ساعة
function updateAssetPrices() {
  for (const [name, asset] of Object.entries(assetsData)) {
    const changePercent = (Math.random() - 0.5) * 0.06; // ±3%
    asset.price = Math.round(asset.price * (1 + changePercent));
    asset.price = Math.max(asset.basePrice * 0.5, Math.min(asset.basePrice * 2, asset.price));
    asset.trend = changePercent > 0.005 ? 1 : changePercent < -0.005 ? -1 : 0;
  }
  console.log('📊 تم تحديث أسعار الأصول');
}

setInterval(updateAssetPrices, 3600000);

// الحصول على محفظة اللاعب
function getAssetsPortfolio(userId) {
  const u = users.get(userId);
  if (!u.assetsPortfolio) u.assetsPortfolio = {};
  return u.assetsPortfolio;
}

// ==============================================
// 💬 أوامر نظام الاستثمار
// ==============================================
client.on('messageCreate', async message => {
  if (!message.content.startsWith(PREFIX) || message.author.bot) return;
  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const cmd = args.shift().normalize();
  const userId = message.author.id;

  // 📊 عرض الأسعار
  if (cmd === 'الاسعار' || cmd === 'اسعار') {
    if (!users.has(userId)) return message.reply('⚠️ اكتب `!بداية` أولاً!');
    
    let text = '📊 **أسعار السوق الحالية:**\n\n';
    for (const [name, asset] of Object.entries(assetsData)) {
      const arrow = asset.trend === 1 ? '📈' : asset.trend === -1 ? '📉' : '➡️';
      text += `${arrow} ${asset.emoji} ${name}: **${asset.price.toLocaleString()}** $\n`;
    }
    text += '\n💡 اشترِ عندما ينخفض السعر، وبِع عندما يرتفع!\nالأوامر: `اشترِ اسم الكمية` — `بيع اسم الكمية`';
    message.reply(text);
  }

  // 🛒 شراء
  if (cmd === 'اشترِ' || cmd === 'اشترى' || cmd === 'شراء') {
    if (!users.has(userId)) return message.reply('⚠️ اكتب `!بداية` أولاً!');
    const assetName = args[0];
    const quantity = parseInt(args[1]);
    
    if (!assetsData[assetName]) {
      return message.reply('❌ اسم غير صالح! اكتب `!الاسعار` لترى القائمة');
    }
    if (!quantity || quantity <= 0) {
      return message.reply('❌ حدد الكمية! مثال: `اشترِ ذهب 2`');
    }
    
    const totalCost = assetsData[assetName].price * quantity;
    const u = users.get(userId);
    const portfolio = getAssetsPortfolio(userId);
    
    if (u.balance < totalCost) {
      return message.reply(`❌ رصيدك غير كافٍ!\nالمطلوب: ${totalCost.toLocaleString()} $\nمتاح: ${u.balance.toLocaleString()} $`);
    }
    
    u.balance -= totalCost;
    portfolio[assetName] = (portfolio[assetName] || 0) + quantity;
    saveData();
    
    message.reply(`
✅ **تم الشراء بنجاح!**
${assetsData[assetName].emoji} ${assetName}
📦 الكمية: ${quantity} وحدة
💰 السعر الواحد: ${assetsData[assetName].price.toLocaleString()} $
💳 المجموع: ${totalCost.toLocaleString()} $
💵 رصيدك المتبقي: ${u.balance.toLocaleString()} $
    `);
  }

  // 💰 بيع
  if (cmd === 'بيع' || cmd === 'بِع') {
    if (!users.has(userId)) return message.reply('⚠️ اكتب `!بداية` أولاً!');
    const assetName = args[0];
    const quantity = parseInt(args[1]);
    
    if (!assetsData[assetName]) {
      return message.reply('❌ اسم غير صالح! اكتب `!الاسعار` لترى القائمة');
    }
    if (!quantity || quantity <= 0) {
      return message.reply('❌ حدد الكمية! مثال: `بيع ذهب 1`');
    }
    
    const portfolio = getAssetsPortfolio(userId);
    if (!portfolio[assetName] || portfolio[assetName] < quantity) {
      return message.reply(`❌ لا تمتلك كمية كافية!\nلديك: ${portfolio[assetName] || 0} فقط`);
    }
    
    const totalEarn = assetsData[assetName].price * quantity;
    const u = users.get(userId);
    
    portfolio[assetName] -= quantity;
    if (portfolio[assetName] === 0) delete portfolio[assetName];
    u.balance += totalEarn;
    saveData();
    
    message.reply(`
✅ **تم البيع بنجاح!**
${assetsData[assetName].emoji} ${assetName}
📦 الكمية المباعة: ${quantity} وحدة
💰 السعر الحالي: ${assetsData[assetName].price.toLocaleString()} $
💵 المجموع المضاف: ${totalEarn.toLocaleString()} $
💳 رصيدك الحالي: ${u.balance.toLocaleString()} $
    `);
  }

  // 📦 ممتلكاتي
  if (cmd === 'ممتلكاتي' || cmd === 'ممتلكات' || cmd === 'محفظتي') {
    if (!users.has(userId)) return message.reply('⚠️ اكتب `!بداية` أولاً!');
    const portfolio = getAssetsPortfolio(userId);
    let text = '📦 **ممتلكاتك الحالية:**\n\n';
    let totalValue = 0;
    let hasItems = false;
    
    for (const [name, qty] of Object.entries(portfolio)) {
      if (qty > 0) {
        hasItems = true;
        const value = assetsData[name].price * qty;
        totalValue += value;
        text += `${assetsData[name].emoji} ${name}: **${qty} وحدة** — القيمة: ${value.toLocaleString()} $\n`;
      }
    }
    
    if (!hasItems) {
      text += '📭 لا تمتلك أي أصول حتى الآن! اكتب `!الاسعار` لتبدأ الاستثمار 📈';
    } else {
      text += `\n💰 **إجمالي القيمة:** ${totalValue.toLocaleString()} $`;
    }
    
    message.reply(text);
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
