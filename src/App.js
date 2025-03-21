// src/App.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import WorldMap from './components/WorldMap';
import RefreshIndicator from './components/RefreshIndicator';
import useMarketData from './hooks/useMarketData';
import './App.css';

// 计算经纬度位置到屏幕坐标的转换
const geoToScreenPosition = (location, width, height) => {
  // 经度转换为x坐标（-180到180 => 0到width）
  const x = ((location[1] + 180) / 360) * width;
  // 纬度转换为y坐标（90到-90 => 0到height）
  const y = ((90 - location[0]) / 180) * height;
  return [x, y];
};

// 碰撞检测和位置调整算法
const optimizeBubbleLayout = (bubbles, width, height, bubbleSize) => {
  const radius = bubbleSize.width / 2;
  const minDistance = radius * 2.2; // 气泡之间的最小距离

  // 如果气泡数量少于5个，不需要优化
  if (bubbles.length < 5) {
    return bubbles.map(bubble => {
      const [x, y] = geoToScreenPosition(bubble.location, width, height);
      return { ...bubble, optimizedPosition: [x, y] };
    });
  }

  // 根据气泡大小转换坐标和半径到相对单位
  const scaledBubbles = bubbles.map(bubble => {
    const [x, y] = geoToScreenPosition(bubble.location, width, height);
    return {
      ...bubble,
      x,
      y,
      radius,
      originalX: x,
      originalY: y,
      // 添加碰撞力
      velocityX: 0,
      velocityY: 0
    };
  });

  // 增加迭代次数以处理更多气泡
  const iterationCount = Math.min(50, bubbles.length * 2);

  // 应用简单的力导向算法来分散重叠的气泡
  for (let iteration = 0; iteration < iterationCount; iteration++) {
    // 计算气泡之间的排斥力
    for (let i = 0; i < scaledBubbles.length; i++) {
      for (let j = i + 1; j < scaledBubbles.length; j++) {
        const b1 = scaledBubbles[i];
        const b2 = scaledBubbles[j];

        // 计算气泡之间的距离
        const dx = b2.x - b1.x;
        const dy = b2.y - b1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // 如果气泡重叠，应用排斥力
        if (distance < minDistance) {
          const overlap = (minDistance - distance) / 2;

          // 规范化方向向量
          const nx = dx / distance || 0;
          const ny = dy / distance || 0;

          // 应用位移（增加力度以更快分开）
          const forceFactor = Math.min(0.15, 10 / bubbles.length);
          b1.velocityX -= nx * overlap * forceFactor;
          b1.velocityY -= ny * overlap * forceFactor;
          b2.velocityX += nx * overlap * forceFactor;
          b2.velocityY += ny * overlap * forceFactor;
        }
      }
    }

    // 更新位置并应用限制
    for (const bubble of scaledBubbles) {
      // 应用向原始位置的吸引力（确保不会偏离太远）
      const homeForceX = (bubble.originalX - bubble.x) * 0.01;
      const homeForceY = (bubble.originalY - bubble.y) * 0.01;

      bubble.velocityX += homeForceX;
      bubble.velocityY += homeForceY;

      // 更新位置
      bubble.x += bubble.velocityX;
      bubble.y += bubble.velocityY;

      // 阻尼因子（减小以使气泡更快稳定）
      bubble.velocityX *= 0.6;
      bubble.velocityY *= 0.6;

      // 屏幕边界检查
      const margin = radius * 1.2;
      bubble.x = Math.max(margin, Math.min(width - margin, bubble.x));
      bubble.y = Math.max(margin, Math.min(height - margin, bubble.y));
    }
  }

  // 返回优化后的位置
  return scaledBubbles.map(bubble => ({
    ...bubble,
    optimizedPosition: [bubble.x, bubble.y]
  }));
};

const App = () => {
  // 使用自定义Hook管理市场数据和刷新逻辑
  const {
    marketData,
    previousMarketData,
    initialLoading,
    isRefreshing,
    refreshProgress,
    lastUpdated,
    error,
    refresh,
    updatedSymbols,
    bubblesTransitioning
  } = useMarketData(120000); // 2分钟刷新间隔

  // 处理容器尺寸
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const containerRef = useRef(null);

  // 保存优化后的气泡位置 - 关键变化：使用对象存储固定位置
  const [optimizedPositions, setOptimizedPositions] = useState({});
  const [tooltipData, setTooltipData] = useState(null);

  // 检测容器尺寸
  useEffect(() => {
    if (!containerRef.current) return;

    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight
        });
      }
    };

    // 初始化尺寸
    updateDimensions();

    // 监听窗口尺寸变化
    window.addEventListener('resize', updateDimensions);

    return () => {
      window.removeEventListener('resize', updateDimensions);
    };
  }, []);

  // 当屏幕尺寸变化时，重置位置缓存，强制重新计算布局
  useEffect(() => {
    setOptimizedPositions({});
  }, [dimensions.width, dimensions.height]);

  // 计算气泡大小（基于屏幕尺寸和市场数量）
  const getBubbleSize = useCallback(() => {
    // 基于市场数据的数量，动态调整气泡大小
    const count = marketData.length || previousMarketData.length || 0;

    if (dimensions.width < 768) {
      // 移动设备
      if (count > 25) {
        return { width: 40, height: 40, fontSize: 8 };
      } else if (count > 15) {
        return { width: 50, height: 50, fontSize: 9 };
      } else {
        return { width: 60, height: 60, fontSize: 10 };
      }
    } else if (dimensions.width < 1200) {
      // 平板设备
      if (count > 25) {
        return { width: 60, height: 60, fontSize: 10 };
      } else if (count > 15) {
        return { width: 70, height: 70, fontSize: 11 };
      } else {
        return { width: 80, height: 80, fontSize: 12 };
      }
    } else {
      // 桌面设备
      if (count > 25) {
        return { width: 70, height: 70, fontSize: 11 };
      } else if (count > 15) {
        return { width: 85, height: 85, fontSize: 13 };
      } else {
        return { width: 100, height: 100, fontSize: 14 };
      }
    }
  }, [dimensions.width, marketData.length, previousMarketData.length]);

  // 处理气泡悬停显示详情
  const handleBubbleHover = useCallback((event, market) => {
    setTooltipData({
      market,
      x: event.clientX,
      y: event.clientY
    });
  }, []);

  // 处理气泡离开隐藏详情
  const handleBubbleLeave = useCallback(() => {
    setTooltipData(null);
  }, []);

  // 渲染市场指数气泡
  const renderMarketBubbles = useCallback(() => {
    if (!marketData.length && !previousMarketData.length) return null;

    // 使用当前数据，如果刷新中使用之前数据作为基础（保持数据一致性）
    const currentData = marketData.length > 0 ? marketData : previousMarketData;
    const bubbleSize = getBubbleSize();

    // 判断是否需要重新计算布局
    // 仅在以下情况重新计算：
    // 1. 初次渲染时（optimizedPositions为空）
    // 2. 尺寸变化后（由上面的useEffect处理）
    // 3. 市场指数数量或符号变化
    const shouldRecalculatePositions =
      Object.keys(optimizedPositions).length === 0 ||
      Object.keys(optimizedPositions).length !== currentData.length ||
      currentData.some(item => !optimizedPositions[item.symbol]);

    // 计算或使用缓存的气泡位置
    let bubblePositions = {...optimizedPositions};

    if (shouldRecalculatePositions && dimensions.width > 0 && dimensions.height > 0) {
      // 使用优化算法计算气泡位置
      const optimizedBubbles = optimizeBubbleLayout(
        currentData,
        dimensions.width,
        dimensions.height,
        bubbleSize
      );

      // 将优化后的位置保存为对象，以符号为键
      const newPositions = {};
      optimizedBubbles.forEach(bubble => {
        if (bubble.symbol) {
          newPositions[bubble.symbol] = bubble.optimizedPosition;
        }
      });

      // 更新状态
      if (Object.keys(newPositions).length > 0) {
        setOptimizedPositions(newPositions);
        bubblePositions = newPositions;
      }
    }

    return currentData.map((market, index) => {
      // 使用缓存的优化位置而不是重新计算
      const position = bubblePositions[market.symbol] ||
        (market.location ? geoToScreenPosition(market.location, dimensions.width, dimensions.height) : [0, 0]);
      const [x, y] = position;

      // 当刷新时，查找匹配的新数据项以进行颜色/数值过渡
      const updatedMarket = isRefreshing && marketData.length > 0
        ? marketData.find(m => m.symbol === market.symbol) || market
        : market;

      // 计算过渡颜色（如果正在刷新且数据变化）
      const transitionColor = isRefreshing && updatedMarket !== market
        ? updatedMarket.color
        : market.color;

      // 检查此气泡是否需要特殊动画效果
      const isUpdated = updatedSymbols.has(market.symbol);

      // 动态计算气泡类名 - 只添加闪烁效果，不添加弹跳效果
      const bubbleClassName = `market-bubble ${isUpdated ? 'color-flash' : ''} ${bubblesTransitioning ? 'data-refreshing' : ''}`;

      return (
        <div key={market.symbol || index} className="market-bubble-container">
          {/* 市场指数气泡 */}
          <div
            className={bubbleClassName}
            style={{
              position: 'absolute',
              left: `${x}px`,
              top: `${y}px`,
              width: `${bubbleSize.width}px`,
              height: `${bubbleSize.height}px`,
              backgroundColor: transitionColor,
              borderRadius: '50%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              transform: 'translate(-50%, -50%)',
              color: 'white',
              fontWeight: 'bold',
              boxShadow: isUpdated
                ? '0 0 15px rgba(255, 255, 255, 0.4)'
                : '0 2px 10px rgba(0, 0, 0, 0.2)',
              zIndex: isUpdated ? 15 : 10
            }}
            onMouseEnter={(e) => handleBubbleHover(e, market)}
            onMouseLeave={handleBubbleLeave}
            onClick={(e) => handleBubbleHover(e, market)}
          >
            <div style={{ fontSize: `${bubbleSize.fontSize}px`, textAlign: 'center' }}>
              {updatedMarket.displayName}
            </div>
            <div style={{ fontSize: `${bubbleSize.fontSize}px`, marginTop: '2px' }}>
              {updatedMarket.isPositive ? '+' : ''}{updatedMarket.change}%
            </div>
          </div>
        </div>
      );
    });
  }, [marketData, previousMarketData, isRefreshing, getBubbleSize, updatedSymbols, bubblesTransitioning, handleBubbleHover, handleBubbleLeave, optimizedPositions, dimensions.width, dimensions.height]);

  // 渲染工具提示
  const renderTooltip = useCallback(() => {
    if (!tooltipData) return null;

    const { market, x, y } = tooltipData;

    // 计算工具提示位置，防止超出屏幕边界
    const tooltipX = Math.min(x + 10, window.innerWidth - 200);
    const tooltipY = Math.min(y + 10, window.innerHeight - 100);

    return (
      <div
        className="tooltip visible"
        style={{
          left: `${tooltipX}px`,
          top: `${tooltipY}px`
        }}
      >
        <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
          {market.name} ({market.symbol})
        </div>
        <div>价格: {market.price?.toLocaleString() || 'N/A'}</div>
        <div>
          涨跌幅: <span style={{ color: market.isPositive ? '#f44336' : '#4caf50' }}>
            {market.isPositive ? '+' : ''}{market.change}%
          </span>
        </div>
        {market.isMock && (
          <div style={{ marginTop: '5px', fontSize: '10px', opacity: 0.7 }}>
            (模拟数据)
          </div>
        )}
      </div>
    );
  }, [tooltipData]);

  // 渲染初始加载状态（仅首次加载显示）
  const renderLoading = () => (
    <div className="loading-container" style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      color: '#64b5f6', // 蓝色
      fontSize: '24px',
      zIndex: 100
    }}>
      <div className="loading-spinner" style={{
        width: '40px',
        height: '40px',
        margin: '0 auto 10px auto',
        animation: 'spin 1s linear infinite'
      }}></div>
      <div>加载市场数据中...</div>
    </div>
  );

  // 渲染错误信息
  const renderError = () => (
    <div className="error-container" style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      color: '#ff5252',
      fontSize: '18px',
      textAlign: 'center',
      zIndex: 100
    }}>
      <div style={{ fontSize: '32px', marginBottom: '10px' }}>⚠️</div>
      <div>{error}</div>
      <button
        className="refresh-button"
        style={{
          marginTop: '15px',
          padding: '8px 16px',
          backgroundColor: '#333',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
        onClick={refresh} // 使用自定义Hook的刷新函数
      >
        重新加载
      </button>
    </div>
  );

  // 渲染页面标题和更新时间
  const renderHeader = () => {
    return (
      <div className="app-header" style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        color: 'white',
        zIndex: 50,
        backgroundColor: 'rgba(8, 28, 49, 0.7)',
        padding: '15px 20px',
        borderRadius: '5px',
        backdropFilter: 'blur(5px)',
        border: '1px solid rgba(74, 149, 208, 0.2)',
        boxShadow: '0 5px 15px rgba(0, 0, 0, 0.3)'
      }}>
        <h1 style={{
          margin: '0 0 5px 0',
          fontSize: '24px',
          color: '#64b5f6',
          textShadow: '0 0 10px rgba(100, 181, 246, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <span>全球市场指数</span>
          {isRefreshing && (
            <span className="tech-pulse" style={{
              display: 'inline-block',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#64b5f6',
              marginLeft: '8px',
              animation: 'pulse 2s infinite ease-in-out'
            }}></span>
          )}
        </h1>
        <div style={{
          fontSize: '14px',
          opacity: 0.8,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>最后更新: {lastUpdated.toLocaleString()}</span>

          {/* 添加手动刷新按钮 */}
          <button
            className="refresh-button"
            onClick={refresh}
            disabled={isRefreshing}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64b5f6',
              cursor: isRefreshing ? 'default' : 'pointer',
              opacity: isRefreshing ? 0.5 : 1,
              marginLeft: '10px',
              padding: '2px 6px',
              fontSize: '12px',
              borderRadius: '3px',
              display: 'flex',
              alignItems: 'center',
              transition: 'all 0.2s ease'
            }}
          >
            <span style={{ marginRight: '3px' }} className="refresh-icon">⟳</span>
            <span>{isRefreshing ? '刷新中' : '刷新'}</span>
          </button>
        </div>
      </div>
    );
  };

  // 渲染统计信息
  const renderStats = () => {
    if (!marketData.length && !previousMarketData.length) return null;

    // 使用当前数据，如果刷新中也可以显示
    const currentData = marketData.length > 0 ? marketData : previousMarketData;

    // 计算上涨/下跌的市场数量
    const upCount = currentData.filter(m => m.isPositive).length;
    const downCount = currentData.length - upCount;

    return (
      <div className="market-stats" style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        color: 'white',
        background: 'rgba(8, 28, 49, 0.7)',
        padding: '10px 15px',
        borderRadius: '5px',
        fontSize: '14px',
        zIndex: 50,
        backdropFilter: 'blur(5px)',
        border: '1px solid rgba(74, 149, 208, 0.2)',
        transition: 'all 0.5s ease',
        boxShadow: '0 5px 15px rgba(0, 0, 0, 0.3)'
      }}>
        <div>市场趋势：</div>
        <div style={{ marginTop: '5px' }}>
          <span style={{ color: '#f44336', transition: 'all 0.5s ease' }}>上涨: {upCount}</span>
          <span style={{ margin: '0 5px' }}>|</span>
          <span style={{ color: '#4caf50', transition: 'all 0.5s ease' }}>下跌: {downCount}</span>
        </div>
      </div>
    );
  };

  // 渲染页脚和数据源信息
  const renderFooter = () => {
    return (
      <>
        <div className="data-source" style={{
          position: 'absolute',
          bottom: '10px',
          left: '15px',
          fontSize: '12px',
          color: 'rgba(100, 181, 246, 0.7)',
          backgroundColor: 'rgba(8, 28, 49, 0.6)',
          padding: '5px 8px',
          borderRadius: '3px'
        }}>
          数据来源: Financial Modeling Prep
        </div>
        <div className="app-footer" style={{
          position: 'absolute',
          bottom: '10px',
          right: '15px',
          fontSize: '12px',
          color: 'rgba(100, 181, 246, 0.7)',
          backgroundColor: 'rgba(8, 28, 49, 0.6)',
          padding: '5px 8px',
          borderRadius: '3px'
        }}>
          © {new Date().getFullYear()} 全球市场指数实时监控
        </div>
      </>
    );
  };

  // 主渲染方法
  return (
    <div
      ref={containerRef}
      className={`app-container ${isRefreshing ? 'data-refreshing' : ''}`}
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        backgroundColor: '#081c31' // 深蓝色背景
      }}
    >
      {/* 无感刷新进度指示器 */}
      <RefreshIndicator
        isRefreshing={isRefreshing}
        progress={refreshProgress}
        position="top"
      />

      {/* 世界地图背景 */}
      {dimensions.width > 0 && dimensions.height > 0 && (
        <WorldMap width={dimensions.width} height={dimensions.height} />
      )}

      {/* 标题和更新时间 */}
      {renderHeader()}

      {/* 市场统计 */}
      {(!initialLoading || previousMarketData.length > 0) && !error && renderStats()}

      {/* 初始加载状态 - 仅首次显示 */}
      {initialLoading && marketData.length === 0 && renderLoading()}

      {/* 错误信息 */}
      {error && renderError()}

      {/* 市场指数气泡 */}
      {(!initialLoading || previousMarketData.length > 0) && !error && renderMarketBubbles()}

      {/* 气泡工具提示 */}
      {renderTooltip()}

      {/* 页脚信息 */}
      {(!initialLoading || previousMarketData.length > 0) && !error && renderFooter()}

      {/* CSS动画 */}
      <style jsx="true">{`
          @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
          }

          @keyframes pulse {
              0% { opacity: 0.6; }
              50% { opacity: 1; }
              100% { opacity: 0.6; }
          }

          /* 颜色闪烁动画 */
          @keyframes colorFlash {
              0% {
                  filter: brightness(1);
                  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
              }
              25% {
                  filter: brightness(1.5);
                  box-shadow: 0 0 20px rgba(255, 255, 255, 0.5);
              }
              50% {
                  filter: brightness(1);
                  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
              }
              75% {
                  filter: brightness(1.3);
                  box-shadow: 0 0 15px rgba(255, 255, 255, 0.3);
              }
              100% {
                  filter: brightness(1);
                  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
              }
          }

          .color-flash {
              animation: colorFlash 1.2s ease-in-out;
          }
      `}</style>
    </div>
  );
};

export default App;