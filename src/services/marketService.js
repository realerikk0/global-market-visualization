// src/services/marketService.js
import axios from 'axios';

// API配置
const API_KEY = process.env.REACT_APP_FMP_API_KEY;
const BASE_URL = 'https://financialmodelingprep.com';

// 缓存配置
const CACHE_EXPIRY = 15000; // 缓存有效期15秒（毫秒）

// 创建axios实例并配置
const axiosInstance = axios.create({
  timeout: 10000, // 10秒超时
  retries: 2,     // 失败后重试次数
  retryDelay: 1000 // 重试间隔（毫秒）
});

// 添加重试逻辑
axiosInstance.interceptors.response.use(undefined, async (err) => {
  const config = err.config || {};

  // 如果已达到最大重试次数或未设置重试，则抛出错误
  if (!config.retries) {
    return Promise.reject(err);
  }

  // 更新重试计数
  config.retries = config.retries - 1;
  config.retryCount = (config.retryCount || 0) + 1;

  // 计算延迟重试时间（指数退避策略）
  const delay = config.retryDelay * Math.pow(2, config.retryCount - 1);

  // 创建延迟重试
  await new Promise(resolve => setTimeout(resolve, delay));

  // 重试请求
  return axiosInstance(config);
});

// 市场指数配置（符号、名称、地理位置 - 经过调整以避免重叠）
export const marketIndices = [
  { symbol: '^GSPC', name: '标普500', location: [40.7128, -73.0060], displayName: '标普500' },
  { symbol: '^DJI', name: '道琼斯', location: [39.5, -75.0060], displayName: '道琼斯' },
  { symbol: '^IXIC', name: '纳斯达克', location: [41.5, -73.8], displayName: '纳斯达克' },
  { symbol: '^FCHI', name: '法国CAC', location: [48.8566, 2.3522], displayName: '法国CAC' },
  { symbol: '^GDAXI', name: '德国DAX', location: [52.5200, 13.4050], displayName: '德国DAX' },
  { symbol: '^N225', name: '日经225', location: [35.6762, 142.6503], displayName: '日经225' },
  { symbol: '000001.SS', name: '上证指数', location: [32.5, 119.5], displayName: '上证指数' },
  { symbol: '399001.SZ', name: '深证成指', location: [22.5431, 116.5], displayName: '深证成指' },
  { symbol: '^HSI', name: '恒生指数', location: [22.3193, 112.0], displayName: '恒生指数' },
  { symbol: '^TWII', name: '台湾50', location: [25.0330, 123.9], displayName: '台湾50' },
  { symbol: '^AXJO', name: 'ASX 200', location: [-33.8688, 153.5], displayName: 'ASX 200' },
  { symbol: '^STI', name: '新加坡', location: [1.3521, 106.8], displayName: '新加坡' },
  { symbol: '^KLSE', name: '马来西亚', location: [3.1390, 103.5], displayName: '马来西亚' },
  { symbol: '^FTSE', name: '富时100', location: [51.5074, -0.1278], displayName: '富时100' },
  { symbol: '^STOXX50E', name: '欧洲50', location: [50.8503, 4.3517], displayName: '欧洲50' },
  { symbol: '^BSESN', name: '印度孟买', location: [19.0760, 72.8777], displayName: '印度孟买' },
  { symbol: '^NSEI', name: '印度NIFTY', location: [28.6139, 77.2090], displayName: '印度NIFTY' },
  { symbol: '^MERV', name: '阿根廷', location: [-34.6037, -58.3816], displayName: '阿根廷' },
  { symbol: '^BVSP', name: '巴西', location: [-23.5505, -46.6333], displayName: '巴西' },
  { symbol: '^MXX', name: '墨西哥', location: [19.4326, -99.1332], displayName: '墨西哥' }
];

// 数据缓存系统
const dataCache = {
  marketData: null,       // 缓存的市场数据
  lastFetchTime: 0,       // 上次获取数据的时间戳
  isRefreshing: false,    // 是否正在刷新数据的标志
  pendingPromise: null,   // 正在进行的请求Promise
  backupData: null,       // 备用数据（模拟数据）
  lastError: null         // 最后一次错误
};

/**
 * 处理API返回的数据
 * @param {Array} data - API返回的原始数据
 * @returns {Array} - 处理后的市场数据
 */
const processMarketData = (data) => {
  // 创建市场符号到信息的映射
  const marketInfoMap = {};
  marketIndices.forEach(info => {
    marketInfoMap[info.symbol] = info;
  });

  return data
    .filter(quote => {
      // 只处理我们关心的市场指数
      const marketInfo = marketInfoMap[quote.symbol];
      return marketInfo != null;
    })
    .map(quote => {
      const marketInfo = marketInfoMap[quote.symbol];
      // 获取涨跌幅，如果API返回的是绝对变化值，则计算百分比
      let changesPercentage = quote.change;
      if (quote.price && quote.change && typeof quote.price === 'number' && typeof quote.change === 'number') {
        // 如果服务器没有返回百分比，我们计算一个近似值
        changesPercentage = (quote.change / (quote.price - quote.change)) * 100;
      }

      return {
        ...marketInfo,
        change: parseFloat(changesPercentage).toFixed(2),
        price: quote.price,
        color: changesPercentage >= 0 ? '#f44336' : '#4caf50', // 红涨绿跌（中国配色）
        isPositive: changesPercentage >= 0,
        timestamp: new Date().getTime(),
        volume: quote.volume || 0
      };
    });
};

/**
 * 获取所有配置的市场指数数据
 * @param {boolean} forceRefresh - 是否强制刷新，忽略缓存
 * @returns {Promise<Array>} - 市场数据数组
 */
export const fetchAllMarketIndices = async (forceRefresh = false) => {
  const now = Date.now();

  // 如果没有强制刷新且缓存有效，返回缓存数据
  if (!forceRefresh &&
    dataCache.marketData &&
    now - dataCache.lastFetchTime < CACHE_EXPIRY) {
    return dataCache.marketData;
  }

  // 如果已经有正在进行的请求，返回该请求的Promise
  if (dataCache.isRefreshing && dataCache.pendingPromise) {
    return dataCache.pendingPromise;
  }

  // 标记为正在刷新
  dataCache.isRefreshing = true;

  // 创建并存储请求Promise
  dataCache.pendingPromise = (async () => {
    try {
      // 使用批量指数API端点
      const url = `${BASE_URL}/stable/batch-index-quotes?apikey=${API_KEY}`;

      const response = await axiosInstance.get(url);

      // 验证响应
      if (!response.data || !Array.isArray(response.data) || response.data.length === 0) {
        throw new Error('API没有返回有效的数据');
      }

      // 处理数据
      const processedData = processMarketData(response.data);

      // 检查数据有效性
      if (!processedData || processedData.length === 0) {
        throw new Error('处理后的数据无效或为空');
      }

      // 更新缓存
      dataCache.marketData = processedData;
      dataCache.lastFetchTime = now;
      dataCache.lastError = null;

      console.log(`成功获取了 ${processedData.length} 个市场指数数据`);

      return processedData;
    } catch (error) {
      console.error('获取市场数据失败:', error);
      dataCache.lastError = error;

      // 如果有缓存数据，作为故障转移返回
      if (dataCache.marketData) {
        console.log('使用缓存数据作为故障转移');
        return dataCache.marketData;
      }

      // 如果有备用数据，返回备用数据
      if (dataCache.backupData) {
        return dataCache.backupData;
      }

      // 生成并缓存模拟数据
      const mockData = generateMockData();
      dataCache.backupData = mockData;
      return mockData;
    } finally {
      // 重置状态
      dataCache.isRefreshing = false;
      dataCache.pendingPromise = null;
    }
  })();

  return dataCache.pendingPromise;
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
      color: isPositive ? '#f44336' : '#4caf50', // 红涨绿跌（中国配色）
      isPositive,
      isMock: true, // 标记为模拟数据
      volume: Math.floor(Math.random() * 100000000)
    };
  });
};

/**
 * 获取单个市场指数数据
 * @param {string} symbol - 市场指数代码
 * @returns {Promise<Object>} - 市场数据对象
 */
export const fetchMarketIndex = async (symbol) => {
  try {
    // 先尝试从批量数据中查找
    const allData = await fetchAllMarketIndices();
    const marketData = allData.find(m => m.symbol === symbol);

    if (marketData) {
      return marketData;
    }

    // 如果没有找到，尝试单独请求
    const url = `${BASE_URL}/api/v3/quote/${symbol}?apikey=${API_KEY}`;
    const response = await axiosInstance.get(url);

    if (response.data && response.data.length > 0) {
      const quote = response.data[0];
      const marketInfo = marketIndices.find(m => m.symbol === symbol) || { symbol, name: symbol, displayName: symbol };

      return {
        ...marketInfo,
        change: parseFloat(quote.changesPercentage).toFixed(2),
        price: quote.price,
        color: quote.changesPercentage >= 0 ? '#f44336' : '#4caf50',
        isPositive: quote.changesPercentage >= 0
      };
    }
    throw new Error(`无法获取${symbol}的数据`);
  } catch (error) {
    console.error(`获取${symbol}数据失败:`, error);
    throw error;
  }
};

/**
 * 获取备用API数据（当主API不可用时）
 * 使用Alpha Vantage作为备用
 * @returns {Promise<Array>} - 市场数据数组
 */
export const fetchBackupMarketData = async () => {
  const ALPHA_VANTAGE_API_KEY = process.env.REACT_APP_ALPHA_VANTAGE_API_KEY;

  if (!ALPHA_VANTAGE_API_KEY) {
    console.warn('未配置Alpha Vantage API密钥, 无法使用备用API');
    return generateMockData();
  }

  try {
    const promises = marketIndices.map(async (market) => {
      try {
        const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${market.symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`;
        const response = await axiosInstance.get(url);

        if (response.data && response.data['Global Quote']) {
          const quote = response.data['Global Quote'];
          const change = parseFloat(quote['10. change percent'].replace('%', '')).toFixed(2);
          const isPositive = parseFloat(change) >= 0;

          return {
            ...market,
            change,
            price: parseFloat(quote['05. price']),
            color: isPositive ? '#f44336' : '#4caf50',
            isPositive,
            source: 'backup' // 标记为备用数据源
          };
        }
        throw new Error(`无法从备用API获取${market.symbol}数据`);
      } catch (error) {
        console.error(`备用API获取${market.symbol}数据失败:`, error);
        // 返回带有错误标记的对象
        return {
          ...market,
          error: true,
          change: '0.00',
          price: 0,
          color: '#999999',
          isPositive: false
        };
      }
    });

    const results = await Promise.all(promises);

    // 如果所有结果都有错误，生成模拟数据
    if (results.every(item => item.error)) {
      return generateMockData();
    }

    return results;
  } catch (error) {
    console.error('备用API获取数据失败:', error);
    return generateMockData();
  }
};

/**
 * 获取缓存状态信息
 * @returns {Object} - 缓存状态信息
 */
export const getCacheStatus = () => {
  return {
    hasCachedData: !!dataCache.marketData,
    lastFetchTime: dataCache.lastFetchTime,
    isRefreshing: dataCache.isRefreshing,
    hasError: !!dataCache.lastError,
    errorMessage: dataCache.lastError ? dataCache.lastError.message : null,
    dataAge: dataCache.lastFetchTime ? Date.now() - dataCache.lastFetchTime : null
  };
};

/**
 * 清除数据缓存
 */
export const clearCache = () => {
  dataCache.marketData = null;
  dataCache.lastFetchTime = 0;
  dataCache.backupData = null;
  dataCache.lastError = null;
  console.log('市场数据缓存已清除');
};

/**
 * 预加载模拟数据（用于开发环境快速启动）
 */
export const preloadMockData = () => {
  if (!dataCache.backupData) {
    dataCache.backupData = generateMockData();
  }
};

// 开发环境下预加载模拟数据
if (process.env.NODE_ENV === 'development') {
  preloadMockData();
}

// 导出服务
const marketServiceExports = {
  fetchAllMarketIndices,
  fetchMarketIndex,
  fetchBackupMarketData,
  getCacheStatus,
  clearCache,
  marketIndices
};

export default marketServiceExports;