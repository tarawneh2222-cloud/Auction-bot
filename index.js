const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, 'data.json');

let userData = {};
try {
  if (fs.existsSync(DATA_PATH)) {
    userData = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    console.log('✅ تم تحميل بيانات اللاعبين');
  } else {
    fs.writeFileSync(DATA_PATH, '{}');
    userData = {};
    console.log('📄 ملف بيانات جديد جاهز');
  }
} catch (error) {
  userData = {};
  console.log('⚠️ خطأ في تحميل البيانات');
}

function saveData() {
  try {
    fs.writeFileSync(DATA_PATH, JSON.stringify(userData, null, 2));
    return true;
  } catch (e) {
    console.error('❌ خطأ في الحفظ:', e);
    return false;
  }
}

function getUser(id) {
  if (!userData[id]) {
    userData[id] = {
      money: 1000,
      properties: [],
      inventory: []
    };
  }
  return userData[id];
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.on('ready', () => {
  console.log(`✅ البوت متصل باسم: ${client.user.tag}`);
});

client.on('messageCreate', async message => {
  if (message.author.bot) return;
  const args = message.content.split(' ');
  const command = args.shift();
  const user = getUser(message.author.id);

  if (command === '.حساب') {
    message.reply(`💰 **حسابك:** ${user.money} دولار\n🏠 العقارات: ${user.properties.length}`);
  }
  
  else if (command === .مساعدة) {
    message.reply(`
**📋 قائمة الأوامر:**
.حساب - عرض رصيدك
.مساعدة - عرض هذه القائمة
    `);
  }
  
  saveData();
});

const TOKEN = process.env.DISCORD_TOKEN;
client.login(TOKEN);
