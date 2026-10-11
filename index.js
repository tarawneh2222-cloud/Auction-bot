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

client.login(process.env.TOKEN);
