const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const TOKEN = process.env.TOKEN;

// 📂 تخزين البيانات
const users = new Map();

// 🏠 العقارات
const estates = [
  { id: 'farm', name: '🚜 مزرعة', price: 80000, income: 800, desc: 'مصدر غذاء ونجاح مستمر' },
  { id: 'office', name: '🏢 مكتب تجاري', price: 150000, income: 500, desc: 'مقر عمل احترافي' },
  { id: 'mall', name: '🏬 مركز تسوق', price: 400000, income: 1800, desc: 'يجذب الناس يومياً' },
  { id: 'factory', name: '🏭 مصنع', price: 800000, income: 5000, desc: 'إنتاج مستمر وأرباح وفيرة' },
  { id: 'gas', name: '⛽ محطة وقود', price: 250000, income: 3000, desc: 'الجميع يحتاج الوقود' },
  { id: 'hospital', name: '🏥 مستوصف', price: 600000, income: 7500, desc: 'خدمة وأرباح معاً' },
  { id: 'park', name: '🎡 مدينة ملاهي', price: 1200000, income: 18000, desc: 'فرح الناس وثروتك تنمو' },
  { id: 'palace', name: '🏰 قصر', price: 2000000, income: 25000, desc: 'رمز النجاح والفخامة' },
  { id: 'powerplant', name: '⚡ محطة طاقة', price: 1500000, income: 22000, desc: 'الجميع يحتاجك دائماً' },
  { id: 'tower', name: '🗼 برج إداري', price: 1800000, income: 10000, desc: 'أعلى وأكثر إشراقاً في المدينة' }
];

// 📈 عناصر السوق
const marketItems = [
  { id: 'gold', name: '🪙 ذهب', price: 2000, desc: 'ملاذ آمن وقت الأزمات' },
  { id: 'diamond', name: '💎 ألماس', price: 15000, desc: 'قيمته لا تنخفض أبداً' },
  { id: 'stock', name: '📊 أسهم شركة', price: 50000, desc: 'استثمار في شركات ناجحة' },
  { id: 'art', name: '🖼️ لوحة فنية نادرة', price: 250000, desc: 'تحفة فنية قيمتها تزداد' },
  { id: 'company', name: '🏢 شركة كاملة', price: 2000000, desc: 'أنت رئيس مجلس الإدارة!' }
];

// 🎮 دوال مساعدة
function createItemButtons(items, prefix) {
  const buttons = items.map(item =>
    new ButtonBuilder()
      .setCustomId(`${prefix}_${item.id}`)
      .setLabel(`شراء ${item.name.split(' ').slice(1).join(' ')}`)
      .setStyle(ButtonStyle.Success)
  );
  const rows = [];
  for (let i = 0; i < buttons.length; i += 5) {
    rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
  }
  return rows;
}

// ✅ عند تشغيل البوت
client.on('ready', () => {
  console.log(`✅ البوت متصل باسم: ${client.user.tag}`);
  client.user.setActivity('إمبراطورية الثروة | !مساعدة', { type: 'PLAYING' });
});

// 📨 معالجة الأوامر النصية
const PREFIX = '!';
client.on('messageCreate', async message => {
  if (!message.content.startsWith(PREFIX) || message.author.bot) return;
  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === 'مساعدة' || command === 'اوامر') {
    return message.reply(`
📋 **قائمة الأوامر:**
!بداية — إنشاء حسابك
!رصيد — معرفة رصيدك
!يومي — استلام راتبك اليومي
!عقارات — عرض العقارات مع أزرار الشراء
!سوق — عرض عناصر السوق للاستثمار
!ممتلكات — عرض ما تملكه
!اغنى — قائمة أغنى اللاعبين
    `);
  }

  if (command === 'بداية') {
    if (users.has(message.author.id)) return message.reply('⚠️ لديك حساب بالفعل!');
    users.set(message.author.id, { balance: 1000, lastDaily: 0, estates: [], investments: [] });
    return message.reply('✅ تم إنشاء حسابك! رصيدك: **1000** 💵 اكتب !يومي لبدء اللعب');
  }

  if (command === 'رصيد') {
    if (!users.has(message.author.id)) return message.reply('⚠️ اكتب !بداية أولاً');
    return message.reply(`💰 رصيدك: **${users.get(message.author.id).balance}** 💵`);
  }

  if (command === 'يومي') {
    if (!users.has(message.author.id)) return message.reply('⚠️ اكتب !بداية أولاً');
    const u = users.get(message.author.id);
    const now = Date.now();
    if (now - u.lastDaily < 86400000) return message.reply('⏳ عد غداً لاستلام راتبك');
    u.lastDaily = now; u.balance += 500;
    return message.reply(`✅ تم استلام 500 💵 | الرصيد: ${u.balance}`);
  }

  if (command === 'عقارات') {
    const embed = new EmbedBuilder()
      .setTitle('🏠 العقارات المتاحة')
      .setColor('#2ecc71')
      .setFooter({ text: 'اضغط على زر الشراء في الأسفل' });
    
    estates.forEach(e => {
      embed.addFields({
        name: e.name,
        value: `💰 السعر: ${e.price} 💵\n📈 دخل يومي +${e.income} 💵\n📝 ${e.desc}`,
        inline: false
      });
    });

    return message.reply({ embeds: [embed], components: createItemButtons(estates, 'buy_estate') });
  }

  if (command === 'سوق') {
    const embed = new EmbedBuilder()
      .setTitle('📈 سوق الاستثمار')
      .setColor('#9b59b6')
      .setFooter({ text: 'استثمر بحكمة وازدد ثراءً!' });
    
    marketItems.forEach(item => {
      embed.addFields({
        name: item.name,
        value: `💰 السعر: ${item.price} 💵\n📝 ${item.desc}`,
        inline: false
      });
    });

    return message.reply({ embeds: [embed], components: createItemButtons(marketItems, 'buy_market') });
  }

  if (command === 'ممتلكات') {
    if (!users.has(message.author.id)) return message.reply('⚠️ اكتب !بداية أولاً');
    const u = users.get(message.author.id);
    if (u.estates.length === 0 && u.investments.length === 0) {
      return message.reply('📦 لا تملك شيئاً بعد! اكتب !عقارات أو !سوق للشراء');
    }
    
    let list = '📦 **ممتلكاتك:**\n\n';
    let totalIncome = 0;
    
    if (u.estates.length > 0) {
      list += '🏠 **العقارات:**\n';
      u.estates.forEach(e => {
        list += `✅ ${e.name} | دخل يومي +${e.income} 💵\n`;
        totalIncome += e.income;
      });
      list += '\n';
    }
    
    if (u.investments.length > 0) {
      list += '📈 **الاستثمارات:**\n';
      u.investments.forEach(i => {
        list += `✅ ${i.name}\n`;
      });
    }
    
    if (totalIncome > 0) list += `\n💰 إجمالي دخلك اليومي: +${totalIncome} 💵`;
    return message.reply(list);
  }

  if (command === 'اغنى') {
    if (users.size === 0) return message.reply('⚠️ لا يوجد لاعبين حتى الآن!');
    const sorted = Array.from(users.entries()).sort((a, b) => b[1].balance - a[1].balance).slice(0, 10);
    let list = '🏆 **أغنى 10 لاعبين هذا الأسبوع:**\n\n';
    sorted.forEach(([id, u], i) => {
      const m = i === 0 ? '👑' : i === 1 ? '🥈' : i === 2 ? '🥉' : '•';
      const title = i === 0 ? ' — الملك 👑' : i === 1 ? ' — الأمير 🥈' : i === 2 ? ' — النبيل 🥉' : '';
      list += `${m} المرتبة ${i+1}: <@${id}> — **${u.balance}** 💵 ${title}\n`;
    });
    return message.reply(list);
  }
});

// 🎯 معالجة الضغط على الأزرار
client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;
  
  if (!users.has(interaction.user.id)) {
    return interaction.reply({ content: '⚠️ اكتب !بداية أولاً لإنشاء حسابك', ephemeral: true });
  }
  
  const u = users.get(interaction.user.id);

  // شراء عقار
  if (interaction.customId.startsWith('buy_estate_')) {
    const id = interaction.customId.replace('buy_estate_', '');
    const item = estates.find(e => e.id === id);
    
    if (!item) return interaction.reply({ content: '❌ العنصر غير موجود!', ephemeral: true });
    if (u.balance < item.price) {
      return interaction.reply({ 
        content: `❌ رصيدك غير كافٍ!\nالمطلوب: ${item.price} 💵\nمتوفر: ${u.balance} 💵`,
        ephemeral: true 
      });
    }
    if (u.estates.find(e => e.id === id)) {
      return interaction.reply({ content: '⚠️ تملك هذا العقار بالفعل!', ephemeral: true });
    }
    
    u.balance -= item.price;
    u.estates.push({ ...item });
    
    return interaction.reply(`
✅ **تم شراء العقار بنجاح!**
${item.name}
💰 السعر: ${item.price} 💵
💳 رصيدك المتبقي: ${u.balance} 💵
📈 دخل يومي جديد: +${item.income} 💵
    `);
  }

  // شراء من السوق
  if (interaction.customId.startsWith('buy_market_')) {
    const id = interaction.customId.replace('buy_market_', '');
    const item = marketItems.find(m => m.id === id);
    
    if (!item) return interaction.reply({ content: '❌ العنصر غير موجود!', ephemeral: true });
    if (u.balance < item.price) {
      return interaction.reply({ 
        content: `❌ رصيدك غير كافٍ!\nالمطلوب: ${item.price} 💵\nمتوفر: ${u.balance} 💵`,
        ephemeral: true 
      });
    }
    if (u.investments.find(i => i.id === id)) {
      return interaction.reply({ content: '⚠️ تملك هذا بالفعل!', ephemeral: true });
    }
    
    u.balance -= item.price;
    u.investments.push({ ...item });
    
    return interaction.reply(`
✅ **تم الشراء بنجاح!**
${item.name}
💰 السعر: ${item.price} 💵
💳 رصيدك المتبقي: ${u.balance} 💵
📝 ${item.desc}
    `);
  }
});

// 🔑 تشغيل البوت
client.login(TOKEN).catch(err => {
  console.error('❌ خطأ في تسجيل الدخول:', err.message);
});
// 🌐 خادم بسيط ليعمل على Render
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('✅ بوت إمبراطورية الثروة يعمل بنجاح!');
});

app.listen(PORT, () => {
  console.log(`🌐 الخادم يعمل على المنفذ ${PORT}`);
});
