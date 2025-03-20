// src/services/marketService.js
import axios from 'axios';

// API配置（请替换为你的API密钥）
const API_KEY = process.env.REACT_APP_FMP_API_KEY;
const BASE_URL = 'https://financialmodelingprep.com/api/v3';

// 市场指数配置（符号、名称、地理位置）
export const marketIndices = [
  { symbol: '^GSPC', name: '标普500', location: [40.7128, -74.0060], displayName: '标普500' },
  { symbol: '^DJI', name: '道琼斯', location: [40.7128, -74.0060], displayName: '道琼斯' },
  { symbol: '^IXIC', name: '纳斯达克', location: [40.7128, -73.8], displayName: '纳斯达克' },
  { symbol: '^FCHI', name: '法国CAC', location: [48.8566, 2.3522], displayName: '法国CAC' },
  { symbol: '^GDAXI', name: '德国DAX', location: [52.5200, 13.4050], displayName: '德国DAX' },
  { symbol: '^N225', name: '日经225', location: [35.6762, 139.6503], displayName: '日经225' },
  { symbol: '000001.SS', name: '上证指数', location: [31.2304, 121.4737], displayName: '上证指数' },
  { symbol: '399001.SZ', name: '深证成指', location: [22.5431, 114.0579], displayName: '深证成指' },
  { symbol: '^HSI', name: '恒生指数', location: [22.3193, 114.1694], displayName: '恒生指数' },
  { symbol: '^TWII', name: '台湾50', location: [25.0330, 121.5654], displayName: '台湾50' },
  { symbol: '^AXJO', name: 'ASX 200', location: [-33.8688, 151.2093], displayName: 'ASX 200' },
  { symbol: '^STI', name: '新加坡', location: [1.3521, 103.8198], displayName: '新加坡' },
  { symbol: '^KLSE', name: '马来西亚', location: [3.1390, 101.6869], displayName: '马来西亚' },
];

/**
 * 获取单个市场指数数据
 * @param {string} symbol - 市场指数代码
 * @returns {Promise<Object>} - 市场数据对象
 */
export const fetchMarketIndex = async (symbol) => {
  try {
    const url = `${BASE_URL}/quote/${symbol}?apikey=${API_KEY}`;
    const response = await axios.get(url);

    if (response.data && response.data.length > 0) {
      return response.data[0];
    }
    throw new Error(`无法获取${symbol}的数据`);
  } catch (error) {
    console.error(`获取${symbol}数据失败:`, error);
    throw error;
  }
};

/**
 * 获取所有配置的市场指数数据
 * @returns {Promise<Array>} - 市场数据数组
 */
export const fetchAllMarketIndices = async () => {
  try {
    // 构建批量请求URL
    const symbols = marketIndices.map(index => index.symbol).join(',');
    const url = `${BASE_URL}/quote/${symbols}?apikey=${API_KEY}`;

    const response = await axios.get(url);

    // 处理响应数据，结合位置信息和自定义格式
    return response.data.map(quote => {
      const marketInfo = marketIndices.find(m => m.symbol === quote.symbol);
      return {
        ...marketInfo,
        change: parseFloat(quote.changesPercentage).toFixed(2),
        price: quote.price,
        color: quote.changesPercentage >= 0 ? '#f44336' : '#4caf50',
        isPositive: quote.changesPercentage >= 0
      };
    });
  } catch (error) {
    console.error('获取市场数据失败:', error);

    // 如果API调用失败，返回模拟数据（用于开发或故障转移）
    return generateMockData();
  }
};

/**
 * 生成模拟市场数据（用于开发或API故障时）
 * @returns {Array} - 模拟市场数据数组
 */
const generateMockData = () => {
  return marketIndices.map(market => {
    const change = (Math.random() * 4 - 2).toFixed(2);
    const isPositive = parseFloat(change) >= 0;

    return {
      ...market,
      change,
      price: Math.floor(Math.random() * 5000) + 1000,
      color: isPositive ? '#f44336' : '#4caf50',
      isPositive
    };
  });
};

/**
 * 获取备用API数据（当主API不可用时）
 * 使用Alpha Vantage作为备用
 * @returns {Promise<Array>} - 市场数据数组
 */
export const fetchBackupMarketData = async () => {
  const ALPHA_VANTAGE_API_KEY = process.env.REACT_APP_ALPHA_VANTAGE_API_KEY;
  const promises = marketIndices.map(async (market) => {
    try {
      const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${market.symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`;
      const response = await axios.get(url);

      if (response.data && response.data['Global Quote']) {
        const quote = response.data['Global Quote'];
        const change = parseFloat(quote['10. change percent'].replace('%', '')).toFixed(2);
        const isPositive = parseFloat(change) >= 0;

        return {
          ...market,
          change,
          price: parseFloat(quote['05. price']),
          color: isPositive ? '#f44336' : '#4caf50',
          isPositive
        };
      }
      throw new Error(`无法从备用API获取${market.symbol}数据`);
    } catch (error) {
      console.error(`备用API获取${market.symbol}数据失败:`, error);
      // 返回带有错误标记的对象
      return { ...market, error: true, change: '0.00', color: '#999999' };
    }
  });

  return Promise.all(promises);
};