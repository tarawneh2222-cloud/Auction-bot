const { REST, Routes } = require('discord.js');

const clientId = '1558873905815486615';
const token = process.env.TOKEN;

const commands = [
  {
    name: 'start',
    description: 'ابدأ مزاداً جديداً'
  },
  {
    name: 'bid',
    description: 'قدم عرضاً في المزاد',
    options: [
      {
        name: 'المبلغ',
        type: 4,
        description: 'قيمة عرضك',
        required: true
      }
    ]
  }
];

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    console.log('🔄 جاري نشر الأوامر...');
    await rest.put(
      Routes.applicationCommands(clientId),
      { body: commands }
    );
    console.log('✅ تم نشر الأوامر بنجاح!');
  } catch (error) {
    console.error('❌ خطأ:', error);
  }
})();
