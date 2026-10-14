'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const {
  Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder,
  ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle
} = require('discord.js');

const PORT = Number(process.env.PORT) || 3000;
const TOKEN = process.env.DISCORD_TOKEN;
const DATABASE_URL = process.env.DATABASE_URL;
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data.json');
const MAX_MONEY = 1_000_000_000_000;
const DAY = 86400000;
const WORK_COOLDOWN = 3600000;
const GAME_COOLDOWN = 10000;
const XP_COOLDOWN = 60000;
if (!TOKEN) throw new Error('Missing DISCORD_TOKEN environment variable.');
if (!DATABASE_URL) throw new Error('Missing DATABASE_URL environment variable.');

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false },
  max: 5,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000
});
const JOBS = {
  'عامل': { salary: 150, xp: 10 }, 'طباخ': { salary: 220, xp: 15 },
  'ممرض': { salary: 300, xp: 20 }, 'مهندس': { salary: 450, xp: 25 },
  'مبرمج': { salary: 500, xp: 30 }, 'مدير': { salary: 650, xp: 35 }
};
const PROPERTIES = {
  'كوخ': { price: 5000, rent: 100 }, 'شقة': { price: 15000, rent: 300 },
  'فيلا': { price: 50000, rent: 1000 }, 'قصر': { price: 150000, rent: 3000 }
};
const STORE_ITEMS = {
  'سيارة رياضية': { price: 12000, emoji: '🏎️', category: 'سيارات', description: 'سيارة افتراضية سريعة للعرض في ملفك' },
  'سيارة فاخرة': { price: 30000, emoji: '🚘', category: 'سيارات', description: 'سيارة فاخرة افتراضية' },
  'دراجة نارية': { price: 6500, emoji: '🏍️', category: 'سيارات', description: 'دراجة افتراضية أنيقة' },
  'سيف التنين': { price: 9000, emoji: '🗡️', category: 'أسلحة خيالية', description: 'قطعة خيالية للزينة وجمع المقتنيات فقط' },
  'درع أسطوري': { price: 14000, emoji: '🛡️', category: 'أسلحة خيالية', description: 'درع أسطوري افتراضي للعرض' },
  'قوس العنقاء': { price: 11000, emoji: '🏹', category: 'أسلحة خيالية', description: 'قوس سحري خيالي للمقتنيات' },
  'تاج نادر': { price: 25000, emoji: '👑', category: 'مقتنيات نادرة', description: 'تاج نادر يميز ملفك' },
  'جوهرة أسطورية': { price: 18000, emoji: '💎', category: 'مقتنيات نادرة', description: 'جوهرة نادرة افتراضية' },
  'حيوان أليف فضائي': { price: 22000, emoji: '👾', category: 'مقتنيات نادرة', description: 'رفيق فضائي خيالي' }
};
const STOCKS = {
  gold: { name: 'ذهب', initial: 100 }, tech: { name: 'تقنية', initial: 75 },
  oil: { name: 'نفط', initial: 90 }, food: { name: 'غذاء', initial: 55 },
  energy: { name: 'طاقة', initial: 120 }
};
const STOCK_ALIASES = {
  'ذهب': 'gold', gold: 'gold', 'تقنية': 'tech', 'تقنيه': 'tech', tech: 'tech',
  'نفط': 'oil', oil: 'oil', 'غذاء': 'food', food: 'food',
  'طاقة': 'energy', 'طاقه': 'energy', energy: 'energy'
};

const app = express();
let client;
app.get('/', (_req, res) => res.status(200).send('✅ بوت الاقتصاد التفاعلي يعمل'));
app.get('/health', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ status: 'ok', database: 'connected', bot: Boolean(client?.isReady()) }); }
  catch { res.status(503).json({ status: 'error', database: 'disconnected' }); }
});

client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

function n(v, fallback = 0) { const x = Number(v); return Number.isFinite(x) && x >= 0 ? x : fallback; }
function timeValue(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number' || /^\d+$/.test(String(v))) return n(v);
  const t = Date.parse(String(v)); return Number.isFinite(t) ? t : 0;
}
function normalize(row = {}) {
  return {
    id: String(row.discord_id || row.id || ''),
    balance: Math.min(MAX_MONEY, n(row.balance ?? row.cash, 1000)),
    bank: Math.min(MAX_MONEY, n(row.bank)),
    lastDaily: timeValue(row.last_daily ?? row.lastDaily),
    lastWork: timeValue(row.last_work ?? row.lastWork),
    lastRent: timeValue(row.last_rent ?? row.lastRent),
    lastGame: timeValue(row.last_game ?? row.lastGame),
    lastXpMessage: timeValue(row.last_xp_message ?? row.lastXpMessage),
    job: JOBS[row.job] ? row.job : null,
    xp: n(row.xp), level: Math.max(1, Math.min(100, Math.floor(n(row.level, 1)))),
    stocks: row.stocks && typeof row.stocks === 'object' ? row.stocks : {},
    properties: row.properties && typeof row.properties === 'object' ? row.properties : {},
    inventory: row.inventory && typeof row.inventory === 'object' ? row.inventory : {},
    wins: n(row.wins), losses: n(row.losses)
  };
}
function fromDb(row) {
  return normalize({ ...row, balance: Number(row.balance), bank: Number(row.bank),
    last_daily: Number(row.last_daily), last_work: Number(row.last_work), last_rent: Number(row.last_rent),
    last_game: Number(row.last_game), last_xp_message: Number(row.last_xp_message), xp: Number(row.xp),
    level: Number(row.level), wins: Number(row.wins), losses: Number(row.losses) });
}

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS economy_users (
      discord_id TEXT PRIMARY KEY, balance BIGINT NOT NULL DEFAULT 1000, bank BIGINT NOT NULL DEFAULT 0,
      last_daily BIGINT NOT NULL DEFAULT 0, last_work BIGINT NOT NULL DEFAULT 0,
      last_rent BIGINT NOT NULL DEFAULT 0, last_game BIGINT NOT NULL DEFAULT 0,
      last_xp_message BIGINT NOT NULL DEFAULT 0, job TEXT, xp BIGINT NOT NULL DEFAULT 0,
      level INTEGER NOT NULL DEFAULT 1, stocks JSONB NOT NULL DEFAULT '{}'::jsonb,
      properties JSONB NOT NULL DEFAULT '{}'::jsonb, inventory JSONB NOT NULL DEFAULT '{}'::jsonb, wins BIGINT NOT NULL DEFAULT 0,
      losses BIGINT NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS economy_market (
      asset TEXT PRIMARY KEY, price BIGINT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS economy_trades (
      id BIGSERIAL PRIMARY KEY, discord_id TEXT NOT NULL, action TEXT NOT NULL, asset TEXT NOT NULL,
      quantity BIGINT NOT NULL, unit_price BIGINT NOT NULL, total BIGINT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS economy_trades_user_idx ON economy_trades(discord_id, created_at DESC);
  `);
  await pool.query("ALTER TABLE economy_users ADD COLUMN IF NOT EXISTS inventory JSONB NOT NULL DEFAULT '{}'::jsonb");
  for (const [key, stock] of Object.entries(STOCKS)) {
    await pool.query('INSERT INTO economy_market(asset,price) VALUES($1,$2) ON CONFLICT(asset) DO NOTHING', [key, stock.initial]);
  }
  await importLegacyJsonIfEmpty();
}
async function importLegacyJsonIfEmpty() {
  const count = await pool.query('SELECT COUNT(*)::int AS count FROM economy_users');
  if (count.rows[0].count > 0 || !fs.existsSync(DATA_FILE)) return;
  let parsed;
  try { parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch (e) { console.error('⚠️ لم يتم استيراد JSON القديم:', e.message); return; }
  const source = parsed.users && typeof parsed.users === 'object' ? parsed.users : parsed;
  const ignored = new Set(['market', 'lastMarketUpdate', 'version', 'meta']);
  let imported = 0;
  for (const [id, old] of Object.entries(source)) {
    if (ignored.has(id) || !old || typeof old !== 'object' || Array.isArray(old)) continue;
    const u = normalize({ ...old, id });
    await pool.query(`INSERT INTO economy_users
      (discord_id,balance,bank,last_daily,last_work,last_rent,last_game,last_xp_message,job,xp,level,stocks,properties,inventory,wins,losses)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb,$14::jsonb,$15,$16) ON CONFLICT(discord_id) DO NOTHING`,
      [id,u.balance,u.bank,u.lastDaily,u.lastWork,u.lastRent,u.lastGame,u.lastXpMessage,u.job,u.xp,u.level,
       JSON.stringify(u.stocks),JSON.stringify(u.properties),JSON.stringify(u.inventory),u.wins,u.losses]);
    imported++;
  }
  if (parsed.market && typeof parsed.market === 'object') {
    for (const key of Object.keys(STOCKS)) {
      const price = Number(parsed.market[key]);
      if (Number.isFinite(price) && price > 0) await pool.query('UPDATE economy_market SET price=$2 WHERE asset=$1',[key,Math.floor(price)]);
    }
  }
  console.log(`📦 تم استيراد ${imported} مستخدم من JSON القديم. احتفظ بنسخة احتياطية.`);
}
async function ensureUser(c, id) {
  await c.query('INSERT INTO economy_users(discord_id) VALUES($1) ON CONFLICT(discord_id) DO NOTHING',[id]);
  const r = await c.query('SELECT * FROM economy_users WHERE discord_id=$1',[id]);
  return fromDb(r.rows[0]);
}
async function saveUser(c,u) {
  await c.query(`UPDATE economy_users SET balance=$2,bank=$3,last_daily=$4,last_work=$5,last_rent=$6,last_game=$7,
    last_xp_message=$8,job=$9,xp=$10,level=$11,stocks=$12::jsonb,properties=$13::jsonb,inventory=$14::jsonb,wins=$15,losses=$16,updated_at=NOW()
    WHERE discord_id=$1`,[u.id,Math.floor(u.balance),Math.floor(u.bank),u.lastDaily,u.lastWork,u.lastRent,u.lastGame,
    u.lastXpMessage,u.job,Math.floor(u.xp),u.level,JSON.stringify(u.stocks),JSON.stringify(u.properties),JSON.stringify(u.inventory),Math.floor(u.wins),Math.floor(u.losses)]);
}
async function withUser(id, fn) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query('INSERT INTO economy_users(discord_id) VALUES($1) ON CONFLICT(discord_id) DO NOTHING',[id]);
    const r = await c.query('SELECT * FROM economy_users WHERE discord_id=$1 FOR UPDATE',[id]);
    const u = fromDb(r.rows[0]);
    const result = await fn(u,c);
    await saveUser(c,u);
    await c.query('COMMIT');
    return result;
  } catch (e) { await c.query('ROLLBACK').catch(()=>{}); throw e; }
  finally { c.release(); }
}
async function withTwoUsers(idA,idB,fn) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    for (const id of [idA,idB].sort()) await c.query('INSERT INTO economy_users(discord_id) VALUES($1) ON CONFLICT(discord_id) DO NOTHING',[id]);
    const r = await c.query('SELECT * FROM economy_users WHERE discord_id=ANY($1::text[]) ORDER BY discord_id FOR UPDATE',[[idA,idB].sort()]);
    const map = new Map(r.rows.map(row=>[row.discord_id,fromDb(row)]));
    const a=map.get(idA), b=map.get(idB), result=await fn(a,b,c);
    await saveUser(c,a); await saveUser(c,b); await c.query('COMMIT'); return result;
  } catch(e) { await c.query('ROLLBACK').catch(()=>{}); throw e; }
  finally { c.release(); }
}
async function marketPrices() {
  const r=await pool.query('SELECT asset,price FROM economy_market');
  return Object.fromEntries(r.rows.map(x=>[x.asset,Number(x.price)]));
}
async function refreshMarket() {
  const c=await pool.connect();
  try {
    await c.query('BEGIN');
    const r=await c.query('SELECT asset,price,updated_at FROM economy_market FOR UPDATE');
    const latest=Math.max(0,...r.rows.map(x=>new Date(x.updated_at).getTime()));
    if(Date.now()-latest<30*60*1000){await c.query('COMMIT');return;}
    for(const row of r.rows){const price=Math.max(1,Math.round(Number(row.price)*(1+(Math.random()*0.2-0.1))));await c.query('UPDATE economy_market SET price=$2,updated_at=NOW() WHERE asset=$1',[row.asset,price]);}
    await c.query('COMMIT');
  } catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;} finally{c.release();}
}
async function recordTrade(c,id,action,asset,qty,price){
  await c.query('INSERT INTO economy_trades(discord_id,action,asset,quantity,unit_price,total) VALUES($1,$2,$3,$4,$5,$6)',[id,action,asset,qty,price,qty*price]);
}
function addCash(u,amount){if(!Number.isSafeInteger(amount)||amount<=0||u.balance+amount>MAX_MONEY)return false;u.balance+=amount;return true;}
function addXP(u,amount){u.xp+=amount;let levels=0;while(u.level<100&&u.xp>=u.level*100){u.xp-=u.level*100;u.level++;levels++;}return levels;}
function money(v){return Math.floor(Number(v)||0).toLocaleString('en-US');}
function amount(v){const s=String(v??'').trim();if(!/^\d+$/.test(s))return null;const x=Number(s);return Number.isSafeInteger(x)&&x>0&&x<=MAX_MONEY?x:null;}
function cooldown(ms){const mins=Math.max(1,Math.ceil(ms/60000)),h=Math.floor(mins/60),m=mins%60;return h?`${h} ساعة و${m} دقيقة`:`${m} دقيقة`;}
function makeEmbed(title,description,color=0x5865F2){return new EmbedBuilder().setColor(color).setTitle(title).setDescription(description).setFooter({text:'اقتصاد افتراضي • لا توجد أموال حقيقية'}).setTimestamp();}
function btn(id,label,style=ButtonStyle.Secondary,emoji){const b=new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);if(emoji)b.setEmoji(emoji);return b;}
function row(...items){return new ActionRowBuilder().addComponents(...items);}
function panelRows(){return [
  row(btn('panel:account','حسابي',ButtonStyle.Primary,'💳'),btn('panel:bank','البنك',ButtonStyle.Secondary,'🏦'),btn('panel:daily','المكافأة اليومية',ButtonStyle.Success,'🎁'),btn('panel:portfolio','محفظتي',ButtonStyle.Secondary,'📈'),btn('panel:market','السوق',ButtonStyle.Secondary,'📊')),
  row(btn('panel:games','الألعاب',ButtonStyle.Danger,'🎮'),btn('panel:jobs','الوظائف',ButtonStyle.Secondary,'💼'),btn('panel:properties','العقارات',ButtonStyle.Secondary,'🏠'),btn('panel:leaderboard','الترتيب',ButtonStyle.Secondary,'🏆'),btn('panel:help','المساعدة',ButtonStyle.Secondary,'❔')),
  row(btn('panel:store','المتجر',ButtonStyle.Success,'🛍️'),btn('panel:inventory','مقتنياتي',ButtonStyle.Primary,'🎒'))
];}
function modalAmount(id,title,label){const m=new ModalBuilder().setCustomId(id).setTitle(title);m.addComponents(row(new TextInputBuilder().setCustomId('amount').setLabel(label).setPlaceholder('مثال: 500').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(15)));return m;}
function modalTrade(action,asset){const m=new ModalBuilder().setCustomId(`modal:trade:${action}:${asset}`).setTitle(action==='buy'?'شراء وحدات':'بيع وحدات');m.addComponents(row(new TextInputBuilder().setCustomId('quantity').setLabel('عدد الوحدات').setPlaceholder('مثال: 2').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(12)));return m;}
function modalGame(game){const titles={coin:'رمي العملة',dice:'لعبة النرد',guess:'تخمين الرقم'};const m=new ModalBuilder().setCustomId(`modal:game:${game}`).setTitle(titles[game]);m.addComponents(row(new TextInputBuilder().setCustomId('bet').setLabel('قيمة الرهان الافتراضي').setPlaceholder('مثال: 100').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(12)));if(game==='guess')m.addComponents(row(new TextInputBuilder().setCustomId('guess').setLabel('خمن رقماً من 1 إلى 5').setPlaceholder('3').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(1)));return m;}

async function accountEmbed(id){const u=await withUser(id,async x=>({...x}));const p=await marketPrices();const stocks=Object.entries(u.stocks).reduce((s,[k,q])=>s+(p[k]||0)*Number(q||0),0);const homes=Object.entries(u.properties).reduce((s,[k,q])=>s+(PROPERTIES[k]?.price||0)*Number(q||0),0);return makeEmbed('💳 الحساب الشخصي',`💵 **النقد:** ${money(u.balance)} ريال\n🏦 **البنك:** ${money(u.bank)} ريال\n📈 **الأسهم:** ${money(stocks)} ريال\n🏠 **العقارات:** ${money(homes)} ريال\n💎 **إجمالي الثروة:** ${money(u.balance+u.bank+stocks+homes)} ريال\n⭐ **المستوى:** ${u.level} | الخبرة: ${money(u.xp)}/${u.level*100}\n🎯 **انتصارات:** ${u.wins} | **خسائر:** ${u.losses}`);}
async function marketPage(){const p=await marketPrices();const select=new StringSelectMenuBuilder().setCustomId('market:asset').setPlaceholder('اختر سهماً للتداول').addOptions(Object.entries(STOCKS).map(([key,s])=>({label:s.name,value:key,description:`السعر الحالي ${money(p[key])} ريال`})));return{embeds:[makeEmbed('📊 سوق الاستثمار',Object.entries(STOCKS).map(([key,s])=>`• **${s.name}** — ${money(p[key])} ريال للوحدة`).join('\n')+'\n\nتتغير الأسعار الافتراضية كل 30 دقيقة.')],components:[row(select),row(btn('market:history','آخر الصفقات',ButtonStyle.Secondary,'🧾'),btn('panel:portfolio','محفظتي',ButtonStyle.Primary,'💼'))],ephemeral:true};}
async function portfolioPage(id){const u=await withUser(id,async x=>({...x})),p=await marketPrices();const s=Object.entries(u.stocks).filter(([,q])=>Number(q)>0).map(([k,q])=>`• ${STOCKS[k]?.name||k}: **${money(q)} وحدة** × ${money(p[k]||0)} = ${money(Number(q)*(p[k]||0))} ريال`);const h=Object.entries(u.properties).filter(([,q])=>Number(q)>0).map(([k,q])=>`• ${k}: **${q}**`);return{embeds:[makeEmbed('📈 محفظتي واستثماراتي',`**الأسهم**\n${s.join('\n')||'لا تملك أسهماً.'}\n\n**العقارات**\n${h.join('\n')||'لا تملك عقارات.'}`)],components:[row(btn('panel:market','فتح السوق',ButtonStyle.Primary,'📊'))],ephemeral:true};}
async function jobsPage(id){const u=await withUser(id,async x=>({...x}));const select=new StringSelectMenuBuilder().setCustomId('jobs:choose').setPlaceholder('اختر وظيفة للتعيين').addOptions(Object.entries(JOBS).map(([name,j])=>({label:name,value:name,description:`راتب ${j.salary} ريال لكل دوام` })));return{embeds:[makeEmbed('💼 مركز الوظائف',Object.entries(JOBS).map(([name,j])=>`• **${name}** — ${j.salary} ريال لكل دوام`).join('\n')+`\n\nوظيفتك الحالية: **${u.job||'بدون وظيفة'}**\nيمكنك استلام راتب كل ساعة.`)],components:[row(select),row(btn('jobs:work','الذهاب إلى الدوام',ButtonStyle.Success,'🧰'))],ephemeral:true};}
async function propertiesPage(id){const u=await withUser(id,async x=>({...x}));const select=new StringSelectMenuBuilder().setCustomId('property:buy').setPlaceholder('اختر عقاراً للشراء').addOptions(Object.entries(PROPERTIES).map(([name,p])=>({label:name,value:name,description:`السعر ${money(p.price)} ريال`})));const inventory=Object.entries(u.properties).filter(([,q])=>Number(q)>0).map(([k,q])=>`${k}: ${q}`).join('، ')||'لا تملك عقارات';return{embeds:[makeEmbed('🏠 سوق العقارات',Object.entries(PROPERTIES).map(([name,p])=>`• **${name}** — السعر ${money(p.price)} | الإيجار اليومي ${money(p.rent)}`).join('\n')+`\n\n**عقاراتك:** ${inventory}`)],components:[row(select),row(btn('property:rent','تحصيل الإيجار',ButtonStyle.Success,'💵'),btn('property:sell','بيع عقار',ButtonStyle.Danger,'🏷️'))],ephemeral:true};}
async function storePage(id){
  const u=await withUser(id,async x=>({...x}));
  const select=new StringSelectMenuBuilder().setCustomId('store:buy').setPlaceholder('اختر غرضاً افتراضياً للشراء').addOptions(Object.entries(STORE_ITEMS).map(([name,item])=>({label:name,value:name,description:`${item.price.toLocaleString('en-US')} عملة • ${item.category}`,emoji:item.emoji})));
  const grouped={};
  for(const [name,item] of Object.entries(STORE_ITEMS)){(grouped[item.category] ||= []).push(`${item.emoji} **${name}** — ${money(item.price)} عملة\n  ${item.description}`);}
  return {embeds:[makeEmbed('🛍️ المتجر الافتراضي',`رصيدك النقدي: **${money(u.balance)} عملة افتراضية**\n\n${Object.entries(grouped).map(([cat,items])=>`**${cat}**\n${items.join('\n')}`).join('\n\n')}\n\nكل الأغراض للعبة فقط ولا تمثل سلعاً حقيقية.`)],components:[row(select),row(btn('panel:inventory','عرض مقتنياتي',ButtonStyle.Primary,'🎒'))],ephemeral:true};
}
async function inventoryPage(id){
  const u=await withUser(id,async x=>({...x}));
  const entries=Object.entries(u.inventory||{}).filter(([,q])=>Number(q)>0);
  const lines=entries.map(([name,q])=>`${STORE_ITEMS[name]?.emoji||'🎁'} **${name}** × ${q}`);
  return {embeds:[makeEmbed('🎒 مقتنياتي الافتراضية',lines.join('\n')||'حقيبتك فارغة حالياً. افتح المتجر واشترِ أغراضاً بعملات اللعبة.')],components:[row(btn('panel:store','فتح المتجر',ButtonStyle.Success,'🛍️'))],ephemeral:true};
}
async function gamesPage(){return{embeds:[makeEmbed('🎮 صالة الألعاب','🪙 **العملة:** فوز = ضعف الرهان إجمالاً.\n🎲 **النرد:** الفوز إذا ظهر 4 أو 5 أو 6، والمبلغ الإجمالي ضعف الرهان.\n🔢 **تخمين الرقم:** خمن من 1 إلى 5؛ الفوز يعيد 4 أضعاف الرهان إجمالاً.\n\nالألعاب افتراضية وبها فترة انتظار قصيرة.')],components:[row(btn('game:coin','رمي العملة',ButtonStyle.Primary,'🪙'),btn('game:dice','رمي النرد',ButtonStyle.Primary,'🎲'),btn('game:guess','تخمين الرقم',ButtonStyle.Success,'🔢'))],ephemeral:true};}
async function leaderboardPage(){const r=await pool.query('SELECT discord_id,balance,bank FROM economy_users ORDER BY (balance+bank) DESC LIMIT 10');return{embeds:[makeEmbed('🏆 أغنى اللاعبين',r.rows.map((u,i)=>`${i+1}. <@${u.discord_id}> — **${money(Number(u.balance)+Number(u.bank))} ريال**`).join('\n')||'لا توجد بيانات بعد.')],ephemeral:true};}
async function dailyClaim(id){return withUser(id,async u=>{const now=Date.now();if(u.lastDaily&&now-u.lastDaily<DAY)return{ok:false,message:`⏰ يمكنك استلام المكافأة بعد ${cooldown(DAY-(now-u.lastDaily))}.`};if(!addCash(u,200))return{ok:false,message:'❌ وصلت إلى الحد الأقصى للرصيد.'};u.lastDaily=now;const levels=addXP(u,10);return{ok:true,message:`🎁 استلمت **200 ريال** كمكافأة يومية.${levels?` وصلت للمستوى ${u.level}!`:''}`};});}
async function workShift(id){return withUser(id,async u=>{if(!u.job||!JOBS[u.job])return{ok:false,message:'❌ اختر وظيفة من لوحة الوظائف أولاً.'};const now=Date.now();if(u.lastWork&&now-u.lastWork<WORK_COOLDOWN)return{ok:false,message:`⏰ يمكنك العمل بعد ${cooldown(WORK_COOLDOWN-(now-u.lastWork))}.`};const j=JOBS[u.job];if(!addCash(u,j.salary))return{ok:false,message:'❌ وصلت إلى الحد الأقصى للرصيد.'};u.lastWork=now;const levels=addXP(u,j.xp);return{ok:true,message:`💼 استلمت راتب وظيفة **${u.job}**: **${money(j.salary)} ريال**.${levels?` مستواك الآن ${u.level}.`:''}`};});}

async function prefixCommand(message){const text=message.content.trim();if(!text.startsWith('!'))return false;const parts=text.slice(1).split(/\s+/),cmd=parts.shift(),id=message.author.id;
  if(['مساعدة','اوامر','أوامر'].includes(cmd)){await message.reply('اكتب `!لوحة` لفتح كل الميزات التفاعلية. الأوامر القديمة `!حسابي` و`!راتب` ما زالت تعمل.');return true;}
  if(['لوحة','اقتصاد'].includes(cmd)){await message.reply({embeds:[makeEmbed('🏦 مركز الاقتصاد','مرحباً بك! اختر من الأزرار أدناه.')],components:panelRows()});return true;}
  if(['حسابي','حساب'].includes(cmd)){await message.reply({embeds:[await accountEmbed(id)]});return true;}
  if(['راتب','يومي'].includes(cmd)){const r=await dailyClaim(id);await message.reply(r.message);return true;}
  if(cmd==='بنك'){const u=await withUser(id,async x=>({...x}));await message.reply(`🏦 النقد: **${money(u.balance)}** | البنك: **${money(u.bank)}**\nاستخدم \`!لوحة\` للإيداع والسحب التفاعليين.`);return true;}
  if(cmd==='دوام'){const r=await workShift(id);await message.reply(r.message);return true;}
  if(cmd==='سوق'){const p=await marketPage();await message.reply({embeds:p.embeds,components:p.components});return true;}
  if(['متجر','المتجر'].includes(cmd)){const p=await storePage(id);await message.reply({embeds:p.embeds,components:p.components});return true;}
  if(['مقتنياتي','حقيبتي'].includes(cmd)){const p=await inventoryPage(id);await message.reply({embeds:p.embeds,components:p.components});return true;}
  if(['محفظتي','استثماراتي'].includes(cmd)){const p=await portfolioPage(id);await message.reply({embeds:p.embeds,components:p.components});return true;}
  if(cmd==='ترتيب'){const p=await leaderboardPage();await message.reply({embeds:p.embeds});return true;}
  return false;
}
client.on('messageCreate',async message=>{
  if(message.author.bot||!message.guild)return;
  try{if(message.content.trim().startsWith('!')){await prefixCommand(message);return;}
    await withUser(message.author.id,async u=>{const now=Date.now();if(u.lastXpMessage&&now-u.lastXpMessage<XP_COOLDOWN)return;u.lastXpMessage=now;const levels=addXP(u,5);if(levels)await message.channel.send(`🎉 ${message.author} ارتفع مستواك إلى **${u.level}**!`).catch(()=>{});});
  }catch(e){console.error('messageCreate:',e);await message.reply('❌ حدث خطأ أثناء تنفيذ الأمر.').catch(()=>{});}
});

client.on('interactionCreate',async interaction=>{
  try{
    if(interaction.isButton()){
      const id=interaction.customId;
      if(id.startsWith('panel:')){const page=id.split(':')[1];
        if(page==='account')return interaction.reply({embeds:[await accountEmbed(interaction.user.id)],ephemeral:true});
        if(page==='bank')return interaction.reply({embeds:[makeEmbed('🏦 البنك','اختر العملية:')],components:[row(btn('bank:deposit','إيداع',ButtonStyle.Success),btn('bank:withdraw','سحب',ButtonStyle.Primary))],ephemeral:true});
        if(page==='daily'){const r=await dailyClaim(interaction.user.id);return interaction.reply({content:r.message,ephemeral:true});}
        if(page==='market')return interaction.reply(await marketPage());
        if(page==='portfolio')return interaction.reply(await portfolioPage(interaction.user.id));
        if(page==='games')return interaction.reply(await gamesPage());
        if(page==='jobs')return interaction.reply(await jobsPage(interaction.user.id));
        if(page==='properties')return interaction.reply(await propertiesPage(interaction.user.id));
        if(page==='leaderboard')return interaction.reply(await leaderboardPage());
        if(page==='help')return interaction.reply({embeds:[makeEmbed('❔ المساعدة','اكتب `!لوحة` لفتح الواجهة. الأوامر: `!حسابي`، `!راتب`، `!متجر`، `!مقتنياتي`، `!سوق`. جميع العملات والمقتنيات افتراضية ولا توجد أموال حقيقية.')],ephemeral:true});
      }
      if(id.startsWith('store:confirm:')){
        const name=decodeURIComponent(id.slice('store:confirm:'.length)),item=STORE_ITEMS[name];
        if(!item)return interaction.reply({content:'❌ هذا الغرض غير متوفر.',ephemeral:true});
        const result=await withUser(interaction.user.id,async u=>{
          if(u.balance<item.price)return `❌ رصيدك غير كافٍ. تحتاج ${money(item.price-item.balance)} عملة إضافية.`.replace(`${money(item.price-item.balance)}`,money(item.price-u.balance));
          u.balance-=item.price;u.inventory=u.inventory||{};u.inventory[name]=Number(u.inventory[name]||0)+1;
          return `✅ اشتريت ${item.emoji} **${name}** مقابل ${money(item.price)} عملة افتراضية. رصيدك المتبقي: **${money(u.balance)}**.`;
        });
        return interaction.reply({content:result,ephemeral:true});
      }
      if(id==='bank:deposit')return interaction.showModal(modalAmount('modal:bank:deposit','إيداع في البنك','المبلغ المراد إيداعه'));
      if(id==='bank:withdraw')return interaction.showModal(modalAmount('modal:bank:withdraw','سحب من البنك','المبلغ المراد سحبه'));
      if(id.startsWith('market:buy:'))return interaction.showModal(modalTrade('buy',id.split(':')[2]));
      if(id.startsWith('market:sell:'))return interaction.showModal(modalTrade('sell',id.split(':')[2]));
      if(id.startsWith('game:'))return interaction.showModal(modalGame(id.split(':')[1]));
      if(id==='jobs:work'){const r=await workShift(interaction.user.id);return interaction.reply({content:r.message,ephemeral:true});}
      if(id.startsWith('property:buy:')){const name=id.split(':').slice(2).join(':');const result=await withUser(interaction.user.id,async u=>{const p=PROPERTIES[name];if(!p)return'❌ عقار غير صالح.';if(u.balance<p.price)return`❌ تحتاج ${money(p.price)} ريال نقداً.`;u.balance-=p.price;u.properties[name]=Number(u.properties[name]||0)+1;return`🏠 اشتريت **${name}** مقابل ${money(p.price)} ريال.`;});return interaction.reply({content:result,ephemeral:true});}
      if(id==='property:rent'){const result=await withUser(interaction.user.id,async u=>{const now=Date.now();if(u.lastRent&&now-u.lastRent<DAY)return`⏰ يمكنك تحصيل الإيجار بعد ${cooldown(DAY-(now-u.lastRent))}.`;const total=Object.entries(u.properties).reduce((s,[name,q])=>s+(PROPERTIES[name]?.rent||0)*Number(q||0),0);if(!total)return'🏠 لا تملك عقارات.';if(!addCash(u,total))return'❌ رصيدك بلغ الحد الأقصى.';u.lastRent=now;return`💵 تم تحصيل **${money(total)} ريال** من الإيجارات.`;});return interaction.reply({content:result,ephemeral:true});}
      if(id==='property:sell'){const u=await withUser(interaction.user.id,async x=>({...x}));const opts=Object.entries(PROPERTIES).filter(([name])=>Number(u.properties[name]||0)>0).map(([name,p])=>({label:name,value:name,description:`سعر البيع ${money(Math.floor(p.price*.8))} ريال`}));if(!opts.length)return interaction.reply({content:'ليس لديك عقارات للبيع.',ephemeral:true});return interaction.reply({content:'اختر العقار الذي تريد بيعه بسعر 80% من سعره الأصلي.',components:[row(new StringSelectMenuBuilder().setCustomId('property:sell-select').setPlaceholder('اختر العقار').addOptions(opts))],ephemeral:true});}
      if(id==='market:history'){const r=await pool.query('SELECT action,asset,quantity,unit_price,total FROM economy_trades WHERE discord_id=$1 ORDER BY id DESC LIMIT 5',[interaction.user.id]);return interaction.reply({embeds:[makeEmbed('🧾 آخر الصفقات',r.rows.map(t=>`• ${t.action==='buy'?'شراء':'بيع'} ${STOCKS[t.asset]?.name||t.asset} × ${t.quantity} بسعر ${money(t.unit_price)} — ${money(t.total)} ريال`).join('\n')||'لا توجد صفقات.')],ephemeral:true});}
    }
    if(interaction.isStringSelectMenu()){
      const id=interaction.customId;
      if(id==='store:buy'){
        const name=interaction.values[0],item=STORE_ITEMS[name];
        if(!item)return interaction.reply({content:'❌ هذا الغرض غير متوفر.',ephemeral:true});
        return interaction.update({embeds:[makeEmbed(`${item.emoji} شراء ${name}`,`${item.description}\n\nالسعر: **${money(item.price)} عملة افتراضية**\nهل تريد تأكيد الشراء؟`)],components:[row(btn(`store:confirm:${encodeURIComponent(name)}`,'تأكيد الشراء',ButtonStyle.Success,'🛒'),btn('panel:store','إلغاء',ButtonStyle.Secondary))]});
      }
      if(id==='market:asset'){const asset=interaction.values[0],p=await marketPrices();return interaction.update({embeds:[makeEmbed(`📊 تداول ${STOCKS[asset].name}`,`السعر الحالي **${money(p[asset])} ريال** للوحدة. اختر شراء أو بيع.`)],components:[row(btn(`market:buy:${asset}`,'شراء',ButtonStyle.Success),btn(`market:sell:${asset}`,'بيع',ButtonStyle.Danger))]});}
      if(id==='jobs:choose'){const name=interaction.values[0];const result=await withUser(interaction.user.id,async u=>{u.job=JOBS[name]?name:null;return`✅ تم تعيينك في وظيفة **${u.job}**. راتب الدوام ${JOBS[u.job].salary} ريال.`;});return interaction.reply({content:result,ephemeral:true});}
      if(id==='property:buy'){const name=interaction.values[0],p=PROPERTIES[name];return interaction.update({embeds:[makeEmbed(`🏠 شراء ${name}`,`السعر: **${money(p.price)} ريال**\nالإيجار اليومي: **${money(p.rent)} ريال**\nتأكيد الشراء؟`)],components:[row(btn(`property:buy:${name}`,'تأكيد الشراء',ButtonStyle.Success),btn('panel:properties','إلغاء',ButtonStyle.Secondary))]});}
      if(id==='property:sell-select'){const name=interaction.values[0];const result=await withUser(interaction.user.id,async u=>{if(Number(u.properties[name]||0)<1)return'❌ لا تملك هذا العقار.';const cash=Math.floor(PROPERTIES[name].price*.8);if(u.balance+cash>MAX_MONEY)return'❌ رصيدك بلغ الحد الأقصى.';u.properties[name]-=1;if(!u.properties[name])delete u.properties[name];u.balance+=cash;return`✅ بعت **${name}** مقابل ${money(cash)} ريال.`;});return interaction.update({content:result,embeds:[],components:[]});}
    }
    if(interaction.isModalSubmit()){
      const id=interaction.customId;
      if(id.startsWith('modal:bank:')){const action=id.split(':')[2],value=amount(interaction.fields.getTextInputValue('amount'));if(!value)return interaction.reply({content:'❌ أدخل مبلغاً صحيحاً موجباً.',ephemeral:true});const result=await withUser(interaction.user.id,async u=>{if(action==='deposit'){if(u.balance<value)return'❌ رصيدك النقدي لا يكفي.';if(u.bank+value>MAX_MONEY)return'❌ رصيد البنك بلغ الحد الأقصى.';u.balance-=value;u.bank+=value;return`✅ أودعت **${money(value)} ريال**.`;}if(u.bank<value)return'❌ رصيد البنك لا يكفي.';if(u.balance+value>MAX_MONEY)return'❌ رصيدك النقدي بلغ الحد الأقصى.';u.bank-=value;u.balance+=value;return`✅ سحبت **${money(value)} ريال**.`;});return interaction.reply({content:result,ephemeral:true});}
      if(id.startsWith('modal:trade:')){const [, ,action,asset]=id.split(':');if(!STOCKS[asset])return interaction.reply({content:'❌ سهم غير صالح.',ephemeral:true});const qty=amount(interaction.fields.getTextInputValue('quantity'));if(!qty||qty>1000000)return interaction.reply({content:'❌ أدخل كمية من 1 إلى 1,000,000.',ephemeral:true});const p=await marketPrices(),price=p[asset],total=qty*price;if(!Number.isSafeInteger(total)||total>MAX_MONEY)return interaction.reply({content:'❌ قيمة الصفقة كبيرة جداً.',ephemeral:true});const result=await withUser(interaction.user.id,async u=>{const held=Number(u.stocks[asset]||0);if(action==='buy'){if(u.balance<total)return'❌ لا تملك رصيداً كافياً.';if(held+qty>MAX_MONEY)return'❌ عدد الوحدات كبير جداً.';u.balance-=total;u.stocks[asset]=held+qty;await recordTrade(c,u.id,'buy',asset,qty,price);return{message:`✅ اشتريت **${money(qty)} وحدة من ${STOCKS[asset].name}** مقابل ${money(total)} ريال.`};}if(held<qty)return'❌ لا تملك وحدات كافية.';if(u.balance+total>MAX_MONEY)return'❌ رصيدك بلغ الحد الأقصى.';u.stocks[asset]=held-qty;if(!u.stocks[asset])delete u.stocks[asset];u.balance+=total;await recordTrade(c,u.id,'sell',asset,qty,price);return{message:`✅ بعت **${money(qty)} وحدة من ${STOCKS[asset].name}** مقابل ${money(total)} ريال.`};});if(typeof result==='string')return interaction.reply({content:result,ephemeral:true});return interaction.reply({content:result.message,ephemeral:true});}
      if(id.startsWith('modal:game:')){const game=id.split(':')[2],bet=amount(interaction.fields.getTextInputValue('bet'));if(!bet||bet>100000)return interaction.reply({content:'❌ الرهان من 1 إلى 100,000 ريال.',ephemeral:true});const guess=game==='guess'?Number(interaction.fields.getTextInputValue('guess')):null;if(game==='guess'&&(!Number.isInteger(guess)||guess<1||guess>5))return interaction.reply({content:'❌ خمن رقماً من 1 إلى 5.',ephemeral:true});const result=await withUser(interaction.user.id,async u=>{const now=Date.now();if(u.lastGame&&now-u.lastGame<GAME_COOLDOWN)return`⏰ انتظر ${cooldown(GAME_COOLDOWN-(now-u.lastGame))}.`;if(u.balance<bet)return'❌ لا تملك مبلغ الرهان.';let won=false,detail='';if(game==='coin'){const side=Math.random()<.5?'وجه':'كتابة';won=side==='وجه';detail=`🪙 النتيجة: **${side}**.`;}else if(game==='dice'){const dice=1+Math.floor(Math.random()*6);won=dice>=4;detail=`🎲 ظهر الرقم **${dice}**.`;}else if(game==='guess'){const actual=1+Math.floor(Math.random()*5);won=guess===actual;detail=`🔢 الرقم الصحيح **${actual}**.`;}else return'❌ لعبة غير معروفة.';u.lastGame=now;if(won){const payout=bet*(game==='guess'?4:2);if(!Number.isSafeInteger(payout)||u.balance-bet+payout>MAX_MONEY)return'❌ الربح يتجاوز الحد المسموح؛ لم يتم تنفيذ الرهان.';u.balance=u.balance-bet+payout;u.wins++;const levels=addXP(u,8);return`🎉 **فزت!** ${detail}\nالمبلغ الإجمالي المستلم: **${money(payout)} ريال**.${levels?` مستواك الآن ${u.level}.`:''}`;}u.balance-=bet;u.losses++;return`😔 **خسرت الجولة.** ${detail}\nخسرت ${money(bet)} ريال.`;});return interaction.reply({content:result,ephemeral:true});}
    }
  }catch(e){console.error('interactionCreate:',e);const response={content:'❌ حدث خطأ أثناء تنفيذ العملية. حاول مرة أخرى.',ephemeral:true};if(interaction.replied||interaction.deferred)await interaction.followUp(response).catch(()=>{});else await interaction.reply(response).catch(()=>{});}
});

setInterval(()=>refreshMarket().catch(e=>console.error('Market refresh:',e)),60000).unref();
async function main(){await initDb();app.listen(PORT,'0.0.0.0',()=>console.log(`🌐 HTTP server listening on ${PORT}`));await client.login(TOKEN);}
main().catch(e=>{console.error('❌ Startup failed:',e);process.exit(1);});
process.on('SIGTERM',async()=>{await client.destroy().catch(()=>{});await pool.end().catch(()=>{});process.exit(0);});
