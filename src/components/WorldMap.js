// src/components/WorldMap.js
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';

// 世界地图背景组件
const WorldMap = ({ width, height }) => {
  const svgRef = useRef(null);

  useEffect(() => {
    // 如果组件未挂载或没有尺寸，不执行渲染
    if (!svgRef.current || !width || !height) return;

    const svg = d3.select(svgRef.current);

    // 清除旧内容
    svg.selectAll('*').remove();

    // 设置投影
    const projection = d3.geoMercator()
      .scale((width + 1) / 2 / Math.PI)
      .translate([width / 2, height / 1.7])
      .precision(0.1);

    // 创建地图路径生成器
    const path = d3.geoPath().projection(projection);

    // 加载世界地图数据
    d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
      .then(world => {
        // 从TopoJSON转换为GeoJSON
        const countries = topojson.feature(world, world.objects.countries);

        // 创建点状世界地图（模拟图片中的点阵效果）
        const dots = [];
        const dotsSpacing = 15; // 点之间的间距

        // 对每个国家生成点
        countries.features.forEach(feature => {
          // 使用投影获取国家边界框
          const bounds = path.bounds(feature);

          // 在边界框内生成均匀分布的点
          for (let x = bounds[0][0]; x < bounds[1][0]; x += dotsSpacing) {
            for (let y = bounds[0][1]; y < bounds[1][1]; y += dotsSpacing) {
              const point = [x, y];
              // 检查点是否在国家内
              const isInside = d3.geoContains(feature, projection.invert(point));
              if (isInside) {
                dots.push(point);
              }
            }
          }
        });

        // 绘制点状图
        svg.selectAll('circle')
          .data(dots)
          .enter()
          .append('circle')
          .attr('cx', d => d[0])
          .attr('cy', d => d[1])
          .attr('r', 1)
          .attr('fill', '#555')
          .attr('opacity', 0.3);

        // 添加国界线（可选）
        svg.append('g')
          .selectAll('path')
          .data(countries.features)
          .enter()
          .append('path')
          .attr('d', path)
          .attr('fill', 'none')
          .attr('stroke', '#333')
          .attr('stroke-width', 0.5)
          .attr('opacity', 0.2);
      })
      .catch(error => {
        console.error('加载或渲染世界地图时出错:', error);

        // 如果加载失败，创建备用点阵图
        createFallbackDotGrid(svg, width, height);
      });
  }, [width, height]);

  // 如果无法加载地图数据，创建简单的点阵网格
  const createFallbackDotGrid = (svg, width, height) => {
    const gridSize = 20;
    const dots = [];

    for (let x = 0; x < width; x += gridSize) {
      for (let y = 0; y < height; y += gridSize) {
        dots.push([x, y]);
      }
    }

    svg.selectAll('circle')
      .data(dots)
      .enter()
      .append('circle')
      .attr('cx', d => d[0])
      .attr('cy', d => d[1])
      .attr('r', 1)
      .attr('fill', '#555')
      .attr('opacity', 0.3);
  };

  return (
    <div className="world-map-container">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="world-map"
        style={{
          backgroundColor: 'transparent',
          overflow: 'visible'
        }}
      />
    </div>
  );
};

export default WorldMap;