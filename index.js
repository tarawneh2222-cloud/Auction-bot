'use strict';

require('dotenv').config();

const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events
} = require('discord.js');

// === خادم ويب لـ Render ===
const web = express();
web.get('/', (_req, res) => res.status(200).send('✅ بوت المزادات والنظام الاقتصادي يعمل — استخدم !قائمة للبدء'));
web.listen(Number(process.env.PORT) || 3000, '0.0.0.0');

// === مسار ملف البيانات ===
const DATA_FILE = path.join(__dirname, 'data.json');

// === قراءة وحفظ البيانات ===
function initData() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({
      users: {},
      auctions: {},
      market: { prices: { gold: 125.50, silver: 45.20, oil: 78.30 } },
      trades: {},
      missions: {},
      inventory: {}
    }, null, 2));
  }
}

function readData() {
  initData();
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return { users: {}, auctions: {}, market: {}, trades: {}, missions: {}, inventory: {} };
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// === إعداد البوت ===
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// === عند جاهزية البوت ===
client.once(Events.ClientReady, () => {
  console.log(`✅ بوت النظام الاقتصادي جاهز — ${client.user.tag}`);
  console.log('✅ استخدم !قائمة لعرض القائمة الرئيسية');
});

// === معالجة الأزرار التفاعلية ===
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton()) return;
  
  const data = readData();
  const userId = interaction.user.id;
  const [action, param1, param2] = interaction.customId.split(':');

  // التأكد من وجود المستخدم
  if (!data.users[userId]) {
    data.users[userId] = {
      balance: 1000,
      level: 1,
      exp: 0,
      inventory: [],
      lastDaily: null,
      lastWork: null,
      lastRobbery: null,
      createdAt: new Date().toISOString()
    };
    saveData(data);
  }
  const user = data.users[userId];

  try {
    switch (action) {
      // --- قائمة رئيسية والتنقل ---
      case 'menu_home':
        await interaction.update({ embeds: [getMainMenuEmbed()], components: getMainMenuButtons() });
        break;
      
      case 'menu_account':
        await interaction.update({ embeds: [getAccountEmbed(user)], components: getAccountButtons() });
        break;
      
      case 'menu_market':
        await interaction.update({ embeds: [getMarketEmbed(data)], components: getMarketButtons() });
        break;
      
      case 'menu_trade':
        await interaction.update({ embeds: [getTradeEmbed(userId, data)], components: getTradeButtons() });
        break;
      
      case 'menu_missions':
        await interaction.update({ embeds: [getMissionsEmbed(user, data)], components: getMissionsButtons() });
        break;
      
      case 'menu_auctions':
        await interaction.update({ embeds: [getAuctionsEmbed(data)], components: getAuctionsButtons() });
        break;
      
      case 'menu_games':
        await interaction.update({ embeds: [getGamesEmbed()], components: getGamesButtons() });
        break;

      // --- إجراءات الحساب ---
      case 'refresh':
        await interaction.deferUpdate();
        await interaction.editReply({ content: '🔄 جاري التحديث...' });
        setTimeout(async () => {
          await interaction.editReply({ content: '✅ تم التحديث بنجاح!' });
        }, 600);
        break;
      
      case 'deposit_info':
        await interaction.reply({ content: '💰 استخدم الأمر `!إيداع المبلغ` لإيداع المال في محفظتك', ephemeral: true });
        break;
      
      case 'withdraw_info':
        await interaction.reply({ content: '💳 استخدم الأمر `!سحب المبلغ` لسحب المال من محفظتك', ephemeral: true });
        break;
      
      case 'inventory_view':
        const inv = user.inventory.length ? user.inventory.map(i => `• ${i.name} — ${i.quantity}`).join('\n') : '📦 فارغ';
        await interaction.reply({ content: `📦 **ممتلكاتك:**\n\n${inv}`, ephemeral: true });
        break;

      // --- السوق ---
      case 'market_buy_info':
        await interaction.reply({ content: '🛒 استخدم `!شراء العنصر المبلغ` لشراء من السوق', ephemeral: true });
        break;
      
      case 'market_sell_info':
        await interaction.reply({ content: '💰 استخدم `!بيع العنصر المبلغ` لبيع في السوق', ephemeral: true });
        break;
      
      case 'market_refresh':
        await interaction.update({ embeds: [getMarketEmbed(data)], components: getMarketButtons() });
        break;

      // --- التجارة ---
      case 'trade_create':
        await interaction.reply({ content: '🤝 استخدم `!تبدأ-صفقة @الشخص` لبدء صفقة تجارية جديدة', ephemeral: true });
        break;
      
      case 'trade_list':
        const myTrades = Object.entries(data.trades || {}).filter(([id, t]) => 
          t.from === userId || t.to === userId
        );
        if (!myTrades.length) {
          await interaction.reply({ content: '🤝 لا توجد صفقات تجارية حالياً', ephemeral: true });
        } else {
          let msg = '🤝 **صفقاتك التجارية:**\n';
          myTrades.forEach(([id, t]) => {
            msg += `\n#${id.slice(-6)} — ${t.status === 'pending' ? '⏳ قيد الانتظار' : t.status === 'accepted' ? '✅ مقبولة' : '❌ مرفوضة'}`;
          });
          await interaction.reply({ content: msg, ephemeral: true });
        }
        break;

      // --- المهمات ---
      case 'robbery_attempt':
        const targetId = param1;
        if (!targetId) {
          await interaction.reply({ content: '❌ استخدم الأمر `!سرقة @الشخص` أولاً', ephemeral: true });
          return;
        }
        const success = Math.random() > 0.45;
        const target = data.users[targetId];
        if (success && target && target.balance >= 50) {
          const stolen = Math.floor(Math.random() * Math.min(target.balance * 0.3, 200)) + 20;
          target.balance -= stolen;
          user.balance += stolen;
          saveData(data);
          await interaction.update({ 
            content: `✅ **نجحت السرقة!** 🎉\n\nلقد سرقت **${stolen}** عملة من الشخص!💰`, 
            components: [] 
          });
        } else {
          const fine = Math.floor(Math.random() * 100) + 50;
          if (user.balance >= fine) {
            user.balance -= fine;
            saveData(data);
          }
          await interaction.update({ 
            content: `❌ **فشلت السرقة!** 😔\n\nتم اكتشافك وخسرت **${fine}** عملة كغرامة ⚠️`, 
            components: [] 
          });
        }
        break;
      
      case 'coop_join':
  if (!data.missions) data.missions = {};
  if (!data.missions.coop) data.missions.coop = { members: [], required: 3, reward: 2000 };
  if (!data.missions.coop.members.includes(userId)) {
    data.missions.coop.members.push(userId);
    if (data.missions.coop.members.length >= data.missions.coop.required) {
      const share = Math.floor(data.missions.coop.reward / data.missions.coop.required);
      data.missions.coop.members.forEach(mid => {
        if (!data.users[mid]) data.users[mid] = { balance: 0 };
        data.users[mid].balance += share;
      });
      data.missions.coop = { members: [], required: 3, reward: 2000 };
      saveData(data);
      await interaction.update({
        content: `🎉 **اكتملت المهمة التعاونية!** 🎉\n\nكل عضو حصل على **${share}** عملة!💰✅`,
        components: []
      });
      return;
    }
    saveData(data);
  }
  const m = data.missions.coop;
  await interaction.update({
    content: `🤝 انضممت للمهمة!\n\nالأعضاء: ${m.members.length}/${m.required}\nالمكافأة الكلية: ${m.reward} عملة\nفي انتظار باقي الفريق...⏳`,
    components: []
  });
  break;

          saveData(data);
        }
        const m = data.missions.coop;
        await interaction.update({ 
          content: `🤝 انضممت للمهمة!\n\nالأعضاء: ${m.members.length}/${m.required}\nالمكافأة الكلية: ${m.reward} عملة\nفي انتظار باقي الفريق...⏳`, 
          components: [] 
        });
        return;
    

      // --- المزادات ---
      case 'bid_place':
        await interaction.reply({ content: '🔨 استخدم `!مزادات` ثم اكتب `مزايدة [رقم المزاد] [المبلغ]`', ephemeral: true });
        break;
      
      case 'auction_details':
        await interaction.reply({ content: '📋 تفاصيل المزاد — استخدم `!مزادات` لعرض القائمة الكاملة', ephemeral: true });
        break;

      // --- الألعاب ---
      case 'game_dice':
        const d1 = Math.floor(Math.random() * 6) + 1;
        const d2 = Math.floor(Math.random() * 6) + 1;
        const total = d1 + d2;
        await interaction.reply({ 
          content: `🎲 **النرد:**\n\nأنت: ${d1}\nالبوت: ${d2}\n\nالمجموع: ${total}`,
          ephemeral: true 
        });
        break;
      
      case 'game_rps':
        const choices = ['حجر', 'ورق', 'مقص'];
        const player = choices[Math.floor(Math.random() * 3)];
        const bot = choices[Math.floor(Math.random() * 3)];
        let result;
        if (player === bot) result = '⚖️ تعادل';
        else if (
          (player === 'حجر' && bot === 'مقص') ||
          (player === 'ورق' && bot === 'حجر') ||
          (player === 'مقص' && bot === 'ورق')
        ) result = '✅ أنت الفائز!';
        else result = '❌ البوت فاز!';
        await interaction.reply({ 
          content: `✂️ **حجر — ورق — مقص:**\n\nأنت: ${player}\nالبوت: ${bot}\n\n${result}`,
          ephemeral: true 
        });
        break;

      // --- تأكيد وإلغاء عام ---
      case 'confirm':
        await interaction.update({ content: '✅ تم التأكيد والإجراء بنجاح!', components: [] });
        break;
      
      case 'cancel':
        await interaction.update({ content: '❌ تم إلغاء الإجراء', components: [] });
        break;

      default:
        await interaction.reply({ content: '❌ إجراء غير معروف', ephemeral: true });
    }
  } catch (err) {
    console.error('❌ خطأ في معالجة الزر:', err);
    if (!interaction.replied) {
      await interaction.reply({ content: '❌ حدث خطأ، حاول مرة أخرى', ephemeral: true });
    }
  }
});

// === دوال مساعدة لإنشاء الرسائل ===
function getMainMenuEmbed() {
  return new EmbedBuilder()
    .setColor('#9B59B6')
    .setTitle('🏠 القائمة الرئيسية — النظام الاقتصادي')
    .setDescription('اختر من الأقسام أدناه لاستكشاف النظام:')
    .addFields(
      { name: '💰 الحساب والمال', value: 'عرض رصيدك وممتلكاتك', inline: true },
      { name: '📊 السوق والتداول', value: 'أسعار اللحظة والشراء والبيع', inline: true },
      { name: '🤝 التجارة والتبادل', value: 'صفقاتك مع اللاعبين الآخرين', inline: true },
      { name: '🔫 المهام والتفاعل', value: 'العمل — السرقة — التعاون الجماعي', inline: true },
      { name: '🏷️ المزادات', value: 'المزايدة وإنشاء المزادات', inline: true },
      { name: '🎮 الألعاب والترفيه', value: 'ألعاب ممتعة ورهانات', inline: true }
    );
}

function getMainMenuButtons() {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('menu_account').setLabel('💰 حسابي').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('menu_market').setLabel('📊 السوق').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('menu_trade').setLabel('🤝 التجارة').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('menu_missions').setLabel('🔫 المهام').setStyle(ButtonStyle.Danger)
  ), new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('menu_auctions').setLabel('🏷️ المزادات').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('menu_games').setLabel('🎮 الألعاب').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('refresh').setLabel('🔄 تحديث').setStyle(ButtonStyle.Secondary)
  )];
}

function getAccountEmbed(user) {
  return new EmbedBuilder()
    .setColor('#2ECC71')
    .setTitle('💰 حسابك الشخصي')
    .addFields(
      { name: '💵 الرصيد النقدي', value: `${user.balance} عملة`, inline: true },
      { name: '🏆 المستوى', value: `المستوى ${user.level}`, inline: true },
      { name: '⭐ الخبرة', value: `${user.exp || 0} نقطة`, inline: true },
      { name: '📦 الممتلكات', value: `${user.inventory.length} عنصر`, inline: true },
      { name: '📅 تاريخ الانضمام', value: `<t:${Math.floor(new Date(user.createdAt).getTime() / 1000)}:D>`, inline: true }
    );
}

function getAccountButtons() {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('deposit_info').setLabel('💰 إيداع').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('withdraw_info').setLabel('💳 سحب').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('inventory_view').setLabel('📦 ممتلكاتي').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('menu_home').setLabel('🏠 الرئيسية').setStyle(ButtonStyle.Secondary)
  )];
}

function getMarketEmbed(data) {
  const p = data.market.prices;
  return new EmbedBuilder()
    .setColor('#3498DB')
    .setTitle('📊 سوق التداول والأسعار')
    .setDescription('أسعار اللحظة — تتحدث كل ساعة')
    .addFields(
      { name: '🥇 ذهب', value: `${p.gold} 💰`, inline: true },
      { name: '🥈 فضة', value: `${p.silver} 💰`, inline: true },
      { name: '🛢️ نفط', value: `${p.oil} 💰`, inline: true }
    );
}

function getMarketButtons() {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('market_buy_info').setLabel('🟢 شراء').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('market_sell_info').setLabel('🔴 بيع').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('market_refresh').setLabel('🔄 تحديث الأسعار').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('menu_home').setLabel('🏠 الرئيسية').setStyle(ButtonStyle.Secondary)
  )];
}

function getTradeEmbed(userId, data) {
  const activeCount = Object.values(data.trades || {}).filter(t => 
    (t.from === userId || t.to === userId) && t.status === 'pending'
  ).length;
  return new EmbedBuilder()
    .setColor('#9B59B6')
    .setTitle('🤝 التجارة والتبادل')
    .setDescription(`لديك **${activeCount}** صفقة تجارية نشطة حالياً`)
    .addFields(
      { name: 'إنشاء صفقة جديدة', value: 'استخدم: `!تبدأ-صفقة @الشخص`', inline: false },
      { name: 'عرض صفقاتي', value: 'استخدم: `!عرض-تجارة`', inline: false },
      { name: 'قبول أو رفض', value: 'استخدم: `!قبول [رقم]` أو `!رفض [رقم]`', inline: false }
    );
}

function getTradeButtons() {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('trade_create').setLabel('➕ صفقة جديدة').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('trade_list').setLabel('📋 صفقاتي').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('menu_home').setLabel('🏠 الرئيسية').setStyle(ButtonStyle.Secondary)
  )];
}

function getMissionsEmbed(user, data) {
  const coop = data.missions?.coop || { members: [], required: 3, reward: 2000 };
  return new EmbedBuilder()
    .setColor('#E74C3C')
    .setTitle('🔫 المهام والتفاعل')
    .addFields(
      { name: '🛠️ العمل اليومي', value: 'اكتب `!عمل` واحصل على مكافأة يومية', inline: false },
      { name: '🔒 السرقة', value: 'اكتب `!سرقة @الشخص` — مخاطرة ومكافأة', inline: false },
      { name: '🤝 التعاون الجماعي', value: `${coop.members.length}/${coop.required} أعضاء — مكافأة: ${coop.reward} عملة`, inline: false },
      { name: '📦 التسليم', value: 'اكتب `!تسليم @الشخص المبلغ` لتحويل المال', inline: false }
    );
}

function getMissionsButtons() {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('coop_join').setLabel('🤝 انضم لمهمة تعاونية').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('menu_home').setLabel('🏠 الرئيسية').setStyle(ButtonStyle.Secondary)
  )];
}

function getAuctionsEmbed(data) {
  const active = Object.entries(data.auctions || {}).filter(([_, a]) => a.status === 'active');
  let desc = active.length ? '' : 'لا توجد مزادات نشطة حالياً — كن الأول وأنشئ مزاداً!';
  active.slice(0, 5).forEach(([id, a], i) => {
    desc += `${i+1}. **${a.item}** — السعر الحالي: ${a.currentPrice}\n`;
  });
  return new EmbedBuilder()
    .setColor('#E67E22')
    .setTitle('🏷️ المزادات النشطة')
    .setDescription(desc || 'لا توجد مزادات نشطة حالياً');
}

function getAuctionsButtons() {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('bid_place').setLabel('🔨 مزايدة').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('auction_details').setLabel('📋 التفاصيل').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('menu_home').setLabel('🏠 الرئيسية').setStyle(ButtonStyle.Secondary)
  )];
}

function getGamesEmbed() {
  return new EmbedBuilder()
    .setColor('#E91E63')
    .setTitle('🎮 الألعاب والترفيه')
    .setDescription('اختر لعبة للبدء:')
    .addFields(
      { name: '🎲 النرد', value: 'اربح بمضاعفة رهانك', inline: true },
      { name: '✂️ حجر ورق مقص', value: 'تحدي الكمبيوتر', inline: true },
      { name: '🃏 ورق', value: 'قريباً', inline: true }
    );
}

function getGamesButtons() {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('game_dice').setLabel('🎲 النرد').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('game_rps').setLabel('✂️ حجر ورق مقص').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('menu_home').setLabel('🏠 الرئيسية').setStyle(ButtonStyle.Secondary)
  )];
}

// === معالجة الأوامر النصية ===
client.on(Events.MessageCreate, async message => {
  if (!message.content.startsWith('!') || message.author.bot) return;

  const args = message.content.slice(1).trim().split(/\s+/);
  const command = args.shift()?.toLowerCase();
  const userId = message.author.id;
  const data = readData();

  // التأكد من وجود المستخدم
  if (!data.users[userId]) {
    data.users[userId] = {
      balance: 1000,
      level: 1,
      exp: 0,
      inventory: [],
      lastDaily: null,
      lastWork: null,
      lastRobbery: null,
      createdAt: new Date().toISOString()
    };
    saveData(data);
  }
  const user = data.users[userId];

  try {
    switch (command) {
      // === القائمة الرئيسية ===
      case 'قائمة':
      case 'القائمة':
        return message.reply({ embeds: [getMainMenuEmbed()], components: getMainMenuButtons() });

      // === الحساب ===
      case 'حساب':
      case 'رصيد':
        return message.reply({ embeds: [getAccountEmbed(user)], components: getAccountButtons() });

      case 'يومي': {
        const lastDaily = user.lastDaily ? new Date(user.lastDaily) : null;
        const now = new Date();
        const canClaim = !lastDaily || (now - lastDaily) > 24 * 60 * 60 * 1000;
        
        if (!canClaim) {
          return message.reply('⏳ لقد حصلت على مكافأتك اليومية بالفعل! عد غداً ✅');
        }
        
        const reward = 250 + (user.level * 10);
        user.balance += reward;
        user.lastDaily = now.toISOString();
        saveData(data);
        
        const embed = new EmbedBuilder()
          .setColor('#F1C40F')
          .setTitle('🎁 مكافأتك اليومية')
          .setDescription(`✅ تم إضافة **${reward}** عملة إلى رصيدك!\n\n💰 الرصيد الحالي: **${user.balance}** عملة`);
        
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('refresh').setLabel('🔄 تحديث الرصيد').setStyle(ButtonStyle.Success)
        );
        return message.reply({ embeds: [embed], components: [row] });
      }

      case 'عمل': {
        const lastWork = user.lastWork ? new Date(user.lastWork) : null;
        const now = new Date();
        const canWork = !lastWork || (now - lastWork) > 60 * 60 * 1000;
        
        if (!canWork) {
          return message.reply('⏳ تحتاج لراحة ساعة قبل العمل مرة أخرى! 💤');
        }
        
        const earnings = Math.floor(Math.random() * 150) + 100;
        user.balance += earnings;
        user.lastWork = now.toISOString();
        saveData(data);
        
        return message.reply(`🛠️ انتهيت من العمل! حصلت على **${earnings}** عملة 💪💰`);
      }

      // === السوق ===
      case 'سوق':
      case 'اسعار':
        return message.reply({ embeds: [getMarketEmbed(data)], components: getMarketButtons() });

      case 'شراء': {
        const item = args[0]?.toLowerCase();
        const qty = parseInt(args[1]);
        const prices = { gold: 125.50, silver: 45.20, oil: 78.30 };
        
        if (!item || !prices[item] || isNaN(qty) || qty < 1) {
          return message.reply('❌ استخدم الصيغة: `!شراء [ذهب/فضة/نفط] [الكمية]`');
        }
        
        const total = Math.floor(prices[item] * qty);
        if (user.balance < total) {
          return message.reply(`❌ رصيدك غير كافٍ! تحتاج **${total}** عملة ولديك **${user.balance}**`);
        }
        
        user.balance -= total;
        const existing = user.inventory.find(i => i.name === item);
        if (existing) existing.quantity += qty;
        else user.inventory.push({ name: item, quantity: qty, boughtPrice: prices[item] });
        saveData(data);
        
        return message.reply(`✅ اشتريت **${qty}** وحدة من ${item === 'gold' ? 'الذهب' : item === 'silver' ? 'الفضة' : 'النفط'} بقيمة **${total}** عملة 🛒`);
      }

      case 'بيع': {
        const item = args[0]?.toLowerCase();
        const qty = parseInt(args[1]);
        const prices = { gold: 125.50, silver: 45.20, oil: 78.30 };
        
        if (!item || !prices[item] || isNaN(qty) || qty < 1) {
          return message.reply('❌ استخدم الصيغة: `!بيع [ذهب/فضة/نفط] [الكمية]`');
        }
        
        const invItem = user.inventory.find(i => i.name === item);
        if (!invItem || invItem.quantity < qty) {
          return message.reply(`❌ لا تملك كمية كافية من هذا العنصر في مخزونك`);
        }
        
        const total = Math.floor(prices[item] * qty);
        user.balance += total;
        invItem.quantity -= qty;
        if (invItem.quantity <= 0) {
          user.inventory = user.inventory.filter(i => i.name !== item);
        }
        saveData(data);
        
        return message.reply(`✅ بعت **${qty}** وحدة بقيمة **${total}** عملة! رصيدك الجديد: **${user.balance}** 💰`);
      }

      // === التجارة ===
      case 'تبدأ-صفقة':
      case 'صفقة': {
        const targetUser = message.mentions.users.first();
        if (!targetUser || targetUser.id === userId) {
          return message.reply('❌ اذكر الشخص الذي تريد التبادل معه: `!تبدأ-صفقة @الشخص`');
        }
        
        const tradeId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        data.trades[tradeId] = {
          from: userId,
          to: targetUser.id,
          offerFrom: { items: [], money: 0 },
          offerTo: { items: [], money: 0 },
          status: 'pending',
          createdAt: new Date().toISOString()
        };
        saveData(data);
        
        return message.reply(`🤝 تم إنشاء صفقة تجارية مع <@${targetUser.id}>\n\nأكمل التفاصيل ثم اكتب:\n!عرض-تبادل ${tradeId} [ما سأعطيه] [ما سأخذ منه]`);
      }

      case 'عرض-تجارة':
      case 'صفقات':
        return message.reply({ embeds: [getTradeEmbed(userId, data)], components: getTradeButtons() });

      // === السرقة ===
      case 'سرقة': {
        const targetUser = message.mentions.users.first();
        if (!targetUser) {
          return message.reply('❌ اذكر الشخص: `!سرقة @الشخص`');
        }
        if (targetUser.id === userId) {
          return message.reply('❌ لا يمكنك سرقة نفسك! 😅');
        }
        
        const lastRobbery = user.lastRobbery ? new Date(user.lastRobbery) : null;
        const now = new Date();
        const canRob = !lastRobbery || (now - lastRobbery) > 10 * 60 * 1000;
        
        if (!canRob) {
          return message.reply('⏳ يجب انتظار 10 دقائق بين كل محاولة سرقة! حاول لاحقاً ⚠️');
        }
        
        if (!data.users[targetUser.id]) {
          data.users[targetUser.id] = { balance: 1000, inventory: [], createdAt: new Date().toISOString() };
        }
        const targetData = data.users[targetUser.id];
        if (targetData.balance < 50) {
          return message.reply('⚠️ هذا الشخص لا يملك ما يكفي من المال لسرقته!');
        }
        
        user.lastRobbery = now.toISOString();
        saveData(data);
        
        const embed = new EmbedBuilder()
          .setColor('#E74C3C')
          .setTitle('🔒 محاولة سرقة')
          .setDescription(`محاولة سرقة من <@${targetUser.id}>\n\nنسبة النجاح: 55%\n⚠️ في حال الفشل ستخسر ما بين 50-150 عملة كغرامة!`);
        
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`robbery_attempt:${targetUser.id}`).setLabel('🔫 حاول السرقة').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId('cancel').setLabel('❌ تراجع').setStyle(ButtonStyle.Secondary)
        );
        return message.reply({ embeds: [embed], components: [row] });
      }

      // === التعاون ===
      case 'تعاون':
        return message.reply({ embeds: [getMissionsEmbed(user, data)], components: getMissionsButtons() });

      // === التسليم ===
      case 'تسليم': {
        const targetUser = message.mentions.users.first();
        const amount = parseInt(args[1]);
        if (!targetUser || isNaN(amount) || amount < 1) {
          return message.reply('❌ استخدم الصيغة: `!تسليم @الشخص المبلغ`');
        }
        if (targetUser.id === userId) {
          return message.reply('❌ لا يمكنك التحويل لنفسك!');
        }
        if (user.balance < amount) {
          return message.reply(`❌ رصيدك غير كافٍ! لديك ${user.balance} وتحاول تحويل ${amount}`);
        }
        
        if (!data.users[targetUser.id]) {
          data.users[targetUser.id] = { balance: 0, inventory: [], createdAt: new Date().toISOString() };
        }
        
        const embed = new EmbedBuilder()
          .setColor('#F1C40F')
          .setTitle('📦 تأكيد التسليم')
          .setDescription(`من: <@${userId}>\nإلى: <@${targetUser.id}>\nالمبلغ: **${amount}** عملة\n\nهل تريد تأكيد التحويل؟`);
        
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('confirm').setLabel('✅ تأكيد').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('cancel').setLabel('❌ إلغاء').setStyle(ButtonStyle.Secondary)
        );
        
        // تنفيذ التحويل مباشرة إذا تم التأكيد
        // ملاحظة: للتبسيط، نفذنا مباشرة، يمكنك تعديلها لتنتظر ضغط الزر
        user.balance -= amount;
        data.users[targetUser.id].balance += amount;
        saveData(data);
        
        return message.reply(`✅ تم تحويل **${amount}** عملة إلى <@${targetUser.id}> بنجاح! 💸`);
      }

      // === المزادات ===
      case 'مزادات':
      case 'المزادات':
        return message.reply({ embeds: [getAuctionsEmbed(data)], components: getAuctionsButtons() });

      case 'بدء-مزاد': {
        if (!message.member.permissions.has('Administrator')) {
          return message.reply('❌ غير مسموح لك بهذا الأمر!');
        }
        const itemName = args.slice(0, -1).join(' ') || 'قطعة نادرة';
        const startPrice = parseInt(args[args.length - 1]) || 100;
        
        const auctionId = Date.now().toString(36);
        data.auctions[auctionId] = {
          item: itemName,
          startPrice: startPrice,
          currentPrice: startPrice,
          highestBidder: null,
          creator: userId,
          status: 'active',
          createdAt: new Date().toISOString()
        };
        saveData(data);
        
        return message.reply(`🏷️ تم إنشاء مزاد جديد:\n\nالقطعة: **${itemName}**\nالسعر الابتدائي: **${startPrice}** عملة\n\nاستخدم \`!مزادات\` لمشاهدة جميع المزادات ✅`);
      }

      // === الألعاب ===
      case 'العاب':
      case 'العاب':
        return message.reply({ embeds: [getGamesEmbed()], components: getGamesButtons() });

      // === للمشرفين ===
      case 'تعويض': {
        if (!message.member.permissions.has('Administrator')) {
          return message.reply('❌ غير مسموح لك بهذا الأمر!');
        }
        const targetUser = message.mentions.users.first();
        const amount = parseInt(args[1]);
        if (!targetUser || isNaN(amount) || amount < 1) {
          return message.reply('❌ استخدم الصيغة: `!تعويض @الشخص المبلغ`');
        }
        
        if (!data.users[targetUser.id]) {
          data.users[targetUser.id] = { balance: 0, inventory: [], createdAt: new Date().toISOString() };
        }
        data.users[targetUser.id].balance += amount;
        saveData(data);
        
        return message.reply(`✅ تم تعويض <@${targetUser.id}> بمبلغ **${amount}** عملة بنجاح! 💰`);
      }

      // === مساعدة ===
      case 'مساعدة':
      case 'اوامر': {
        return message.reply(`
📜 **أوامر بوت النظام الاقتصادي — استخدم ! فقط:**

🏠 !قائمة — عرض القائمة الرئيسية الكاملة

💰 **الحساب والمال:**
!حساب — عرض رصيدك وممتلكاتك
!يومي — مكافأتك اليومية
!عمل — عمل كل ساعة والحصول على مال

📊 **السوق والتداول:**
!سوق — عرض الأسعار والأسواق
!شراء [عنصر] [كمية] — شراء من السوق
!بيع [عنصر] [كمية] — بيع في السوق

🤝 **التجارة والتبادل:**
!تبدأ-صفقة @شخص — بدء صفقة تجارية
!عرض-تجارة — عرض صفقاتك النشطة
!تسليم @شخص مبلغ — تحويل مبلغ لشخص

🔫 **المهام والتفاعل:**
!سرقة @شخص — محاولة سرقة (مخاطرة ومكافأة)
!تعاون — انضم لمهمة جماعية
!عمل — كسب المال كل ساعة

🏷️ **المزادات:**
!مزادات — عرض المزادات النشطة
!بدء-مزاد اسم سعر — إنشاء مزاد جديد (للمشرفين)

🎮 **الألعاب:**
!العاب — قائمة الألعاب التفاعلية

⚙️ **للمشرفين:**
!تعويض @شخص مبلغ — إضافة رصيد لمستخدم

---
🤖 **بوت العصابات يستخدم / فقط**
مثال: /انضمام  /ملفي
        `);
      }

      default:
        return message.reply(`❌ أمر غير معروف! اكتب \`!مساعدة\` لمعرفة جميع الأوامر المتاحة`);
    }
  } catch (err) {
    console.error('❌ خطأ في معالجة الأمر:', err);
    return message.reply('❌ حدث خطأ في تنفيذ الأمر، حاول مرة أخرى');
  }
});

// === تشغيل البوت ===
const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('❌ خطأ: DISCORD_TOKEN غير موجود في المتغيرات البيئية!');
  process.exit(1);
}

client.login(token)
  .then(() => console.log('⏳ جاري الاتصال بالديسكورد...'))
  .catch(err => {
    console.error('❌ فشل تسجيل الدخول:', err.message);
    process.exit(1);
  });
