const { Client, GatewayIntentBits, Collection, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events, EmbedBuilder } = require('discord.js');
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

const estates = [
  { id: 'house_small', name: '🏡 منزل صغير', price: 10000, income: 100, desc: 'منزل مريح لبداية الطريق نحو الثروة' },
  { id: 'house_big', name: '🏠 منزل كبير', price: 50000, income: 600, desc: 'مساحة واسعة وعائلة سعيدة' },
  { id: 'apartment', name: '🏢 شقة فاخرة', price: 150000, income: 2000, desc: 'إطلالة رائعة في قلب المدينة' },
  { id: 'villa', name: '🏘️ فيلا', price: 500000, income: 8000, desc: 'مساحتك الخاصة مع حديقة ومسبح' },
  { id: 'tower', name: '🗼 برج سكني', price: 2000000, income: 35000, desc: 'أنت مالك البرج! دخل ثابت كل يوم' },
  { id: 'island', name: '🏝️ جزيرة خاصة', price: 10000000, income: 200000, desc: 'قمة النجاح! جزيرتك الخاصة في المحيط' },
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
      dailyUsed: false,
      lastDaily: 0,
      estates: [],
      portfolio: [],
    });
  }
  return users.get(userId);
}

function getTotalWealth(user) {
  let total = user.balance + user.bank;
  user.estates.forEach(e => total += estates.find(es => es.id === e)?.price || 0);
  user.portfolio.forEach(p => {
    const item = marketItems.find(m => m.id === p.id);
    if (item) total += item.price * p.quantity;
  });
  return total;
}

client.on('ready', () => {
  console.log(`✅ البوت متصل باسم: ${client.user.tag}`);
  client.user.setActivity('إمبراطورية الثروة | !help', { type: 3 });
});

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
      return interaction.reply({ content: `❌ رصيدك غير كافٍ! تحتاج **${need.toLocaleString()}** عملة إضافية.`, ephemeral: true });
    }
    
    user.balance -= estate.price;
    user.estates.push(dataId);
    
    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle('✅ تم الشراء بنجاح!')
        .setDescription(`🎉 تهانيناً! لقد اشتريت:\n**${estate.name}**\n\n💰 السعر: ${estate.price.toLocaleString()} عملة\n📈 دخل يومي: +${estate.income.toLocaleString()} عملة\n\nسيتم إضافة الدخل تلقائياً عند استلام راتبك اليومي!`)
        .setTimestamp()
      ]
    });
  }

  if (action === 'buyitem') {
    const item = marketItems.find(i => i.id === dataId);
    if (!item) return interaction.reply({ content: '❌ العنصر غير متاح!', ephemeral: true });
    
    if (user.balance < item.price) {
      const need = item.price - item.price;
      return interaction.reply({ content: `❌ رصيدك غير كافٍ! تحتاج **${need.toLocaleString()}** عملة إضافية.`, ephemeral: true });
    }
    
    user.balance -= item.price;
    const existing = user.portfolio.find(p => p.id === dataId);
    if (existing) existing.quantity++;
    else user.portfolio.push({ id: dataId, quantity: 1 });
    
    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle('✅ تم الشراء بنجاح!')
        .setDescription(`🎉 اشتريت: **${item.name}**\n💰 السعر: ${item.price.toLocaleString()} عملة`)
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
        { name: '🏠 العقارات', value: '`!estates` — عرض العقارات المتاحة للشراء' },
        { name: '📦 ممتلكاتك', value: '`!my-estates` — عرض عقاراتك الحالية\n`!portfolio` — محفظتك الاستثمارية' },
        { name: '🛒 السوق', value: '`!market` — سلع استثمارية للشراء' },
        { name: '🏆 التصنيف الأسبوعي', value: '`!top` — قائمة أغنى اللاعبين والألقاب الأسبوعية' },
      )
      .setFooter({ text: '💡 نصيحة: كل عنصر بجانبه زر شراء مباشر ✅' });
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
        { name: '🏠 عقاراتك', value: user.estates.length > 0 ? user.estates.map(e => estates.find(x => x.id === e)?.name).join('\n') : 'لا تمتلك أي عقار بعد', inline: true },
        { name: '📈 دخل يومي إضافي', value: `+${totalIncome.toLocaleString()} عملة من عقاراتك`, inline: true },
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
        value: `💰 السعر: **${estate.price.toLocaleString()}** عملة\n📈 دخل يومي: +${estate.income.toLocaleString()}\n📝 ${estate.desc}`,
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
      return `${e.name} — دخل يومي: +${e.income.toLocaleString()}`;
    }).join('\n');
    const totalIncome = user.estates.reduce((sum, eId) => {
      const e = estates.find(x => x.id === eId);
      return sum + (e?.income || 0);
    }, 0);
    message.channel.send(`🏠 **عقاراتك:**\n${list}\n\n📊 **مجموع الدخل اليومي من العقارات: +${totalIncome.toLocaleString()} عملة**`);
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
      if (i === 0) badge = '👑 الأغنى — لقب: 🟢 الإمبراطور';
      else if (i === 1) badge = '🥈 الثاني — لقب: 🟡 الملياردير';
      else if (i === 2) badge = '🥉 الثالث — لقب: 🔵 رائد الأعمال';
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
