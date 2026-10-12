const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('البوت يعمل بنجاح! ✅');
});

app.listen(port, () => {
  console.log(`✅ خادم الويب يعمل على المنفذ ${port}`);
});

const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events, EmbedBuilder } = require('discord.js');
const token = process.env.TOKEN;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

const users = new Map();

// 📋 العقارات من الصورة مباشرة
const estates = [
  { id: 'farm', name: '🚜 مزرعة', price: 80000, income: 800, desc: 'بداية رائعة لبناء ثروتك من الأرض' },
  { id: 'office', name: '🏢 مكتب تجاري', price: 150000, income: 500, desc: 'مكان احترافي لأعمالك الناشئة' },
  { id: 'shopping', name: '🏬 مركز تسوق', price: 400000, income: 1800, desc: 'يومياً يزداد زوارك وأرباحك' },
  { id: 'factory', name: '🏭 مصنع', price: 800000, income: 5000, desc: 'إنتاج مستمر وأرباح تنمو بثبات' },
  { id: 'gasstation', name: '⛽ محطة وقود', price: 250000, income: 3000, desc: 'حركة لا تتوقف وأرباح يومية' },
  { id: 'hospital', name: '🏥 مستوصف', price: 600000, income: 7500, desc: 'خدمة وأرباح ومكانة في المجتمع' },
  { id: 'themepark', name: '🎡 مدينة ملاهي', price: 1200000, income: 18000, desc: 'فرح الناس = نمو أرباحك' },
  { id: 'palace', name: '🏰 قصر', price: 2000000, income: 25000, desc: 'رمز النجاح والفخامة' },
  { id: 'powerplant', name: '⚡ محطة طاقة', price: 1500000, income: 22000, desc: 'الجميع يحتاجك دائماً' },
  { id: 'tower', name: '🗼 برج إداري', price: 1800000, income: 10000, desc: 'أعلى وأكثر إشراقاً في المدينة' },
];

const marketItems = [
  { id: 'gold', name: '🪙 ذهب', price: 2000, desc: 'ملاذ آمن وقت الأزمات' },
  { id: 'diamond', name: '💎 ألماس', price: 15000, desc: 'قيمته لا تنخفض أبداً' },
  { id: 'stock', name: '📈 أسهم شركة', price: 50000, desc: 'استثمار في شركات ناجحة' },
  { id: 'art', name: '🖼️ لوحة فنية نادرة', price: 250000, desc: 'تحفة فنية تزداد قيمتها' },
  { id: 'company', name: '🏢 شركة كاملة', price: 2000000, desc: 'أنت رئيس مجلس الإدارة!' },
];

function initUser(userId, username) {
  if (!users.has(userId)) {
    users.set(userId, {
      id: userId,
      name: username,
      balance: 5000,
      bank: 0,
      lastDaily: 0,
      estates: [],
      portfolio: [],
    });
  }
  return users.get(userId);
}

function getTotalWealth(user) {
  let total = user.balance + user.bank;
  user.estates.forEach(eId => {
    const e = estates.find(x => x.id === eId);
    if (e) total += e.price;
  });
  user.portfolio.forEach(p => {
    const item = marketItems.find(i => i.id === p.id);
    if (item) total += item.price * p.quantity;
  });
  return total;
}

client.on('ready', () => {
  console.log(`✅ البوت متصل باسم: ${client.user.tag}`);
  client.user.setActivity('إمبراطورية الثروة | !help', { type: 3 });
});

// معالجة الأزرار
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton()) return;

  const userId = interaction.user.id;
  const user = initUser(userId, interaction.user.username);
  const [action, dataId] = interaction.customId.split('_');

  if (action === 'buyest') {
    const estate = estates.find(e => e.id === dataId);
    if (!estate) return interaction.reply({ content: '❌ العقار غير متاح!', ephemeral: true });
    
    if (user.estates.includes(dataId)) {
      return interaction.reply({ content: `❌ أنت تمتلك بالفعل **${estate.name}**!`, ephemeral: true });
    }
    
    if (user.balance < estate.price) {
      const need = estate.price - user.balance;
      return interaction.reply({ 
        content: `❌ رصيدك غير كافٍ!\n💰 السعر: **${estate.price.toLocaleString()}** عملة\n💵 معك: **${user.balance.toLocaleString()}** عملة\n📉 تحتاج فقط: **${need.toLocaleString()}** عملة إضافية`, 
        ephemeral: true 
      });
    }
    
    user.balance -= estate.price;
    user.estates.push(dataId);
    
    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle('✅ تم الشراء بنجاح! 🎉')
        .setDescription(`تهانيناً! أصبحت مالك لـ:\n\n**${estate.name}**\n💰 السعر: **${estate.price.toLocaleString()}** عملة\n📈 دخل يومي: +**${estate.income.toLocaleString()}** عملة\n📝 ${estate.desc}\n\nسيتم إضافة الدخل تلقائياً عند استلام راتبك اليومي!`)
        .setTimestamp()
      ]
    });
  }

  if (action === 'buyitem') {
    const item = marketItems.find(i => i.id === dataId);
    if (!item) return interaction.reply({ content: '❌ العنصر غير متاح!', ephemeral: true });
    
    if (user.balance < item.price) {
      const need = item.price - user.balance;
      return interaction.reply({ 
        content: `❌ رصيدك غير كافٍ! تحتاج **${need.toLocaleString()}** عملة إضافية.`, 
        ephemeral: true 
      });
    }
    
    user.balance -= item.price;
    const existing = user.portfolio.find(p => p.id === dataId);
    if (existing) existing.quantity++;
    else user.portfolio.push({ id: dataId, quantity: 1 });
    
    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle('✅ تم الشراء بنجاح! 🎉')
        .setDescription(`🎉 اشتريت: **${item.name}**\n💰 السعر: **${item.price.toLocaleString()}** عملة`)
        .setTimestamp()
      ]
    });
  }
});

client.on('messageCreate', async message => {
  if (message.author.bot) return;
  const content = message.content.trim();
  const userId = message.author.id;
  const user = initUser(userId, message.author.username);
  const prefix = '!';

  if (content === `${prefix}help`) {
    const embed = new EmbedBuilder()
      .setColor('#3498db')
      .setTitle('📖 قائمة الأوامر')
      .addFields(
        { name: '👤 حسابك', value: '`!me` — عرض ملفك الشخصي ورصيدك' },
        { name: '💰 دخل يومي', value: '`!daily` — استلام راتبك اليومي + دخل عقاراتك' },
        { name: '🏦 البنك', value: '`!deposit مبلغ` — إيداع في البنك\n`!withdraw مبلغ` — سحب من البنك' },
        { name: '🏠 العقارات', value: '`!estates` — عرض العقارات المتاحة (اضغط الزر بجانب العنصر للشراء!)' },
        { name: '📦 ممتلكاتك', value: '`!my-estates` — عرض عقاراتك الحالية\n`!portfolio` — محفظتك الاستثمارية' },
        { name: '🛒 السوق', value: '`!market` — سلع استثمارية للشراء' },
        { name: '🏆 التصنيف الأسبوعي', value: '`!top` — قائمة أغنى اللاعبين والألقاب' },
      )
      .setFooter({ text: '💡 نصيحة: كل عنصر بجانبه زر شراء مباشر — فقط اضغط عليه! 🛒' });
    message.channel.send({ embeds: [embed] });
  }

  else if (content === `${prefix}me`) {
    const totalIncome = user.estates.reduce((sum, eId) => {
      const e = estates.find(x => x.id === eId);
      return sum + (e?.income || 0);
    }, 0);
    
    const embed = new EmbedBuilder()
      .setColor('#f1c40f')
      .setAuthor({ name: `${user.name} — ملفك الشخصي`, iconURL: message.author.displayAvatarURL() })
      .addFields(
        { name: '💰 في يدك', value: `${user.balance.toLocaleString()} عملة`, inline: true },
        { name: '🏦 في البنك', value: `${user.bank.toLocaleString()} عملة`, inline: true },
        { name: '📊 ثروة إجمالية', value: `${getTotalWealth(user).toLocaleString()} عملة`, inline: true },
        { name: '🏠 عدد عقاراتك', value: `${user.estates.length} من أصل ${estates.length}`, inline: true },
        { name: '📈 دخل يومي إضافي', value: `+${totalIncome.toLocaleString()} عملة`, inline: true },
      )
      .setTimestamp();
    message.channel.send({ embeds: [embed] });
  }

  else if (content === `${prefix}daily`) {
    const now = Date.now();
    const cooldown = 24 * 60 * 60 * 1000;
    if (now - user.lastDaily < cooldown) {
      const remaining = cooldown - (now - user.lastDaily);
      const hours = Math.floor(remaining / (1000 * 60 * 60));
      const mins = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      return message.reply(`⏱️ عُد بعد **${hours} ساعة و ${mins} دقيقة** لاستلام راتبك التالي!`);
    }
    
    const base = 100;
    const estateIncome = user.estates.reduce((sum, eId) => {
      const e = estates.find(x => x.id === eId);
      return sum + (e?.income || 0);
    }, 0);
    const total = base + estateIncome;
    
    user.balance += total;
    user.lastDaily = now;
    
    message.reply(`✅ تم استلام راتبك اليومي!\n💰 الراتب الأساسي: +${base}\n🏡 دخل العقارات: +${estateIncome}\n📦 **المجموع: +${total.toLocaleString()} عملة**`);
  }

  else if (content.startsWith(`${prefix}deposit `)) {
    const amount = parseInt(content.split(' ')[1]);
    if (!amount || amount <= 0) return message.reply('❌ اكتب المبلغ بشكل صحيح: `!deposit 1000`');
    if (user.balance < amount) return message.reply('❌ رصيدك لا يكفي لهذا المبلغ!');
    user.balance -= amount;
    user.bank += amount;
    message.reply(`✅ تم إيداع **${amount.toLocaleString()}** عملة في البنك!\n💰 في البنك الآن: **${user.bank.toLocaleString()}**`);
  }

  else if (content.startsWith(`${prefix}withdraw `)) {
    const amount = parseInt(content.split(' ')[1]);
    if (!amount || amount <= 0) return message.reply('❌ اكتب المبلغ بشكل صحيح: `!withdraw 1000`');
    if (user.bank < amount) return message.reply('❌ لا يوجد هذا المبلغ في حسابك البنكي!');
    user.bank -= amount;
    user.balance += amount;
    message.reply(`✅ تم سحب **${amount.toLocaleString()}** عملة من البنك!\n💰 معك الآن: **${user.balance.toLocaleString()}**`);
  }

  else if (content === `${prefix}estates`) {
    const embed = new EmbedBuilder()
      .setColor('#9b59b6')
      .setTitle('🏠 العقارات المتاحة للشراء')
      .setDescription('اضغط على الزر بجانب العقار الذي تريد تملكه 👇')
      .setTimestamp();
    
    const rows = [];
    estates.forEach(estate => {
      const owned = user.estates.includes(estate.id);
      embed.addFields({
        name: estate.name,
        value: `💰 السعر: **${estate.price.toLocaleString()}** عملة\n📈 دخل يومي: +**${estate.income.toLocaleString()}** عملة\n📝 ${estate.desc}`,
        inline: false
      });
      
      if (!owned) {
        rows.push(new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`buyest_${estate.id}`)
            .setLabel('🛒 شراء')
            .setStyle(ButtonStyle.Success)
        ));
      } else {
        rows.push(new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel('✅ مُمتلك')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true)
        ));
      }
    });
    
    message.channel.send({ embeds: [embed], components: rows });
  }

  else if (content === `${prefix}my-estates`) {
    if (user.estates.length === 0) {
      return message.reply('❌ أنت لا تمتلك أي عقار حتى الآن! استخدم `!estates` لترى المتاح.');
    }
    const list = user.estates.map(eId => {
      const e = estates.find(x => x.id === eId);
      return `${e.name} — دخل يومي: +${e.income.toLocaleString()} عملة`;
    }).join('\n');
    const totalIncome = user.estates.reduce((sum, eId) => {
      const e = estates.find(x => x.id === eId);
      return sum + (e?.income || 0);
    }, 0);
    message.channel.send(`🏠 **عقاراتك:**\n${list}\n\n📊 **مجموع الدخل اليومي: +${totalIncome.toLocaleString()} عملة**`);
  }

  else if (content === `${prefix}market`) {
    const embed = new EmbedBuilder()
      .setColor('#e74c3c')
      .setTitle('🛒 سوق الاستثمار')
      .setDescription('اضغط على الزر بجانب العنصر الذي تريد استثماره 👇')
      .setTimestamp();
    
    const rows = [];
    marketItems.forEach(item => {
      embed.addFields({
        name: item.name,
        value: `💰 السعر: **${item.price.toLocaleString()}** عملة\n📝 ${item.desc}`,
        inline: false
      });
      
      rows.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`buyitem_${item.id}`)
          .setLabel('🛒 شراء')
          .setStyle(ButtonStyle.Success)
      ));
    });
    
    message.channel.send({ embeds: [embed], components: rows });
  }

  else if (content === `${prefix}portfolio`) {
    if (user.portfolio.length === 0) {
      return message.reply('❌ محفظتك فارغة حالياً! استخدم `!market` لشراء أصول استثمارية.');
    }
    const list = user.portfolio.map(p => {
      const item = marketItems.find(i => i.id === p.id);
      return `${item.name} — الكمية: ${p.quantity} — القيمة: ${(item.price * p.quantity).toLocaleString()} عملة`;
    }).join('\n');
    message.channel.send(`💼 **محفظتك الاستثمارية:**\n${list}`);
  }

  else if (content === `${prefix}top`) {
    const allUsers = Array.from(users.values())
      .map(u => ({ name: u.name, wealth: getTotalWealth(u) }))
      .sort((a, b) => b.wealth - a.wealth)
      .slice(0, 10);
    
    if (allUsers.length === 0) {
      return message.reply('❌ لا يوجد لاعبون مسجلون حتى الآن! كن الأول بـ `!daily`');
    }
    
    let desc = '';
    allUsers.forEach((p, i) => {
      let badge = '';
      if (i === 0) badge = '👑 الإمبراطور';
      else if (i === 1) badge = '🥈 الملياردير';
      else if (i === 2) badge = '🥉 رائد الأعمال';
      desc += `${i+1}. ${p.name} — **${p.wealth.toLocaleString()}** عملة ${badge}\n`;
    });
    
    const embed = new EmbedBuilder()
      .setColor('#f1c40f')
      .setTitle('🏆 التصنيف الأسبوعي لأغنى اللاعبين')
      .setDescription(desc)
      .setFooter({ text: 'يتم تحديث التصنيف تلقائياً بناءً على الثروة الإجمالية' })
      .setTimestamp();
    message.channel.send({ embeds: [embed] });
  }
});

client.login(token);
// 🎮 نظام الأوامر العربية
const PREFIX = '!';

client.on('messageCreate', async message => {
  if (!message.content.startsWith(PREFIX) || message.author.bot) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // 📋 مساعدة
  if (command === 'مساعدة' || command === 'اوامر') {
    return message.reply(`
📋 **قائمة الأوامر:**
!بداية — إنشاء حسابك في اللعبة
!رصيد — معرفة رصيدك الحالي
!يومي — استلام راتبك اليومي
!عقارات — عرض جميع العقارات المتاحة
!شراء — شراء عقار مثال: !شراء مزرعة
!ممتلكات — عرض عقاراتك التي تملكها
!اغنى — قائمة أغنى اللاعبين هذا الأسبوع
    `);
  }

  // 🆕 إنشاء حساب
  if (command === 'بداية' || command === 'تسجيل') {
    if (users.has(message.author.id)) {
      return message.reply('⚠️ لديك حساب بالفعل!');
    }
    users.set(message.author.id, {
      balance: 1000,
      lastDaily: 0,
      estates: [],
      joinDate: Date.now()
    });
    return message.reply('✅ تم إنشاء حسابك بنجاح! رصيدك الأولي: **1000** 💵 اكتب !يومي لاستلام راتبك');
  }

  // 💰 الرصيد
  if (command === 'رصيد') {
    if (!users.has(message.author.id)) {
      return message.reply('⚠️ أنشئ حساباً أولاً بـ: !بداية');
    }
    const user = users.get(message.author.id);
    return message.reply(`💰 رصيدك الحالي: **${user.balance}** 💵`);
  }

  // 📅 الراتب اليومي
  if (command === 'يومي') {
    if (!users.has(message.author.id)) {
      return message.reply('⚠️ أنشئ حساباً أولاً بـ: !بداية');
    }
    const user = users.get(message.author.id);
    const now = Date.now();
    if (now - user.lastDaily < 86400000) {
      return message.reply('⏳ لقد استلمت راتبك اليوم بالفعل! عد غداً الساعة نفسها');
    }
    user.lastDaily = now;
    user.balance += 500;
    return message.reply('✅ تم استلام راتبك اليومي: **+500** 💵 | الرصيد الحالي: ' + user.balance);
  }

  // 🏠 عرض العقارات
  if (command === 'عقارات') {
    let list = '🏠 **العقارات المتاحة:**\n';
    estates.forEach(e => {
      list += `${e.emoji} **${e.name}** — السعر: ${e.price} 💵 | دخل يومي +${e.income}\n`;
    });
    list += '\n💡 للشراء اكتب: !شراء اسم_العقار';
    return message.reply(list);
  }

  // 🛒 شراء عقار
  if (command === 'شراء') {
    if (!users.has(message.author.id)) {
      return message.reply('⚠️ أنشئ حساباً أولاً بـ: !بداية');
    }
    if (args.length === 0) {
      return message.reply('⚠️ اكتب اسم العقار بعد الأمر! مثال: !شراء مزرعة');
    }
    const name = args.join(' ');
    const estate = estates.find(e => e.name === name);
    if (!estate) {
      return message.reply('⚠️ هذا العقار غير موجود! اكتب !عقارات لترى القائمة');
    }
    const user = users.get(message.author.id);
    if (user.balance < estate.price) {
      return message.reply(`❌ رصيدك غير كافٍ! السعر: ${estate.price} 💵 | رصيدك: ${user.balance} 💵`);
    }
    const alreadyOwned = user.estates.find(e => e.name === name);
    if (alreadyOwned) {
      return message.reply('⚠️ أنت تملك هذا العقار بالفعل!');
    }
    user.balance -= estate.price;
    user.estates.push({ ...estate, purchaseDate: Date.now() });
    return message.reply(`✅ تم شراء **${estate.emoji} ${estate.name}** بنجاح!\n💰 خصم: ${estate.price} 💵 | رصيدك المتبقي: ${user.balance} 💵\n📈 ستحصل على +${estate.income} يومياً!`);
  }

  // 📦 ممتلكاتي
  if (command === 'ممتلكات' || command === 'عقاراتي') {
    if (!users.has(message.author.id)) {
      return message.reply('⚠️ أنشئ حساباً أولاً بـ: !بداية');
    }
    const user = users.get(message.author.id);
    if (user.estates.length === 0) {
      return message.reply('📦 أنت لا تملك أي عقار حتى الآن! اكتب !عقارات لترى المتاح');
    }
    let list = '📦 **عقاراتك:**\n';
    let totalIncome = 0;
    user.estates.forEach(e => {
      list += `${e.emoji} ${e.name} — دخل يومي +${e.income}\n`;
      totalIncome += e.income;
    });
    list += `\n📈 إجمالي الدخل اليومي: +${totalIncome} 💵`;
    return message.reply(list);
  }

  // 👑 أغنى اللاعبين
  if (command === 'اغنى' || command === 'الترتيب') {
    if (users.size === 0) {
      return message.reply('⚠️ لا يوجد لاعبين مسجلين حتى الآن! كن الأول بـ !بداية');
    }
    const sorted = Array.from(users.entries())
      .sort((a, b) => b[1].balance - a[1].balance)
      .slice(0, 10);
    
    let list = '🏆 **أغنى 10 لاعبين هذا الأسبوع:**\n';
    sorted.forEach(([id, u], i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '•';
      list += `${medal} المرتبة ${i+1}: **<@${id}>** — ${u.balance} 💵\n`;
    });
    return message.reply(list);
  }
});
// 🎮 دالة استخراج الإيموجي لكل عنصر
function getEmoji(name) {
  const emojis = {
    'مزرعة': '🚜',
    'مكتب تجاري': '🏢',
    'مركز تسوق': '🏬',
    'مصنع': '🏭',
    'محطة وقود': '⛽',
    'مستوصف': '🏥',
    'مدينة ملاهي': '🎡',
    'قصر': '🏰',
    'محطة طاقة': '⚡',
    'برج إداري': '🗼',
    'ذهب': '🥇',
    'فضة': '🥈',
    'أسهم': '📈',
    'عملات رقمية': '🪙',
    'سيارة فاخرة': '🚗',
    'يخت': '⛵',
    'طائرة خاصة': '✈️'
  };
  return emojis[name] || '🏠';
}

// 📦 تقسيم الأزرار لصفوف كل صف 5 أزرار كحد أقصى
function createButtons(items, prefix) {
  const buttons = items.map(item => ({
    type: 2,
    style: 1,
    label: `${getEmoji(item.name)} ${item.name}`,
    custom_id: `${prefix}_${item.name}`
  }));
  
  const rows = [];
  for (let i = 0; i < buttons.length; i += 5) {
    rows.push({
      type: 1,
      components: buttons.slice(i, i + 5)
    });
  }
  return rows;
}

// 📋 تحويل القائمة إلى وصف منظم
function createFields(items) {
  return items.map(e => ({
    name: `${getEmoji(e.name)} ${e.name}`,
    value: `💰 السعر: **${e.price}** 💵\n📈 دخل يومي: +**${e.income}** 💵`,
    inline: false
  }));
}

// 🎮 معالجة الأوامر النصية
const PREFIX = '!';

client.on('messageCreate', async message => {
  if (!message.content.startsWith(PREFIX) || message.author.bot) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // 📋 المساعدة — قائمة الأزرار الرئيسية
  if (command === 'مساعدة' || command === 'اوامر' || command === 'قائمة') {
    return message.reply({
      embeds: [{
        title: '📋 القائمة الرئيسية لإمبراطورية الثروة',
        description: 'اختر من الأزرار أدناه ما تريد فعله، أو اكتب الأمر يدوياً',
        color: 0x9b59b6
      }],
      components: [
        {
          type: 1,
          components: [
            { type: 2, style: 3, label: '💰 رصيدي', custom_id: 'menu_balance' },
            { type: 2, style: 1, label: '📅 يومي', custom_id: 'menu_daily' },
            { type: 2, style: 2, label: '🏠 العقارات', custom_id: 'menu_estates' }
          ]
        },
        {
          type: 1,
          components: [
            { type: 2, style: 1, label: '📦 ممتلكاتي', custom_id: 'menu_my' },
            { type: 2, style: 2, label: '📈 السوق', custom_id: 'menu_market' },
            { type: 2, style: 3, label: '🏆 الأغنى', custom_id: 'menu_top' }
          ]
        }
      ]
    });
  }

  // 🆕 إنشاء حساب
  if (command === 'بداية' || command === 'تسجيل') {
    if (users.has(message.author.id)) {
      return message.reply('⚠️ لديك حساب بالفعل! اكتب `!رصيد` لمعرفة رصيدك');
    }
    users.set(message.author.id, {
      balance: 1000,
      lastDaily: 0,
      estates: [],
      investments: [],
      joinDate: Date.now()
    });
    return message.reply('✅ تم إنشاء حسابك بنجاح! رصيدك الأولي: **1000** 💵\nاكتب `!يومي` لاستلام راتبك اليومي، أو اضغط على الأزرار أعلاه');
  }

  // 💰 الرصيد
  if (command === 'رصيد') {
    if (!users.has(message.author.id)) return message.reply('⚠️ أنشئ حساباً أولاً بـ: `!بداية`');
    const user = users.get(message.author.id);
    return message.reply(`💰 رصيدك الحالي: **${user.balance}** 💵`);
  }

  // 📅 الراتب اليومي
  if (command === 'يومي') {
    if (!users.has(message.author.id)) return message.reply('⚠️ أنشئ حساباً أولاً بـ: `!بداية`');
    const user = users.get(message.author.id);
    const now = Date.now();
    if (now - user.lastDaily < 86400000) {
      return message.reply('⏳ لقد استلمت راتبك اليوم بالفعل! عد غداً الساعة نفسها');
    }
    user.lastDaily = now;
    user.balance += 500;
    return message.reply('✅ تم استلام راتبك اليومي: **+500** 💵 | الرصيد الحالي: ' + user.balance);
  }

  // 🏠 عرض العقارات مع أزرار
  if (command === 'عقارات') {
    return message.reply({
      embeds: [{
        title: '🏠 العقارات المتاحة',
        fields: createFields(estates),
        color: 0x2ecc71,
        footer: { text: 'اضغط على الزر لشراء العقار مباشرة' }
      }],
      components: createButtons(estates, 'buy')
    });
  }

  // 📦 ممتلكاتي
  if (command === 'ممتلكات' || command === 'عقاراتي') {
    if (!users.has(message.author.id)) return message.reply('⚠️ أنشئ حساباً أولاً بـ: `!بداية`');
    const user = users.get(message.author.id);
    if (user.estates.length === 0) {
      return message.reply('📦 أنت لا تملك أي شيء حتى الآن! اكتب `!عقارات` لترى ما يمكنك شراؤه');
    }
    let list = '📦 **ممتلكاتك:**\n';
    let totalIncome = 0;
    user.estates.forEach(e => {
      list += `${getEmoji(e.name)} **${e.name}** — دخل يومي +${e.income} 💵\n`;
      totalIncome += e.income;
    });
    list += `\n📈 إجمالي دخلك اليومي: +**${totalIncome}** 💵`;
    return message.reply(list);
  }

  // 🏆 أغنى اللاعبين
  if (command === 'اغنى' || command === 'الترتيب' || command === 'قائمة') {
    if (users.size === 0) return message.reply('⚠️ لا يوجد لاعبين مسجلين حتى الآن! كن الأول بـ `!بداية`');
    const sorted = Array.from(users.entries())
      .sort((a, b) => b[1].balance - a[1].balance)
      .slice(0, 10);
    
    let list = '🏆 **أغنى 10 لاعبين هذا الأسبوع:**\n\n';
    sorted.forEach(([id, u], i) => {
      const medal = i === 0 ? '👑' : i === 1 ? '🥈' : i === 2 ? '🥉' : '•';
      const title = i === 0 ? ' — الملك 👑' : i === 1 ? ' — الأمير 🥈' : i === 2 ? ' — النبيل 🥉' : '';
      list += `${medal} المرتبة ${i+1}: <@${id}> — **${u.balance}** 💵 ${title}\n`;
    });
    return message.reply(list);
  }
});

// 🎯 معالجة الضغط على جميع الأزرار
client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;

  const customId = interaction.customId;
  const userId = interaction.user.id;

  // 📋 أزرار القائمة الرئيسية
  if (customId.startsWith('menu_')) {
    const action = customId.replace('menu_', '');
    
    if (action === 'balance') {
      if (!users.has(userId)) return interaction.reply({ content: '⚠️ أنشئ حساباً أولاً بـ: `!بداية`', ephemeral: true });
      const user = users.get(userId);
      return interaction.reply({ content: `💰 رصيدك الحالي: **${user.balance}** 💵`, ephemeral: true });
    }
    
    if (action === 'daily') {
      if (!users.has(userId)) return interaction.reply({ content: '⚠️ أنشئ حساباً أولاً بـ: `!بداية`', ephemeral: true });
      const user = users.get(userId);
      const now = Date.now();
      if (now - user.lastDaily < 86400000) {
        return interaction.reply({ content: '⏳ لقد استلمت راتبك اليوم بالفعل! عد غداً', ephemeral: true });
      }
      user.lastDaily = now;
      user.balance += 500;
      return interaction.reply({ content: `✅ تم استلام راتبك اليومي: **+500** 💵`, ephemeral: true });
    }
    
    if (action === 'estates') {
      return interaction.reply({
        embeds: [{
          title: '🏠 العقارات المتاحة',
          fields: createFields(estates),
          color: 0x2ecc71,
          footer: { text: 'اضغط على الزر لشراء' }
        }],
        components: createButtons(estates, 'buy'),
        ephemeral: false
      });
    }
    
    if (action === 'my') {
      if (!users.has(userId)) return interaction.reply({ content: '⚠️ أنشئ حساباً أولاً بـ: `!بداية`', ephemeral: true });
      const user = users.get(userId);
      if (user.estates.length === 0) {
        return interaction.reply({ content: '📦 أنت لا تملك أي شيء حتى الآن!', ephemeral: true });
      }
      let list = '📦 **ممتلكاتك:**\n';
      let totalIncome = 0;
      user.estates.forEach(e => {
        list += `${getEmoji(e.name)} ${e.name} — دخل يومي +${e.income}\n`;
        totalIncome += e.income;
      });
      list += `\n📈 إجمالي الدخل اليومي: +${totalIncome} 💵`;
      return interaction.reply({ content: list, ephemeral: true });
    }
    
    if (action === 'top') {
      if (users.size === 0) return interaction.reply({ content: '⚠️ لا يوجد لاعبين حتى الآن!', ephemeral: true });
      const sorted = Array.from(users.entries())
        .sort((a, b) => b[1].balance - a[1].balance)
        .slice(0, 10);
      let list = '🏆 **أغنى 10 لاعبين:**\n\n';
      sorted.forEach(([id, u], i) => {
        const medal = i === 0 ? '👑' : i === 1 ? '🥈' : i === 2 ? '🥉' : '•';
        list += `${medal} #${i+1}: <@${id}> — ${u.balance} 💵\n`;
      });
      return interaction.reply({ content: list, ephemeral: true });
    }
    
    return;
  }

  // 🛒 زر الشراء — للعقارات وكل شيء
  if (customId.startsWith('buy_')) {
    const itemName = customId.replace('buy_', '');
    
    if (!users.has(userId)) {
      return interaction.reply({ 
        content: '⚠️ أنشئ حساباً أولاً بكتابة: `!بداية`',
        ephemeral: true 
      });
    }
    
    const item = estates.find(e => e.name === itemName);
    if (!item) {
      return interaction.reply({ content: '❌ هذا العنصر غير موجود!', ephemeral: true });
    }
    
    const user = users.get(userId);
    if (user.balance < item.price) {
      return interaction.reply({ 
        content: `❌ رصيدك غير كافٍ!\n💰 السعر: **${item.price}** 💵\n💳 رصيدك: **${user.balance}** 💵`,
        ephemeral: true 
      });
    }
    
    const alreadyOwned = user.estates.find(e => e.name === itemName);
    if (alreadyOwned) {
      return interaction.reply({ content: '⚠️ أنت تملك هذا بالفعل!', ephemeral: true });
    }
    
    user.balance -= item.price;
    user.estates.push({ ...item, purchaseDate: Date.now() });
    
    return interaction.reply({
      content: `✅ تم الشراء بنجاح!\n${getEmoji(item.name)} **${item.name}**\n💰 السعر: ${item.price} 💵\n💳 رصيدك المتبقي: ${user.balance} 💵\n📈 ستحصل على +${item.income} يومياً!`,
      ephemeral: false
    });
  }
});
