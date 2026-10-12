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

// 🏠 قائمة العقارات
const estates = [
  { name: 'مزرعة', price: 80000, income: 800 },
  { name: 'مكتب تجاري', price: 150000, income: 500 },
  { name: 'مركز تسوق', price: 400000, income: 1800 },
  { name: 'مصنع', price: 800000, income: 5000 },
  { name: 'محطة وقود', price: 250000, income: 3000 },
  { name: 'مستوصف', price: 600000, income: 7500 },
  { name: 'مدينة ملاهي', price: 1200000, income: 18000 },
  { name: 'قصر', price: 2000000, income: 25000 },
  { name: 'محطة طاقة', price: 1500000, income: 22000 },
  { name: 'برج إداري', price: 1800000, income: 10000 }
];

// 🎮 دوال مساعدة
function getEmoji(name) {
  const emojis = {
    'مزرعة': '🚜', 'مكتب تجاري': '🏢', 'مركز تسوق': '🏬',
    'مصنع': '🏭', 'محطة وقود': '⛽', 'مستوصف': '🏥',
    'مدينة ملاهي': '🎡', 'قصر': '🏰', 'محطة طاقة': '⚡',
    'برج إداري': '🗼'
  };
  return emojis[name] || '🏠';
}

function createEstateButtons() {
  const buttons = estates.map(e =>
    new ButtonBuilder()
      .setCustomId(`buy_${e.name}`)
      .setLabel(`${getEmoji(e.name)} شراء`)
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
!ممتلكات — عرض ما تملكه
!اغنى — قائمة أغنى اللاعبين
    `);
  }

  if (command === 'بداية') {
    if (users.has(message.author.id)) return message.reply('⚠️ لديك حساب بالفعل!');
    users.set(message.author.id, { balance: 1000, lastDaily: 0, estates: [] });
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
        name: `${getEmoji(e.name)} ${e.name}`,
        value: `السعر: ${e.price} 💵 | دخل يومي +${e.income}`,
        inline: false
      });
    });

    return message.reply({ embeds: [embed], components: createEstateButtons() });
  }

  if (command === 'ممتلكات') {
    if (!users.has(message.author.id)) return message.reply('⚠️ اكتب !بداية أولاً');
    const u = users.get(message.author.id);
    if (u.estates.length === 0) return message.reply('📦 لا تملك شيئاً بعد! اكتب !عقارات للشراء');
    let list = '📦 **ممتلكاتك:**\n';
    let total = 0;
    u.estates.forEach(e => {
      list += `${getEmoji(e.name)} ${e.name} | دخل يومي +${e.income}\n`;
      total += e.income;
    });
    list += `\n📈 إجمالي الدخل اليومي: +${total} 💵`;
    return message.reply(list);
  }

  if (command === 'اغنى') {
    if (users.size === 0) return message.reply('⚠️ لا يوجد لاعبين حتى الآن!');
    const sorted = Array.from(users.entries()).sort((a, b) => b[1].balance - a[1].balance).slice(0, 10);
    let list = '🏆 **أغنى 10 لاعبين:**\n\n';
    sorted.forEach(([id, u], i) => {
      const m = i === 0 ? '👑' : i === 1 ? '🥈' : i === 2 ? '🥉' : '•';
      list += `${m} #${i+1}: <@${id}> — ${u.balance} 💵\n`;
    });
    return message.reply(list);
  }
});

// 🎯 معالجة الضغط على الأزرار
client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;
  if (!interaction.customId.startsWith('buy_')) return;

  const name = interaction.customId.replace('buy_', '');
  const estate = estates.find(e => e.name === name);

  if (!users.has(interaction.user.id)) {
    return interaction.reply({ content: '⚠️ اكتب !بداية أولاً لإنشاء حسابك', ephemeral: true });
  }

  const u = users.get(interaction.user.id);
  
  if (u.balance < estate.price) {
    return interaction.reply({ 
      content: `❌ رصيدك غير كافٍ!\nالمطلوب: ${estate.price} 💵\nمتوفر: ${u.balance} 💵`,
      ephemeral: true 
    });
  }

  if (u.estates.find(e => e.name === name)) {
    return interaction.reply({ content: '⚠️ تملك هذا العقار بالفعل!', ephemeral: true });
  }

  u.balance -= estate.price;
  u.estates.push({ ...estate });

  await interaction.reply(`
✅ **تم الشراء بنجاح!**
${getEmoji(name)} ${name}
💰 خصم: ${estate.price} 💵
💳 رصيدك المتبقي: ${u.balance} 💵
📈 دخل يومي جديد: +${estate.income} 💵
  `);
});

// 🔑 تشغيل البوت
client.login(TOKEN).catch(err => {
  console.error('❌ خطأ في تسجيل الدخول:', err.message);
});
