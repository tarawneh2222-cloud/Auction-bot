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
// 🎮 نظام الألعاب الإضافية
const cooldowns = new Map();

// 🎰 لعبة الروليت
client.on('messageCreate', async message => {
  if (!message.content.startsWith(PREFIX) || message.author.bot) return;
  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();
  const userId = message.author.id;

  if (cmd === 'روليت') {
    if (!users.has(userId)) return message.reply('⚠️ اكتب !بداية أولاً');
    
    const now = Date.now();
    if (cooldowns.get(`r_${userId}`) && now - cooldowns.get(`r_${userId}`) < 60000) {
      return message.reply('⏳ انتظر دقيقة قبل الروليت مرة أخرى!');
    }
    
    const amount = parseInt(args[0]);
    const u = users.get(userId);
    if (!amount || amount <= 0) return message.reply('❌ اكتب المبلغ بشكل صحيح: !روليت 500');
    if (u.balance < amount) return message.reply('❌ رصيدك غير كافٍ!');
    
    cooldowns.set(`r_${userId}`, now);
    const win = Math.random() >= 0.5;
    
    if (win) {
      u.balance += amount;
      message.reply(`
🎰 الروليت تدور...
🟢 فزت! مبروك 🎉
💰 ربحت: +${amount} 💵
💳 رصيدك الجديد: ${u.balance} 💵
      `);
    } else {
      u.balance -= amount;
      message.reply(`
🎰 الروليت تدور...
🔴 خسرت 😔
💰 خسرت: -${amount} 💵
💳 رصيدك الجديد: ${u.balance} 💵
      `);
    }
  }

  // 📦 لعبة صناديق الكنز
  if (cmd === 'صناديق') {
    if (!users.has(userId)) return message.reply('⚠️ اكتب !بداية أولاً');
    
    const now = Date.now();
    if (cooldowns.get(`c_${userId}`) && now - cooldowns.get(`c_${userId}`) < 3600000) {
      return message.reply('⏳ العودة للصناديق بعد ساعة فقط!');
    }
    
    cooldowns.set(`c_${userId}`, now);
    const u = users.get(userId);
    const prizes = [
      { text: '💎 جوهرة نادرة!', value: 5000, rare: true },
      { text: '💰 كيس ذهب', value: 1500 },
      { text: '🪙 عملات قديمة', value: 300 },
      { text: '📝 صندوق فارغ', value: 0 },
      { text: '💵 حقيبة نقود', value: 800 }
    ];
    const prize = prizes[Math.floor(Math.random() * prizes.length)];
    u.balance += prize.value;
    
    let msg = `📦 فتحت الصندوق ووجدت:\n\n${prize.text}`;
    if (prize.value > 0) msg += `\n\n✅ ربح: +${prize.value} 💵`;
    else msg += '\n\n😔 لا بأس، حظاً أوفر في المرة القادمة!';
    msg += `\n💳 رصيدك: ${u.balance} 💵`;
    
    message.reply(msg);
  }

  // 🔮 لعبة حجر الحظ
  if (cmd === 'حظ') {
    if (!users.has(userId)) return message.reply('⚠️ اكتب !بداية أولاً');
    
    const now = Date.now();
    if (cooldowns.get(`l_${userId}`) && now - cooldowns.get(`l_${userId}`) < 86400000) {
      return message.reply('⏳ يمكنك معرفة حظك مرة واحدة كل يوم فقط!');
    }
    
    cooldowns.set(`l_${userId}`, now);
    const u = users.get(userId);
    const luck = Math.random();
    let result = '';
    
    if (luck > 0.95) {
      u.balance += 3000;
      result = `🌟 حظك ممتاز جداً اليوم!\n💰 هدية الحظ: +3000 💵`;
    } else if (luck > 0.7) {
      u.balance += 500;
      result = `✨ يوم جيد ومبشر!\n💰 هدية الحظ: +500 💵`;
    } else if (luck > 0.3) {
      result = `😌 يوم عادي، استمر في عملك!`;
    } else {
      const loss = Math.min(u.balance, 50);
      u.balance -= loss;
      result = `😅 حظ عاثر قليلاً...\n💰 خسارة بسيطة: -${loss} 💵`;
    }
    
    message.reply(`
🔮 قرأت لك حجر الحظ:

${result}
💳 رصيدك الحالي: ${u.balance} 💵
    `);
  }
});
// ==============================================
// 🎮 الألعاب التفاعلية الإضافية
// ==============================================
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const gameCooldowns = new Map();

// --- بيانات اللعبة المشتركة ---
function getCooldown(key, id, ms) {
  const now = Date.now();
  const fullKey = `${key}_${id}`;
  if (gameCooldowns.get(fullKey) && now - gameCooldowns.get(fullKey) < ms) {
    return Math.ceil((ms - (now - gameCooldowns.get(fullKey))) / 1000);
  }
  gameCooldowns.set(fullKey, now);
  return 0;
}

// ==============================================
// 🏎️ اللعبة 1: سباق السيارات
// ==============================================
const races = new Map();

client.on('messageCreate', async message => {
  if (!message.content.startsWith(PREFIX) || message.author.bot) return;
  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();
  const userId = message.author.id;

  if (cmd === 'سباق') {
    if (!users.has(userId)) return message.reply('⚠️ اكتب `!بداية` أولاً لإنشاء حسابك!');
    
    const cd = getCooldown('race', userId, 120000);
    if (cd > 0) return message.reply(`⏳ انتظر ${cd} ثانية قبل بدء سباق آخر!`);

    const raceId = Date.now();
    races.set(raceId, {
      players: [],
      started: false,
      channelId: message.channel.id,
      creatorId: userId
    });

    const joinBtn = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`race_join_${raceId}`)
        .setLabel('🏁 انضم للسباق')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`race_start_${raceId}`)
        .setLabel('🚀 ابدأ السباق')
        .setStyle(ButtonStyle.Primary)
    );

    const embed = new EmbedBuilder()
      .setTitle('🏎️ سباق السيارات')
      .setDescription('اضغط على الزر للانضمام!\nينضم أي عدد من اللاعبين، ثم اضغط "ابدأ السباق"')
      .setColor(0x3498db)
      .setFooter({ text: `المنشئ: ${message.author.username}` });

    await message.reply({ embeds: [embed], components: [joinBtn] });

    setTimeout(() => {
      if (races.has(raceId) && !races.get(raceId).started) {
        races.delete(raceId);
        message.channel.send('⏳ انتهى وقت التسجيل في السباق! ابدأ سباقاً جديداً.');
      }
    }, 120000);
  }
});

// معالج أحداث السباق
client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;
  const customId = interaction.customId;

  // 🏁 انضمام للسباق
  if (customId.startsWith('race_join_')) {
    const raceId = parseInt(customId.split('_')[2]);
    if (!races.has(raceId)) return interaction.reply({ content: '❌ السباق غير موجود!', ephemeral: true });
    
    const race = races.get(raceId);
    if (race.started) return interaction.reply({ content: '❌ بدأ السباق بالفعل!', ephemeral: true });
    if (race.players.find(p => p.id === interaction.user.id)) {
      return interaction.reply({ content: '✅ أنت بالفعل في السباق!', ephemeral: true });
    }

    race.players.push({
      id: interaction.user.id,
      name: interaction.user.username,
      position: 0,
      emoji: ['🏎️', '🚗', '🚙', '🚕', '🏁'][Math.floor(Math.random() * 5)]
    });

    await interaction.reply({
      content: `✅ انضممت للسباق بنجاح! ${race.players.length} مشاركين حتى الآن`,
      ephemeral: true
    });
  }

  // 🚀 بدء السباق
  if (customId.startsWith('race_start_')) {
    const raceId = parseInt(customId.split('_')[2]);
    if (!races.has(raceId)) return interaction.reply({ content: '❌ السباق غير موجود!', ephemeral: true });
    
    const race = races.get(raceId);
    if (race.creatorId !== interaction.user.id) {
      return interaction.reply({ content: '❌ فقط منشئ السباق يمكنه تشغيله!', ephemeral: true });
    }
    if (race.players.length < 1) {
      return interaction.reply({ content: '❌ يجب أن ينضم لاعب واحد على الأقل!', ephemeral: true });
    }

    race.started = true;
    await interaction.update({ content: '🏁 بدأ السباق!', components: [] });

    // تشغيل السباق
    const goal = 20;
    let winner = null;
    
    while (!winner) {
      let display = '🏁 السباق جارٍ...\n\n';
      for (const p of race.players) {
        const move = Math.random() >= 0.3 ? Math.floor(Math.random() * 3) + 1 : 0;
        p.position = Math.min(goal, p.position + move);
        const track = '█'.repeat(p.position) + '░'.repeat(goal - p.position);
        display += `${p.emoji} **${p.name}**\n${track} ${p.position}/${goal}\n\n`;
        
        if (p.position >= goal && !winner) winner = p;
      }
      
      const msg = await interaction.channel.send(display);
      await new Promise(res => setTimeout(res, 800));
      await msg.delete().catch(() => {});
    }

    // إعلان النتيجة
    const prize = race.players.length * 150;
    if (!users.has(winner.id)) users.set(winner.id, { balance: 0 });
    const u = users.get(winner.id);
    u.balance = (u.balance || 0) + prize;

    const resultEmbed = new EmbedBuilder()
      .setTitle('🏆 انتهى السباق!')
      .setDescription(`🎉 الفائز هو: **${winner.emoji} ${winner.name}**\n💰 الجائزة: +${prize} 💵`)
      .setColor(0xf1c40f);
    
    await interaction.channel.send({ embeds: [resultEmbed] });
    races.delete(raceId);
  }
});

// ==============================================
// ⚔️ اللعبة 2: معركة الحظ
// ==============================================
const battles = new Map();

client.on('messageCreate', async message => {
  if (!message.content.startsWith(PREFIX) || message.author.bot) return;
  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();
  const userId = message.author.id;

  if (cmd === 'تحدي' && message.mentions.users.size > 0) {
    if (!users.has(userId)) return message.reply('⚠️ اكتب `!بداية` أولاً!');
    
    const targetUser = message.mentions.users.first();
    if (targetUser.id === userId) return message.reply('❌ لا يمكنك تحدي نفسك!');
    
    const battleId = Date.now();
    battles.set(battleId, {
      p1: { id: userId, name: message.author.username, choice: null },
      p2: { id: targetUser.id, name: targetUser.username, choice: null },
      bet: 200,
      channelId: message.channel.id
    });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`battle_accept_${battleId}`)
        .setLabel('✅ اقبل التحدي')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`battle_decline_${battleId}`)
        .setLabel('❌ ارفض')
        .setStyle(ButtonStyle.Danger)
    );

    await message.reply({
      content: `⚔️ **${message.author.username}** يتحدى **${targetUser.username}**!\nالمبلغ المراهن: 200 💵`,
      components: [row]
    });

    setTimeout(() => {
      if (battles.has(battleId)) {
        battles.delete(battleId);
        message.channel.send(`⏳ انتهت مهلة التحدي!`);
      }
    }, 60000);
  }
});

// معالج أحداث المعركة
client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;
  const customId = interaction.customId;

  if (customId.startsWith('battle_accept_')) {
    const battleId = parseInt(customId.split('_')[2]);
    if (!battles.has(battleId)) return interaction.reply({ content: '❌ التحدي غير موجود!', ephemeral: true });
    
    const battle = battles.get(battleId);
    if (battle.p2.id !== interaction.user.id) {
      return interaction.reply({ content: '❌ هذا التحدي ليس لك!', ephemeral: true });
    }

    if (!users.has(battle.p1.id)) users.set(battle.p1.id, { balance: 500 });
    if (!users.has(battle.p2.id)) users.set(battle.p2.id, { balance: 500 });
    
    const u1 = users.get(battle.p1.id);
    const u2 = users.get(battle.p2.id);
    
    if (u1.balance < battle.bet || u2.balance < battle.bet) {
      battles.delete(battleId);
      return interaction.reply({ content: '❌ أحد اللاعبين لا يملك رصيداً كافياً!', ephemeral: true });
    }

    battle.started = true;
    await interaction.update({
      content: `⚔️ المعركة تبدأ الآن!\nاختر حركتك من القائمة أسفل الرسالة:`,
      components: []
    });

    // إرسال أزرار الاختيار لكلا اللاعبين
    const choicesRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`battle_choice_${battleId}_attack`).setLabel('⚔️ هجوم').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`battle_choice_${battleId}_defend`).setLabel('🛡️ دفاع').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`battle_choice_${battleId}_special`).setLabel('✨ ضربة قوية').setStyle(ButtonStyle.Success)
    );

    await interaction.channel.send({
      content: `**${battle.p1.name}** و **${battle.p2.name}** — اختر حركتك!`,
      components: [choicesRow]
    });
  }

  if (customId.startsWith('battle_decline_')) {
    const battleId = parseInt(customId.split('_')[2]);
    if (!battles.has(battleId)) return interaction.reply({ content: '❌ التحدي غير موجود!', ephemeral: true });
    const battle = battles.get(battleId);
    await interaction.update({ content: `❌ رفض **${battle.p2.name}** التحدي.`, components: [] });
    battles.delete(battleId);
  }

  if (customId.startsWith('battle_choice_')) {
    const [, , battleId, choice] = customId.split('_');
    const id = parseInt(battleId);
    if (!battles.has(id)) return interaction.reply({ content: '❌ المعركة انتهت!', ephemeral: true });
    
    const battle = battles.get(id);
    if (battle.p1.id === interaction.user.id) battle.p1.choice = choice;
    else if (battle.p2.id === interaction.user.id) battle.p2.choice = choice;
    else return interaction.reply({ content: '❌ لست مشاركاً في هذه المعركة!', ephemeral: true });

    await interaction.reply({
      content: `✅ اخترت: ${{ attack:'⚔️ هجوم', defend:'🛡️ دفاع', special:'✨ ضربة قوية' }[choice]}`,
      ephemeral: true
    });

    // انتظار اختيار الطرف الآخر
    if (battle.p1.choice && battle.p2.choice) {
      await resolveBattle(battle, interaction);
    }
  }
});

async function resolveBattle(battle, interaction) {
  const p1c = battle.p1.choice;
  const p2c = battle.p2.choice;
  const bet = battle.bet;
  
  let result = '';
  let winnerId = null, loserId = null;
  
  const beats = {
    attack: 'defend',
    defend: 'special',
    special: 'attack'
  };
  
  const p1Emoji = { attack:'⚔️', defend:'🛡️', special:'✨' }[p1c];
  const p2Emoji = { attack:'⚔️', defend:'🛡️', special:'✨' }[p2c];
  
  if (p1c === p2c) {
    result = `🤝 تعادل!\n\n**${battle.p1.name}**: ${p1Emoji}\n**${battle.p2.name}**: ${p2Emoji}\n\nلا أحد يخسر شيئاً!`;
  } else if (beats[p1c] === p2c) {
    winnerId = battle.p1.id;
    loserId = battle.p2.id;
    result = `🏆 فاز **${battle.p1.name}**!\n\n**${battle.p1.name}**: ${p1Emoji}\n**${battle.p2.name}**: ${p2Emoji}\n\n💰 الربح: +${bet} 💵`;
  } else {
    winnerId = battle.p2.id;
    loserId = battle.p1.id;
    result = `🏆 فاز **${battle.p2.name}**!\n\n**${battle.p1.name}**: ${p1Emoji}\n**${battle.p2.name}**: ${p2Emoji}\n\n💰 الربح: +${bet} 💵`;
  }
  
  if (winnerId && loserId) {
    const wBal = users.get(winnerId);
    const lBal = users.get(loserId);
    wBal.balance += bet;
    lBal.balance -= bet;
  }
  
  const embed = new EmbedBuilder()
    .setTitle('⚔️ نتيجة المعركة')
    .setDescription(result)
    .setColor(winnerId ? 0x2ecc71 : 0x95a5a6);
  
  await interaction.channel.send({ embeds: [embed] });
  battles.delete(parseInt(battle.battleId));
}

// ==============================================
// 🗺️ اللعبة 3: اصطياد الكنز الخفي
// ==============================================
client.on('messageCreate', async message => {
  if (!message.content.startsWith(PREFIX) || message.author.bot) return;
  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();
  const userId = message.author.id;

  if (cmd === 'كنز') {
    if (!users.has(userId)) return message.reply('⚠️ اكتب `!بداية` أولاً!');
    
    const cd = getCooldown('treasure', userId, 1800000);
    if (cd > 0) return message.reply(`⏳ يمكنك البحث عن كنز بعد ${Math.ceil(cd/60)} دقيقة!`);

    const treasureId = Date.now();
    const areas = ['غابة 🌲', 'كهف 🕳️', 'نهر 🌊', 'قمة ⛰️'];
    
    const row = new ActionRowBuilder().addComponents(
      areas.map((a, i) => 
        new ButtonBuilder()
          .setCustomId(`treasure_${treasureId}_${i}`)
          .setLabel(a)
          .setStyle(ButtonStyle.Secondary)
      )
    );

    const embed = new EmbedBuilder()
      .setTitle('🗺️ خريطة الكنز')
      .setDescription('اختر منطقة للبحث عن الكنز المخفي!\nلديك **3 محاولات فقط** ⏳')
      .setColor(0xd4af37)
      .setFooter({ text: 'اختر بحكمة! بعض المناطق تحمل مفاجآت سارة وبعضها مخادعة ⚠️' });

    await message.reply({ embeds: [embed], components: [row] });
    
    // حفظ بيانات اللعبة
    client.treasureGame = client.treasureGame || new Map();
    client.treasureGame.set(treasureId, {
      userId,
      attempts: 3,
      found: false,
      prize: Math.random() > 0.85 ? 3000 : Math.random() > 0.5 ? 800 : 150,
      correctArea: Math.floor(Math.random() * 4)
    });
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;
  const customId = interaction.customId;
  
  if (customId.startsWith('treasure_')) {
    const [, tid, areaIdx] = customId.split('_');
    const gameId = parseInt(tid);
    const chosenArea = parseInt(areaIdx);
    
    if (!client.treasureGame?.has(gameId)) {
      return interaction.reply({ content: '❌ انتهت اللعبة أو غير موجودة!', ephemeral: true });
    }
    
    const game = client.treasureGame.get(gameId);
    if (game.userId !== interaction.user.id) {
      return interaction.reply({ content: '❌ هذه ليست خريطتك!', ephemeral: true });
    }
    if (game.found) {
      return interaction.reply({ content: '✅ تم العثور على الكنز بالفعل في هذه اللعبة!', ephemeral: true });
    }
    
    game.attempts--;
    
    const areaNames = ['الغابة 🌲', 'الكهف 🕳️', 'النهر 🌊', 'القمة ⛰️'];
    
    if (chosenArea === game.correctArea) {
      game.found = true;
      if (!users.has(game.userId)) users.set(game.userId, { balance: 0 });
      const u = users.get(game.userId);
      u.balance += game.prize;
      
      const embed = new EmbedBuilder()
        .setTitle('💎 وجدت الكنز!')
        .setDescription(`في **${areaNames[chosenArea]}** وجدت كنزاً ثميناً!\n💰 الجائزة: +${game.prize} 💵`)
        .setColor(0xf1c40f);
      
      await interaction.reply({ embeds: [embed] });
      client.treasureGame.delete(gameId);
    } else {
      let hint = '';
      if (game.attempts > 0) {
        hint = `\n\n💡 تلميح: الكنز ليس في هذا المكان! تبقى لديك **${game.attempts} محاولات**`;
      } else {
        hint = '\n\n😔 انتهت محاولاتك ولم تجد الكنز... حظاً أوفر في المرة القادمة!';
        client.treasureGame.delete(gameId);
      }
      
      await interaction.reply({
        content: `🔍 بحثت في **${areaNames[chosenArea]}** ولم تجد شيئاً!${hint}`,
        ephemeral: game.attempts > 0
      });
    }
  }
});

// ==============================================
// 🏷️ اللعبة 4: ما هو السعر؟
// ==============================================
const priceGames = new Map();
const items = [
  { name: 'ساعة ذكية', emoji: '⌚', min: 100, max: 500, img: '📱' },
  { name: 'سيارة رياضية', emoji: '🏎️', min: 5000, max: 20000, img: '🚗' },
  { name: 'منزل عصري', emoji: '🏠', min: 50000, max: 150000, img: '🏘️' },
  { name: 'جوهرة نادرة', emoji: '💎', min: 10000, max: 50000, img: '✨' },
  { name: 'مزرعة حيوانات', emoji: '🐄', min: 8000, max: 25000, img: '🌾' },
  { name: 'حقيبة سفر فاخرة', emoji: '🧳', min: 200, max: 800, img: '👜' }
];

client.on('messageCreate', async message => {
  if (!message.content.startsWith(PREFIX) || message.author.bot) return;
  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();
  const userId = message.author.id;

  if (cmd === 'سعر') {
    if (!users.has(userId)) return message.reply('⚠️ اكتب `!بداية` أولاً!');
    
    const cd = getCooldown('price', userId, 60000);
    if (cd > 0) return message.reply(`⏳ انتظر ${cd} ثانية قبل لعبة سعر أخرى!`);

    const item = items[Math.floor(Math.random() * items.length)];
    const actualPrice = Math.floor(Math.random() * (item.max - item.min)) + item.min;
    const gameId = Date.now();
    
    priceGames.set(gameId, {
      actualPrice,
      item,
      guesses: new Map(),
      channelId: message.channel.id,
      hostId: message.author.id
    });

    const embed = new EmbedBuilder()
      .setTitle('🏷️ ما هو السعر؟')
      .setDescription(`
${item.emoji} **السلعة: ${item.name}**

💡 النطاق: بين **${item.min}** و **${item.max}** عملة

اكتب برقم في الدردشة لتخمين السعر الحقيقي!
أقرب تخمين يفوز بـ 5% من السعر الحقيقي! 🎉
      `)
      .setColor(0x9b59b6)
      .setFooter({ text: 'لديك دقيقة واحدة فقط للتفكير! ⏳' });

    await message.reply({ embeds: [embed] });

    setTimeout(() => {
      if (!priceGames.has(gameId)) return;
      const game = priceGames.get(gameId);
      
      if (game.guesses.size === 0) {
        message.channel.send('⏳ انتهى الوقت ولم يخمن أحد! حظاً أوفر المرة القادمة 😊');
        priceGames.delete(gameId);
        return;
      }
      
      // تحديد الفائز
      let closest = null;
      let minDiff = Infinity;
      for (const [gUserId, guess] of game.guesses) {
        const diff = Math.abs(guess - game.actualPrice);
        if (diff < minDiff) {
          minDiff = diff;
          closest = { id: gUserId, guess };
        }
      }
      
      const prize = Math.floor(game.actualPrice * 0.05);
      if (!users.has(closest.id)) users.set(closest.id, { balance: 0 });
      const u = users.get(closest.id);
      u.balance += prize;
      
      const winnerEmbed = new EmbedBuilder()
        .setTitle('⏰ انتهى الوقت!')
        .setDescription(`
💰 السعر الحقيقي لـ **${game.item.name}**: **${game.actualPrice}** 💵

🏆 الفائز: **<@${closest.id}>** — تخمينك: ${closest.guess}
💰 الربح: +${prize} 💵

جميع التخمينات:
${Array.from(game.guesses).map(([id, g]) => `<@${id}>: ${g}`).join('\n')}
        `)
        .setColor(0x2ecc71);
      
      message.channel.send({ embeds: [winnerEmbed] });
      priceGames.delete(gameId);
    }, 60000);
  }
  
  // استقبال التخمينات
  const num = parseInt(message.content);
  if (!isNaN(num) && num > 0 && num < 1000000) {
    for (const [gid, game] of priceGames) {
      if (game.channelId === message.channel.id && 
          Date.now() - gid < 60000 && 
          !game.guesses.has(message.author.id)) {
        game.guesses.set(message.author.id, num);
        await message.react('✅');
        break;
      }
    }
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
