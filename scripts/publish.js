const fs = require('fs');
const path = require('path');
const https = require('https');

const config = require('../config.json');

// 从环境变量获取配置
const appId = process.env.WECHAT_APPID || config.wechat.appId;
const appSecret = process.env.WECHAT_APPSECRET || config.wechat.appSecret;

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

// 获取Access Token
function getAccessToken() {
  return new Promise((resolve, reject) => {
    const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`;
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.access_token) {
            resolve(response.access_token);
          } else {
            reject(new Error(`获取Access Token失败: ${response.errmsg}`));
          }
        } catch (e) {
          reject(new Error(`解析响应失败: ${e.message}`));
        }
      });
    }).on('error', (e) => {
      reject(new Error(`请求失败: ${e.message}`));
    });
  });
}

// 上传临时素材（用于图片）
function uploadMedia(accessToken, filePath, type = 'image') {
  return new Promise((resolve, reject) => {
    // 如果没有图片，跳过
    if (!filePath || !fs.existsSync(filePath)) {
      resolve(null);
      return;
    }
    
    // 读取文件
    const boundary = '----WebKitFormBoundary' + Date.now();
    const fileData = fs.readFileSync(filePath);
    
    const options = {
      hostname: 'api.weixin.qq.com',
      port: 443,
      path: `/cgi-bin/media/upload?access_token=${accessToken}&type=${type}`,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.media_id) {
            resolve(response.media_id);
          } else {
            resolve(null);
          }
        } catch (e) {
          resolve(null);
        }
      });
    });

    req.on('error', () => {
      resolve(null);
    });

    req.write(`--${boundary}\r\n`);
    req.write(`Content-Disposition: form-data; name="media"; filename="${path.basename(filePath)}"\r\n`);
    req.write(`Content-Type: image/jpeg\r\n\r\n`);
    req.write(fileData);
    req.write(`\r\n--${boundary}--\r\n`);
    req.end();
  });
}

// 发布图文素材
function addNews(accessToken, article) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      articles: [
        {
          title: article.metadata.title || '一弭智慧',
          author: article.metadata.author || '一弭',
          digest: article.content.substring(0, 100),
          content: article.content,
          content_source_url: 'https://onestand.cn',
          thumb_media_id: '', // 封面图片，留空使用默认
          show_cover_pic: 0,
          need_open_comment: 1,
          only_fans_can_comment: 0
        }
      ]
    });

    const options = {
      hostname: 'api.weixin.qq.com',
      port: 443,
      path: `/cgi-bin/draft/add?access_token=${accessToken}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.media_id || response.errcode === 0) {
            resolve(response.media_id);
          } else {
            reject(new Error(`发布失败: ${response.errmsg} (errcode: ${response.errcode})`));
          }
        } catch (e) {
          reject(new Error(`解析响应失败: ${e.message}`));
        }
      });
    });

    req.on('error', (e) => {
      reject(new Error(`请求失败: ${e.message}`));
    });

    req.write(postData);
    req.end();
  });
}

// 发布到公众号
async function publishToWeChat(article) {
  console.log('正在发布文章到公众号...');
  console.log('标题:', article.metadata.title);
  console.log('分类:', article.metadata.category);

  try {
    // 1. 获取Access Token
    console.log('📱 获取Access Token...');
    const accessToken = await getAccessToken();
    console.log('✅ Access Token获取成功');

    // 2. 发布图文素材
    console.log('📝 发布图文素材...');
    const mediaId = await addNews(accessToken, article);
    console.log('✅ 图文素材发布成功, media_id:', mediaId);

    // 3. （可选）发布草稿到公号
    // 如果需要直接发布，使用 freepublish/submit 接口
    console.log('✅ 文章发布成功');
    return true;

  } catch (error) {
    console.error('❌ 发布失败:', error.message);
    throw error;
  }
}

async function main() {
  console.log('🚀 开始执行自动发布任务...');
  
  // 检查配置
  if (!appId || !appSecret) {
    console.error('❌ 缺少公众号配置');
    console.error('请在GitHub Secrets中配置 WECHAT_APPID 和 WECHAT_APPSECRET');
    console.error('或者在 config.json 中配置 wechat.appId 和 wechat.appSecret');
    process.exit(1);
  }

  const articlePath = getTodayArticle();
  console.log('今日文章路径:', articlePath);
  
  const article = readArticle(articlePath);
  if (!article) {
    console.error('❌ 无法读取文章');
    process.exit(1);
  }

  const formatted = formatForWeChat(article);
  console.log('文章已格式化，长度:', formatted.length);
  
  try {
    const success = await publishToWeChat({ metadata: article.metadata, content: formatted });
    
    if (success) {
      console.log('✅ 发布任务完成');
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
