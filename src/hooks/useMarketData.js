// src/hooks/useMarketData.js
import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchAllMarketIndices, getCacheStatus } from '../services/marketService';

/**
 * 对比市场数据变化
 * @param {Array} previous - 之前的市场数据
 * @param {Array} current - 当前的市场数据
 * @returns {Set|false} - 返回变化的符号集合，或者false表示没有变化
 */
const compareMarketData = (previous, current) => {
  if (!previous || !current) return false;
  if (previous.length === 0 || current.length === 0) return false;

  const updatedSymbols = new Set();

  current.forEach(currentItem => {
    const previousItem = previous.find(item => item.symbol === currentItem.symbol);
    if (previousItem) {
      // 只检查关键数据变化，如涨跌幅，而不是位置
      if (previousItem.change !== currentItem.change ||
        previousItem.isPositive !== currentItem.isPositive) {
        updatedSymbols.add(currentItem.symbol);
      }
    } else {
      // 新添加的指数
      updatedSymbols.add(currentItem.symbol);
    }
  });

  return updatedSymbols.size > 0 ? updatedSymbols : false;
};

/**
 * 市场数据获取和刷新管理的自定义Hook
 * @param {number} refreshInterval - 数据刷新间隔（毫秒）
 * @returns {Object} - 包含市场数据状态和控制函数的对象
 */
const useMarketData = (refreshInterval = 120000) => {
  const [marketData, setMarketData] = useState([]);
  const [previousMarketData, setPreviousMarketData] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [error, setError] = useState(null);

  // 添加用于控制气泡动画的状态
  const [updatedSymbols, setUpdatedSymbols] = useState(new Set());
  const [bubblesTransitioning, setBubblesTransitioning] = useState(false);

  // 引用保持以避免重复定时器
  const refreshTimerRef = useRef(null);
  const refreshIntervalRef = useRef(null);
  const progressTimerRef = useRef(null);

  // 手动刷新函数
  const manualRefresh = useCallback(async () => {
    // 防止重复刷新
    if (isRefreshing) return;

    try {
      // 标记为刷新状态
      setIsRefreshing(true);

      // 创建刷新进度动画
      setRefreshProgress(0);
      let progress = 0;

      // 清除之前的定时器
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
      }

      // 设置进度动画（假进度，主要是UI反馈）
      progressTimerRef.current = setInterval(() => {
        // 假进度算法 - 快速到达80%然后减缓
        const increment = progress < 80 ? 5 : 0.5;
        progress = Math.min(progress + increment, 95); // 最多到95%，留5%给实际完成
        setRefreshProgress(progress);
      }, 100);

      // 保存之前的市场数据以便颜色过渡动画
      if (marketData.length > 0) {
        setPreviousMarketData([...marketData]);
      }

      // 尝试获取最新市场数据（强制刷新忽略缓存）
      const data = await fetchAllMarketIndices(true);

      // 清除进度动画定时器
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }

      // 设置完成状态
      setRefreshProgress(100);

      // 检测数据变化
      if (marketData.length > 0) {
        const changedSymbols = compareMarketData(marketData, data);
        if (changedSymbols) {
          // 标记变化的符号
          setUpdatedSymbols(changedSymbols);

          // 启动过渡状态
          setBubblesTransitioning(true);

          // 延迟重置过渡状态
          setTimeout(() => {
            setBubblesTransitioning(false);
            setUpdatedSymbols(new Set());
          }, 1500);
        }
      }

      // 更新市场数据
      setMarketData(data);
      setLastUpdated(new Date());
      setError(null);

      // 延迟重置刷新状态（等待过渡动画完成）
      setTimeout(() => {
        setIsRefreshing(false);
        setRefreshProgress(0);
      }, 600);

      return true;
    } catch (err) {
      console.error('获取市场数据失败:', err);

      // 保存错误信息
      setError('无法获取市场数据。请稍后再试。');

      // 重置刷新状态
      setIsRefreshing(false);
      setRefreshProgress(0);

      // 清除进度动画
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }

      return false;
    } finally {
      // 只有在初始加载时才重置加载状态
      if (initialLoading) {
        setInitialLoading(false);
      }
    }
  }, [isRefreshing, initialLoading, marketData]);

  // 初始加载和定时刷新
  useEffect(() => {
    // 初始加载
    manualRefresh();

    // 设置定时刷新
    refreshIntervalRef.current = setInterval(() => {
      // 检查缓存状态，只有当缓存过期或不存在时才刷新
      const cacheStatus = getCacheStatus();
      const now = Date.now();

      // 如果没有缓存或者缓存已经超过刷新间隔的一半时间，执行刷新
      if (!cacheStatus.hasCachedData ||
        (now - cacheStatus.lastFetchTime > refreshInterval / 2)) {
        manualRefresh();
      }
    }, refreshInterval);

    // 返回清理函数
    return () => {
      // 在清理函数内，获取当前的ref值并保存在变量中
      const refreshInterval = refreshIntervalRef.current;
      const refreshTimer = refreshTimerRef.current;
      const progressTimer = progressTimerRef.current;

      // 使用局部变量而不是直接使用ref
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }
      if (progressTimer) {
        clearInterval(progressTimer);
      }
    };
  }, [manualRefresh, refreshInterval]);

  // 提供检查数据是否为模拟数据的函数
  const isMockData = useCallback(() => {
    if (!marketData || marketData.length === 0) return false;
    return marketData.some(item => item.isMock === true);
  }, [marketData]);

  // 返回数据状态和控制函数
  return {
    marketData,
    previousMarketData,
    initialLoading,
    isRefreshing,
    refreshProgress,
    lastUpdated,
    error,
    refresh: manualRefresh,
    setError,
    isMockData,
    // 新增的状态
    updatedSymbols,
    bubblesTransitioning,
    setBubblesTransitioning
  };
};

export default useMarketData;