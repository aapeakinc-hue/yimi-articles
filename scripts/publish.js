const fs = require('fs');
const path = require('path');

const config = require('../config.json');

function getTodayArticle() {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];
  const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
  const cycleDay = dayOfYear % 10;

  const articleMap = [
    'workplace-1',
    'workplace-2',
    'workplace-3',
    'love-1',
    'love-2',
    'family-1',
    'family-2',
    'life-1',
    'life-2',
    'mental-1'
  ];

  const articleKey = articleMap[cycleDay];
  const filename = `${dateStr}-${articleKey}.md`;
  return path.join(__dirname, '../articles', filename);
}

function readArticle(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`文章文件不存在: ${filePath}`);
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const metadata = {};
  let articleContent = [];
  let inMetadata = true;

  for (const line of lines) {
    if (line.trim() === '---') {
      if (inMetadata) {
        inMetadata = false;
        continue;
      }
    }

    if (inMetadata) {
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (match) {
        metadata[match[1]] = match[2];
      }
    } else {
      articleContent.push(line);
    }
  }

  return { metadata, content: articleContent.join('\n') };
}

function formatForWeChat(article) {
  const { metadata, content } = article;
  const category = metadata.category || 'general';
  const cta = config.templates.cta[category] || '扫码问一弭，获取建议';
  const footer = config.templates.footer;
  return content + '\n\n' + cta + footer;
}

// 生成今日文章文件
function generateTodayFile(formattedArticle, metadata) {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];
  
  // 确保输出目录存在
  const outputDir = path.join(__dirname, '../output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // 生成文件名
  const filename = `今日文章-${dateStr}.txt`;
  const filepath = path.join(outputDir, filename);
  
  // 生成文件内容（包含元数据和正文）
  const fileContent = `========================================
一弭 · 今日文章
========================================
发布日期: ${today.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
文章标题: ${metadata.title || '未命名'}
文章分类: ${metadata.category || '通用'}
文章标签: ${metadata.tags ? metadata.tags.join(', ') : '无'}
========================================

${formattedArticle}

========================================
发布说明：
1. 复制以上内容到公众号后台
2. 新建图文消息
3. 粘贴内容并调整格式
4. 配置封面图片
5. 点击群发
========================================
`;
  
  // 写入文件
  fs.writeFileSync(filepath, fileContent, 'utf-8');
  
  console.log('📄 今日文章文件已生成:', filename);
  console.log('📁 文件路径:', filepath);
  
  return filepath;
}

// 发布到公众号（个人号，生成文件供手动发布）
async function publishToWeChat(article) {
  console.log('正在准备今日文章内容...');
  console.log('标题:', article.metadata.title);
  console.log('分类:', article.metadata.category);

  // 生成今日文章文件
  const filepath = generateTodayFile(article.content, article.metadata);
  
  console.log('✅ 文章准备完成');
  console.log('');
  console.log('========================================');
  console.log('📋 复制以下内容到公众号：');
  console.log('========================================');
  console.log('');
  console.log(article.content);
  console.log('');
  console.log('========================================');
  console.log('📦 文件已生成，可从Actions Artifacts下载');
  console.log('========================================');
  
  return true;
}

async function main() {
  console.log('🚀 开始执行自动发布任务...');
  console.log('当前时间:', new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }));
  console.log('');

  const articlePath = getTodayArticle();
  console.log('今日文章路径:', articlePath);
  
  const article = readArticle(articlePath);
  if (!article) {
    console.error('❌ 无法读取文章');
    process.exit(1);
  }

  console.log('');
  console.log('原始文章标题:', article.metadata.title);
  console.log('原始文章长度:', article.content.length);
  console.log('');

  const formatted = formatForWeChat(article);
  console.log('文章已格式化，长度:', formatted.length);
  console.log('');
  
  try {
    const success = await publishToWeChat({ metadata: article.metadata, content: formatted });
    
    if (success) {
      console.log('');
      console.log('✅ 发布任务完成');
      console.log('');
      console.log('📌 下一步操作：');
      console.log('1. 在Actions页面找到本次运行记录');
      console.log('2. 点击 "Artifacts" 下载 "今日文章-YYYY-MM-DD.txt"');
      console.log('3. 打开文件，复制内容到公众号后台');
      console.log('4. 调整格式后群发');
    } else {
      console.error('❌ 发布失败');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ 发布异常:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);
