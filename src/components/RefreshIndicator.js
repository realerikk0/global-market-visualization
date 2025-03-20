// src/components/RefreshIndicator.js
import React, { useEffect, useState } from 'react';

/**
 * 无感刷新指示器组件 - 显示微妙的刷新状态而不影响用户体验
 *
 * @param {Object} props
 * @param {boolean} props.isRefreshing - 是否正在刷新
 * @param {number} props.progress - 刷新进度 (0-100)
 * @param {string} props.position - 指示器位置 ('top', 'bottom', 默认 'top')
 * @param {string} props.color - 主色调 (默认 '#64b5f6')
 * @param {number} props.height - 进度条高度 (默认 2px)
 */
const RefreshIndicator = ({
  isRefreshing = false,
  progress = 0,
  position = 'top',
  color = '#64b5f6',
  height = 2
}) => {
  const [visible, setVisible] = useState(false);
  const [showProgress, setShowProgress] = useState(false);

  // 控制可见性逻辑
  useEffect(() => {
    let visibilityTimer;
    let progressTimer;

    if (isRefreshing) {
      // 立即显示指示器
      setVisible(true);

      // 延迟200ms显示进度条，避免闪烁
      progressTimer = setTimeout(() => {
        setShowProgress(true);
      }, 200);
    } else {
      // 延迟隐藏，等待过渡动画完成
      if (visible) {
        progressTimer = setTimeout(() => {
          setShowProgress(false);
        }, 100);

        visibilityTimer = setTimeout(() => {
          setVisible(false);
        }, 400);
      }
    }

    return () => {
      clearTimeout(visibilityTimer);
      clearTimeout(progressTimer);
    };
  }, [isRefreshing, visible]);

  // 计算位置样式
  const positionStyle = position === 'bottom'
    ? { bottom: 0, top: 'auto' }
    : { top: 0, bottom: 'auto' };

  // 如果不可见，不渲染组件
  if (!visible && !isRefreshing) return null;

  return (
    <div
      className="refresh-indicator-container"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        height: `${height}px`,
        zIndex: 9999,
        opacity: showProgress ? 1 : 0,
        transition: 'opacity 0.2s ease',
        ...positionStyle
      }}
    >
      <div
        className="refresh-indicator-track"
        style={{
          height: '100%',
          width: '100%',
          backgroundColor: `${color}20`, // 使用RGBA格式的半透明颜色
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* 确定进度模式 */}
        {progress > 0 && (
          <div
            className="refresh-indicator-progress"
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              height: '100%',
              width: `${progress}%`,
              backgroundColor: color,
              transition: 'width 0.3s ease'
            }}
          />
        )}

        {/* 不确定进度模式（动画） */}
        {progress === 0 && (
          <div
            className="refresh-indicator-indeterminate"
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              height: '100%',
              backgroundColor: color,
              width: '40%',
              animation: 'indeterminate-animation 1.5s infinite cubic-bezier(0.65, 0.815, 0.735, 0.395)'
            }}
          />
        )}
      </div>

      {/* 必要的CSS动画 */}
      <style jsx="true">{`
          @keyframes indeterminate-animation {
              0% {
                  left: -35%;
                  right: 100%;
              }
              60% {
                  left: 100%;
                  right: -90%;
              }
              100% {
                  left: 100%;
                  right: -90%;
              }
          }
      `}</style>
    </div>
  );
};

export default RefreshIndicator;