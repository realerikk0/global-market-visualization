// src/App.js
import React, { useState, useEffect, useRef } from 'react';
import { fetchAllMarketIndices, fetchBackupMarketData } from './services/marketService';
import WorldMap from './components/WorldMap';
import './App.css';

// 计算经纬度位置到屏幕坐标的转换
const geoToScreenPosition = (location, width, height) => {
  // 经度转换为x坐标（-180到180 => 0到width）
  const x = ((location[1] + 180) / 360) * width;
  // 纬度转换为y坐标（90到-90 => 0到height）
  const y = ((90 - location[0]) / 180) * height;
  return [x, y];
};

const App = () => {
  const [marketData, setMarketData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const containerRef = useRef(null);

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

  // 获取市场数据
  useEffect(() => {
    const fetchMarketData = async () => {
      try {
        setLoading(true);
        // 尝试获取主要API数据
        const data = await fetchAllMarketIndices();
        setMarketData(data);
        setError(null);
      } catch (err) {
        console.error('主API数据获取失败，尝试备用API:', err);

        try {
          // 如果主API失败，尝试备用API
          const backupData = await fetchBackupMarketData();
          setMarketData(backupData);
          setError(null);
        } catch (backupErr) {
          console.error('备用API也失败了:', backupErr);
          setError('无法获取市场数据。请稍后再试。');
        }
      } finally {
        setLoading(false);
      }
    };

    // 初始加载
    fetchMarketData();

    // 设置定时刷新（每60秒）
    const intervalId = setInterval(fetchMarketData, 60000);

    return () => clearInterval(intervalId);
  }, []);

  // 计算气泡大小（基于屏幕尺寸）
  const getBubbleSize = () => {
    if (dimensions.width < 768) {
      return { width: 60, height: 60, fontSize: 10 };
    } else if (dimensions.width < 1200) {
      return { width: 80, height: 80, fontSize: 12 };
    } else {
      return { width: 100, height: 100, fontSize: 14 };
    }
  };

  // 渲染市场指数气泡
  const renderMarketBubbles = () => {
    if (!marketData.length) return null;

    const bubbleSize = getBubbleSize();

    return marketData.map((market, index) => {
      // 计算屏幕位置
      const [x, y] = geoToScreenPosition(market.location, dimensions.width, dimensions.height);

      return (
        <div key={index} className="market-bubble-container">
          {/* 市场指数气泡 */}
          <div
            className="market-bubble"
            style={{
              position: 'absolute',
              left: `${x}px`,
              top: `${y}px`,
              width: `${bubbleSize.width}px`,
              height: `${bubbleSize.height}px`,
              backgroundColor: market.color,
              borderRadius: '50%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              transform: 'translate(-50%, -50%)',
              transition: 'all 0.3s ease',
              color: 'white',
              fontWeight: 'bold',
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
              zIndex: 10
            }}
          >
            <div style={{ fontSize: `${bubbleSize.fontSize}px`, textAlign: 'center' }}>
              {market.displayName}
            </div>
            <div style={{ fontSize: `${bubbleSize.fontSize}px`, marginTop: '2px' }}>
              {market.isPositive ? '+' : ''}{market.change}%
            </div>
          </div>

          {/* 城市/市场名称标签 */}
          <div
            className="market-label"
            style={{
              position: 'absolute',
              left: `${x}px`,
              top: `${y + bubbleSize.height/2 + 5}px`,
              transform: 'translateX(-50%)',
              color: '#aaa',
              fontSize: `${bubbleSize.fontSize - 2}px`,
              textAlign: 'center',
              zIndex: 5
            }}
          >
            {market.name}
          </div>
        </div>
      );
    });
  };

  // 渲染加载状态
  const renderLoading = () => (
    <div className="loading-container" style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      color: 'white',
      fontSize: '24px',
      zIndex: 100
    }}>
      <div className="loading-spinner" style={{
        border: '4px solid rgba(255, 255, 255, 0.3)',
        borderRadius: '50%',
        borderTop: '4px solid #fff',
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
        style={{
          marginTop: '15px',
          padding: '8px 16px',
          backgroundColor: '#333',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
        onClick={() => window.location.reload()}
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
        zIndex: 50
      }}>
        <h1 style={{ margin: '0 0 5px 0', fontSize: '24px' }}>全球市场指数</h1>
        <div style={{ fontSize: '14px', opacity: 0.7 }}>
          最后更新: {new Date().toLocaleString()}
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
          color: 'rgba(255, 255, 255, 0.5)'
        }}>
          数据来源: Financial Modeling Prep
        </div>
        <div className="app-footer" style={{
          position: 'absolute',
          bottom: '10px',
          right: '15px',
          fontSize: '12px',
          color: 'rgba(255, 255, 255, 0.5)'
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
      className="app-container"
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        backgroundColor: '#1a1a1a' // 深色背景
      }}
    >
      {/* 世界地图背景 */}
      {dimensions.width > 0 && dimensions.height > 0 && (
        <WorldMap width={dimensions.width} height={dimensions.height} />
      )}

      {/* 标题和更新时间 */}
      {renderHeader()}

      {/* 加载状态 */}
      {loading && renderLoading()}

      {/* 错误信息 */}
      {error && renderError()}

      {/* 市场指数气泡 */}
      {!loading && !error && renderMarketBubbles()}

      {/* 页脚信息 */}
      {!loading && !error && renderFooter()}

      {/* CSS动画 */}
      <style jsx="true">{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default App;