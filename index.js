const { Client, GatewayIntentBits, Collection, SlashCommandBuilder, ActivityType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('✅ البوت يعمل!');
});

app.listen(PORT, () => {
  console.log(`🌐 الخادم يعمل على المنفذ ${PORT}`);
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ]
});

client.login(process.env.DISCORD_TOKEN)
  .then(() => console.log('✅ البوت متصل بنجاح! 🎉'))
  .catch(err => {
    console.error('❌ خطأ في تسجيل الدخول:', err.message);
    process.exit(1);
  });

client.on('ready', () => {
  console.log(`✅ تم تسجيل الدخول باسم: ${client.user.tag}`);
  client.user.setActivity('إمبراطورية الثروة 💰', { type: ActivityType.Playing });
});

const userData = new Map();

function getUser(id) {
  if (!userData.has(id)) {
    userData.set(id, {
      balance: 1000,
      bank: 0,
      inventory: [],
      investments: {},
      lastDaily: 0,
      lastWeekly: 0
    });
  }
  return userData.get(id);
}

const marketItems = [
  { id: 'gold', name: 'ذهب', icon: '🥇', basePrice: 200, minPrice: 150, maxPrice: 500, change: 0 },
  { id: 'silver', name: 'فضة', icon: '🥈', basePrice: 80, minPrice: 40, maxPrice: 200, change: 0 },
  { id: 'stock_tech', name: 'أسهم تقنية', icon: '📈', basePrice: 150, minPrice: 50, maxPrice: 400, change: 0 },
  { id: 'stock_realestate', name: 'أسهم عقارات', icon: '🏠', basePrice: 120, minPrice: 60, maxPrice: 300, change: 0 },
  { id: 'oil', name: 'نفط', icon: '🛢️', basePrice: 300, minPrice: 100, maxPrice: 600, change: 0 },
  { id: 'crypto', name: 'عملة رقمية', icon: '🪙', basePrice: 500, minPrice: 100, maxPrice: 1500, change: 0 }
];

function updateMarketPrices() {
  marketItems.forEach(item => {
    const changePercent = (Math.random() - 0.5) * 0.2;
    item.change = Math.round(changePercent * 1000) / 10;
    const variation = item.basePrice * (1 + changePercent);
    item.currentPrice = Math.round(Math.max(item.minPrice, Math.min(item.maxPrice, variation)));
  });
}
updateMarketPrices();
setInterval(updateMarketPrices, 30 * 60 * 1000);

const auctions = new Map();
const weeklyRanking = new Map();

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const user = getUser(interaction.user.id);
  const { commandName, options } = interaction;

  // === معلومات عامة ===
  if (commandName === 'حسابي') {
    const embed = new EmbedBuilder()
      .setTitle(`💰 حسابك — ${interaction.user.username}`)
      .setColor('#FFD700')
      .addFields(
        { name: '💵 في الجيب', value: `${user.balance} ريال`, inline: true },
        { name: '🏦 في البنك', value: `${user.bank} ريال`, inline: true },
        { name: '📊 المجموع', value: `${user.balance + user.bank} ريال`, inline: true }
      );
    await interaction.reply({ embeds: [embed] });
  }

  else if (commandName === 'راتب') {
    const now = Date.now();
    if (now - user.lastDaily < 24 * 60 * 60 * 1000) {
      const remaining = Math.ceil((24 * 60 * 60 * 1000 - (now - user.lastDaily)) / (60 * 60 * 1000));
      return await interaction.reply(`⏰ لقد استلمت راتبك اليوم! عُد بعد **${remaining} ساعة**`);
    }
    const amount = Math.floor(Math.random() * 300) + 200;
    user.balance += amount;
    user.lastDaily = now;
    await interaction.reply(`✅ استلمت راتبك اليومي: **${amount} ريال** 💵`);
  }

  else if (commandName === 'بنك') {
    const action = options.getString('إجراء');
    const amount = options.getInteger('المبلغ') || 0;

    if (action === 'إيداع') {
      if (amount <= 0 || amount > user.balance) return await interaction.reply('❌ مبلغ غير صالح!');
      user.balance -= amount;
      user.bank += amount;
      await interaction.reply(`✅ تم إيداع **${amount} ريال** في البنك 🏦`);
    } else if (action === 'سحب') {
      if (amount <= 0 || amount > user.bank) return await interaction.reply('❌ مبلغ غير صالح!');
      user.bank -= amount;
      user.balance += amount;
      await interaction.reply(`✅ تم سحب **${amount} ريال** من البنك 💵`);
    } else if (action === 'معلومات') {
      await interaction.reply(`🏦 رصيدك في البنك: **${user.bank} ريال**`);
    }
  }

  // === السوق والتداول ===
  else if (commandName === 'استثمار') {
    const sub = options.getSubcommand();

    if (sub === 'سوق') {
      updateMarketPrices();
      let desc = '';
      marketItems.forEach(item => {
        const trend = item.change >= 0 ? '📈' : '📉';
        desc += `${item.icon} **${item.name}** — ${item.currentPrice} ريال (${trend} ${item.change >= 0 ? '+' : ''}${item.change}%)\n`;
      });
      const embed = new EmbedBuilder()
        .setTitle('📊 سوق الاستثمار — الأسعار الحالية')
        .setColor('#3498DB')
        .setDescription(desc)
        .setFooter({ text: 'تحدث الأسعار كل 30 دقيقة' });
      await interaction.reply({ embeds: [embed] });
    }

    else if (sub === 'شراء') {
      const itemId = options.getString('العنصر');
      const qty = options.getInteger('الكمية') || 1;
      const item = marketItems.find(i => i.id === itemId);
      if (!item) return await interaction.reply('❌ عنصر غير موجود!');
      const total = item.currentPrice * qty;
      if (user.balance < total) return await interaction.reply(`❌ رصيد غير كافٍ! تحتاج ${total} ريال`);
      
      user.balance -= total;
      if (!user.investments[itemId]) user.investments[itemId] = { qty: 0, totalSpent: 0 };
      user.investments[itemId].qty += qty;
      user.investments[itemId].totalSpent += total;
      
      await interaction.reply(`✅ اشتريت **${qty} × ${item.icon} ${item.name}** بـ **${total} ريال**`);
    }

    else if (sub === 'بيع') {
      const itemId = options.getString('العنصر');
      const qty = options.getInteger('الكمية') || 1;
      const item = marketItems.find(i => i.id === itemId);
      if (!item) return await interaction.reply('❌ عنصر غير موجود!');
      if (!user.investments[itemId] || user.investments[itemId].qty < qty) {
        return await interaction.reply('❌ لا تمتلك هذا العنصر بهذه الكمية!');
      }
      
      const earnings = item.currentPrice * qty;
      user.balance += earnings;
      user.investments[itemId].qty -= qty;
      if (user.investments[itemId].qty === 0) delete user.investments[itemId];
      
      await interaction.reply(`✅ بعت **${qty} × ${item.icon} ${item.name}** بـ **${earnings} ريال**`);
    }

    else if (sub === 'محفظتي') {
      let desc = '📦 محفظتك الاستثمارية:\n\n';
      let hasItems = false;
      for (const [id, data] of Object.entries(user.investments)) {
        if (data.qty <= 0) continue;
        hasItems = true;
        const item = marketItems.find(i => i.id === id);
        const currentValue = item.currentPrice * data.qty;
        const profit = currentValue - data.totalSpent;
        const sign = profit >= 0 ? '+' : '';
        desc += `${item.icon} **${item.name}** — ×${data.qty}\n💰 تكلفة الشراء: ${data.totalSpent} ريال\n📈 القيمة الحالية: ${currentValue} ريال\n💡 الربح/الخسارة: ${sign}${profit} ريال\n\n`;
      }
      if (!hasItems) desc = '📦 محفظتك فارغة! استخدم `/استثمار سوق` لمعرفة الأسعار';
      const embed = new EmbedBuilder()
        .setTitle('💼 محفظتي الاستثمارية')
        .setColor('#9B59B6')
        .setDescription(desc);
      await interaction.reply({ embeds: [embed] });
    }
  }

  // === الألعاب ===
  else if (commandName === 'روليت') {
    const bet = options.getInteger('المبلغ');
    const choice = options.getString('اللون');
    if (bet <= 0 || bet > user.balance) return await interaction.reply('❌ مبلغ الرهان غير صالح!');
    
    user.balance -= bet;
    const result = Math.random();
    let win = false;
    let colorName = '';
    
    if (result < 0.49) { colorName = '🔴 أحمر'; if (choice === 'احمر') win = true; }
    else if (result < 0.98) { colorName = '⚫ أسود'; if (choice === 'اسود') win = true; }
    else { colorName = '🟢 أخضر'; if (choice === 'اخضر') win = true; bet *= 14; }
    
    if (win) {
      user.balance += bet * 2;
      await interaction.reply(`🎡 الروليت توقف على: ${colorName}\n✅ فزت! ربحت **${bet} ريال** 🎉`);
    } else {
      await interaction.reply(`🎡 الروليت توقف على: ${colorName}\n❌ خسرت! حظاً طيباً في المرة القادمة`);
    }
  }

  else if (commandName === 'كنز') {
    const bet = options.getInteger('المبلغ') || 50;
    if (bet <= 0 || bet > user.balance) return await interaction.reply('❌ مبلغ غير صالح!');
    
    user.balance -= bet;
    const chests = ['📦', '📦', '📦', '💎', '💣'];
    const selected = chests[Math.floor(Math.random() * chests.length)];
    
    if (selected === '💎') {
      const prize = bet * 3;
      user.balance += prize;
      await interaction.reply(`🗝️ فتحت الصندوق ووجدت **جوهرة ثمينة!** 💎\n🎉 ربحت **${prize} ريال**!`);
    } else if (selected === '💣') {
      await interaction.reply(`💥 انفجرت بك الصندوق! خسرت **${bet} ريال** 😅`);
    } else {
      const small = Math.floor(bet * 0.5);
      user.balance += small;
      await interaction.reply(`📦 صندوق عادي... استرددت **${small} ريال** فقط`);
    }
  }

  else if (commandName === 'مزاد_سري') {
    const itemTypes = [
      { name: 'قطعة أثرية غامضة', icon: '🏺', minBid: 100, rarity: 'عادية' },
      { name: 'مخطوط قديم', icon: '📜', minBid: 250, rarity: 'نادرة' },
      { name: 'جوهرة أسطورية', icon: '💍', minBid: 500, rarity: 'أسطورية' },
      { name: 'كنز مخفي', icon: '🗺️', minBid: 1000, rarity: 'نادر جداً' }
    ];
    const item = itemTypes[Math.floor(Math.random() * itemTypes.length)];
    const auctionId = Date.now();
    
    auctions.set(auctionId, {
      item: item,
      highestBid: 0,
      highestBidder: null,
      endTime: Date.now() + 60 * 1000
    });
    
    const embed = new EmbedBuilder()
      .setTitle('🌙 مزاد سري جديد!')
      .setColor('#9932CC')
      .setDescription(`يوجد هنا شيء مجهول... قد يكون كنزاً ثميناً وقد يكون مجرد خردة!\n\n**النوع:** ${item.rarity}\n**أقل مزايدة:** ${item.minBid} ريال\n\n⚠️ تنبيه: المزايدة نهائية ولن تُعاد المبالغ!`)
      .setFooter({ text: `معرف المزاد: ${auctionId} — ينتهي بعد دقيقة واحدة` });
    
    await interaction.reply({ embeds: [embed] });
  }

  else if (commandName === 'زايد') {
    const auctionId = options.getInteger('معرف_المزاد');
    const amount = options.getInteger('المبلغ');
    const auction = auctions.get(auctionId);
    
    if (!auction) return await interaction.reply('❌ معرف المزاد غير صالح أو انتهى!');
    if (Date.now() > auction.endTime) return await interaction.reply('⏰ انتهى وقت المزاد!');
    if (amount <= auction.highestBid) return await interaction.reply(`❌ يجب أن تكون مزايدتك أعلى من **${auction.highestBid} ريال**`);
    if (amount < auction.item.minBid) return await interaction.reply(`❌ الحد الأدنى لهذا العنصر: **${auction.item.minBid} ريال**`);
    if (amount > user.balance) return await interaction.reply('❌ رصيدك لا يكفي لهذه المزايدة!');
    
    if (auction.highestBidder) {
      const prevUser = getUser(auction.highestBidder);
      prevUser.balance += auction.highestBid;
    }
    
    user.balance -= amount;
    auction.highestBid = amount;
    auction.highestBidder = interaction.user.id;
    
    await interaction.reply(`✅ ✅ أنت الآن صاحب أعلى مزايدة! **${amount} ريال** على ${auction.item.icon} ؟؟؟`);
  }

  else if (commandName === 'تصنيف_اسبوعي') {
    const now = Date.now();
    const weekStart = new Date().setHours(0, 0, 0, 0) - (new Date().getDay() * 86400000);
    
    weeklyRanking.set(interaction.user.id, {
      name: interaction.user.username,
      totalWealth: user.balance + user.bank
    });
    
    const ranking = Array.from(weeklyRanking.values())
      .sort((a, b) => b.totalWealth - a.totalWealth)
      .slice(0, 10);
    
    let desc = '';
    ranking.forEach((p, i) => {
      let medal = '';
      if (i === 0) medal = '👑';
      else if (i === 1) medal = '🥈';
      else if (i === 2) medal = '🥉';
      else medal = `${i + 1}.`;
      desc += `${medal} **${p.name}** — ${p.totalWealth} ريال\n`;
    });
    
    const embed = new EmbedBuilder()
      .setTitle('🏆 التصنيف الأسبوعي — أغنى اللاعبين')
      .setColor('#FFD700')
      .setDescription(desc || 'لا بيانات حتى الآن! ابدأ بجمع الثروة 💰')
      .setFooter({ text: 'يُعاد التصنيف كل أحد' });
    
    await interaction.reply({ embeds: [embed] });
  }
});

// === تسجيل الأوامر عند تشغيل البوت ===
const { REST, Routes } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('حسابي')
    .setDescription('عرض معلومات حسابك'),
  
  new SlashCommandBuilder()
    .setName('راتب')
    .setDescription('استلام راتبك اليومي'),
  
  new SlashCommandBuilder()
    .setName('بنك')
    .setDescription('إدارة حسابك البنكي')
    .addStringOption(opt =>
      opt.setName('إجراء')
        .setDescription('ما تريد فعله')
        .setRequired(true)
        .addChoices(
          { name: 'إيداع', value: 'إيداع' },
          { name: 'سحب', value: 'سحب' },
          { name: 'معلومات', value: 'معلومات' }
        )
    )
    .addIntegerOption(opt =>
      opt.setName('المبلغ')
        .setDescription('المبلغ بالريال')
    ),
  
  new SlashCommandBuilder()
    .setName('استثمار')
    .setDescription('التداول والاستثمار في الأسواق المالية')
    .addSubcommand(s =>
      s.setName('سوق')
        .setDescription('عرض أسعار السوق الحالية')
    )
    .addSubcommand(s =>
      s.setName('شراء')
        .setDescription('شراء أصل من السوق')
        .addStringOption(opt =>
          opt.setName('العنصر')
            .setDescription('العنصر المراد شراؤه')
            .setRequired(true)
            .addChoices(
              { name: '🥇 ذهب', value: 'gold' },
              { name: '🥈 فضة', value: 'silver' },
              { name: '📈 أسهم تقنية', value: 'stock_tech' },
              { name: '🏠 أسهم عقارات', value: 'stock_realestate' },
              { name: '🛢️ نفط', value: 'oil' },
              { name: '🪙 عملة رقمية', value: 'crypto' }
            )
        )
        .addIntegerOption(opt =>
          opt.setName('الكمية')
            .setDescription('عدد الوحدات')
            .setMinValue(1)
            .setRequired(true)
        )
    )
    .addSubcommand(s =>
      s.setName('بيع')
        .setDescription('بيع أصل تملكه')
        .addStringOption(opt =>
          opt.setName('العنصر')
            .setDescription('العنصر المراد بيعه')
            .setRequired(true)
            .addChoices(
              { name: '🥇 ذهب', value: 'gold' },
              { name: '🥈 فضة', value: 'silver' },
              { name: '📈 أسهم تقنية', value: 'stock_tech' },
              { name: '🏠 أسهم عقارات', value: 'stock_realestate' },
              { name: '🛢️ نفط', value: 'oil' },
              { name: '🪙 عملة رقمية', value: 'crypto' }
            )
        )
        .addIntegerOption(opt =>
          opt.setName('الكمية')
            .setDescription('عدد الوحدات')
            .setMinValue(1)
            .setRequired(true)
        )
    )
    .addSubcommand(s =>
      s.setName('محفظتي')
        .setDescription('عرض محفظتك الاستثمارية')
    ),
  
  new SlashCommandBuilder()
    .setName('روليت')
    .setDescription('لعبة الروليت')
    .addIntegerOption(opt =>
      opt.setName('المبلغ')
        .setDescription('مبلغ الرهان')
        .setMinValue(10)
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('اللون')
        .setDescription('اللون الذي تختاره')
        .setRequired(true)
        .addChoices(
          { name: '🔴 أحمر', value: 'احمر' },
          { name: '⚫ أسود', value: 'اسود' },
          { name: '🟢 أخضر', value: 'اخضر' }
        )
    ),
  
  new SlashCommandBuilder()
    .setName('كنز')
    .setDescription('افتح صندوقاً مجهولاً واربح أو تخسر!')
    .addIntegerOption(opt =>
      opt.setName('المبلغ')
        .setDescription('مبلغ الرهان')
        .setMinValue(10)
        .setMaxValue(500)
        .setRequired(true)
    ),
  
  new SlashCommandBuilder()
    .setName('مزاد_سري')
    .setDescription('ابدأ مزاداً على قطعة مجهولة القيمة'),
  
  new SlashCommandBuilder()
    .setName('زايد')
    .setDescription('قم بمزايدة في مزاد سري جاري')
    .addIntegerOption(opt =>
      opt.setName('معرف_المزاد')
        .setDescription('رقم تعريف المزاد')
        .setRequired(true)
    )
    .addIntegerOption(opt =>
      opt.setName('المبلغ')
        .setDescription('مبلغ مزايدتك')
        .setMinValue(10)
        .setRequired(true)
    ),
  
  new SlashCommandBuilder()
    .setName('تصنيف_اسبوعي')
    .setDescription('عرض قائمة أغنى اللاعبين هذا الأسبوع')
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

client.on('ready', async () => {
  try {
    console.log('🔍 جاري تحديث الأوامر...');
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    console.log('✅ تم تحديث جميع الأوامر بنجاح!');
  } catch (error) {
    console.error('❌ خطأ في تحديث الأوامر:', error);
  }
});
