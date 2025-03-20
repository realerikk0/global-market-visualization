# 全球市场指数地图项目

这个项目实现了一个实时显示全球各大市场指数变化的可视化应用，类似于您提供的图片。

## 技术选择理由

1. **React**: 轻量级、组件化的前端框架，非常适合构建单页应用
2. **D3.js**: 强大的数据可视化库，用于绘制世界地图和市场指数气泡
3. **Cloudflare Pages**: 快速、可靠的网站托管服务，全球CDN网络有利于提高应用访问速度
4. **Financial Modeling Prep API**: 提供全球市场指数数据，有免费套餐可用

## 项目设置步骤

### 1. 创建React项目

```bash
# 使用Create React App创建项目
npx create-react-app global-market-indices
cd global-market-indices

# 安装必要的依赖
npm install d3 axios lodash
```

### 2. 申请金融API密钥

选择以下任一金融数据API:

- **Financial Modeling Prep**：注册并获取免费API密钥: https://financialmodelingprep.com/
- **Alpha Vantage**：申请免费API密钥: https://www.alphavantage.co/

### 3. 添加核心文件

#### src/components/WorldMap111.js
负责渲染世界地图背景

#### src/components/MarketBubble.js
创建市场指数气泡组件

#### src/services/marketService.js
处理API调用和数据处理

#### src/utils/helpers.js
提供辅助工具函数

### 4. API数据获取实现

```javascript
// src/services/marketService.js
import axios from 'axios';

const API_KEY = 'your_api_key_here';
const BASE_URL = 'https://financialmodelingprep.com/api/v3';

// 市场指数配置
export const marketIndices = [
  { symbol: '^GSPC', name: '标普500', location: [40.7128, -74.0060], country: 'US' },
  { symbol: '^DJI', name: '道琼斯', location: [40.7128, -74.0060], country: 'US' },
  { symbol: '^IXIC', name: '纳斯达克', location: [40.7128, -74.0060], country: 'US' },
  { symbol: '^FCHI', name: '法国CAC', location: [48.8566, 2.3522], country: 'France' },
  { symbol: '^GDAXI', name: '德国DAX', location: [52.5200, 13.4050], country: 'Germany' },
  { symbol: '^N225', name: '日经225', location: [35.6762, 139.6503], country: 'Japan' },
  { symbol: '000001.SS', name: '上证指数', location: [31.2304, 121.4737], country: 'China' },
  { symbol: '399001.SZ', name: '深证成指', location: [22.5431, 114.0579], country: 'China' },
  { symbol: '^HSI', name: '恒生指数', location: [22.3193, 114.1694], country: 'HongKong' },
  { symbol: '^TWII', name: '台湾50', location: [25.0330, 121.5654], country: 'Taiwan' },
  { symbol: '^AXJO', name: 'ASX 200', location: [-33.8688, 151.2093], country: 'Australia' },
  { symbol: '^STI', name: '新加坡', location: [1.3521, 103.8198], country: 'Singapore' },
  { symbol: '^KLSE', name: '马来西亚', location: [3.1390, 101.6869], country: 'Malaysia' },
];

export const fetchAllMarketIndices = async () => {
  try {
    // 根据API需求构建请求URL
    const symbols = marketIndices.map(index => index.symbol).join(',');
    const url = `${BASE_URL}/quote/${symbols}?apikey=${API_KEY}`;
    
    const response = await axios.get(url);
    
    // 处理响应数据，结合位置信息
    const processedData = response.data.map(quote => {
      const marketInfo = marketIndices.find(m => m.symbol === quote.symbol);
      return {
        ...quote,
        ...marketInfo,
        change: quote.changesPercentage,
        color: quote.changesPercentage >= 0 ? '#f44336' : '#4caf50'
      };
    });
    
    return processedData;
  } catch (error) {
    console.error('Error fetching market data:', error);
    throw error;
  }
};
```

### 5. 部署到Cloudflare Pages

1. **创建项目构建**:
```bash
npm run build
```

2. **设置Cloudflare Pages**:
   - 在Cloudflare控制台创建新的Pages项目
   - 连接你的GitHub/GitLab仓库
   - 设置构建命令: `npm run build`
   - 设置构建输出目录: `build`
   - 添加环境变量: `REACT_APP_API_KEY=your_api_key`

3. **部署触发**:
   - 每次将代码推送到仓库，Cloudflare Pages会自动部署

## 项目扩展建议

1. **添加更多市场指数**: 扩展列表以包含更多全球市场
2. **历史数据**: 添加查看过去表现的功能
3. **自定义视图**: 允许用户选择感兴趣的特定市场
4. **移动响应式设计**: 优化移动设备用户体验
5. **夜间模式**: 添加深色/浅色主题切换

## 注意事项

1. 大多数金融API在免费套餐中有请求限制，需合理控制刷新频率
2. 在生产环境中，应始终使用环境变量存储API密钥，不要硬编码
3. 考虑添加错误处理和重试机制，确保数据显示稳定性
