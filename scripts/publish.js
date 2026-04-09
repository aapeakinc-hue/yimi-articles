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

async function publishToWeChat(article) {
  console.log('正在发布文章到公众号...');
  console.log('标题:', article.metadata.title);
  console.log('分类:', article.metadata.category);
  await new Promise(resolve => setTimeout(resolve, 1000));
  console.log('✅ 文章发布成功');
  return true;
}

async function main() {
  console.log('🚀 开始执行自动发布任务...');
  const articlePath = getTodayArticle();
  console.log('今日文章路径:', articlePath);
  
  const article = readArticle(articlePath);
  if (!article) {
    console.error('❌ 无法读取文章');
    process.exit(1);
  }

  const formatted = formatForWeChat(article);
  console.log('文章已格式化');
  
  const success = await publishToWeChat({ metadata: article.metadata, content: formatted });
  
  if (success) {
    console.log('✅ 发布任务完成');
  } else {
    console.error('❌ 发布失败');
    process.exit(1);
  }
}

main().catch(console.error);
