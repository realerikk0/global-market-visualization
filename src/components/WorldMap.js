// src/components/WorldMap.js
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';

// 科技风格世界地图背景组件
const WorldMap = ({ width, height }) => {
  const svgRef = useRef(null);

  useEffect(() => {
    // 如果组件未挂载或没有尺寸，不执行渲染
    if (!svgRef.current || !width || !height) return;

    // 检测是否为移动设备
    const isMobile = width < 768;

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

    // 添加渐变背景
    const defs = svg.append("defs");

    // 创建径向渐变
    const gradient = defs.append("radialGradient")
      .attr("id", "map-background-gradient")
      .attr("cx", "50%")
      .attr("cy", "50%")
      .attr("r", "70%");

    // 渐变起始颜色（中心，更亮）
    gradient.append("stop")
      .attr("offset", "0%")
      .attr("stop-color", "#0a2d4a");

    // 渐变结束颜色（边缘，更暗）
    gradient.append("stop")
      .attr("offset", "100%")
      .attr("stop-color", "#051829");

    // 添加背景矩形
    svg.append("rect")
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "url(#map-background-gradient)");

    // 加载世界地图数据
    d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
      .then(world => {
        // 从TopoJSON转换为GeoJSON
        const countries = topojson.feature(world, world.objects.countries);

        // 创建点状世界地图（模拟科技感点阵效果）
        const dots = [];
        // 移动设备上使用更大的点间距以提高性能
        const dotsSpacing = isMobile ? 25 : 15;

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

        // 添加国界线
        svg.append('g')
          .selectAll('path')
          .data(countries.features)
          .enter()
          .append('path')
          .attr('d', path)
          .attr('fill', 'none')
          .attr('stroke', '#4a95d0')  // 更亮的蓝色边界
          .attr('stroke-width', 0.5)
          .attr('opacity', 0.4);

        // 根据设备类型调整点的大小和不透明度
        const dotRadius = isMobile ? 0.8 : 1.2;
        const dotOpacity = isMobile ? 0.4 : 0.5;

        // 绘制点状图
        svg.selectAll('circle')
          .data(dots)
          .enter()
          .append('circle')
          .attr('cx', d => d[0])
          .attr('cy', d => d[1])
          .attr('r', dotRadius)
          .attr('fill', '#64b5f6')  // 亮蓝色点
          .attr('opacity', dotOpacity);

        // 添加网格线（增强科技感）
        // 移动设备上减少网格线数量
        const gridSize = isMobile ? 120 : 80;
        const gridLines = [];

        // 横向网格线
        for (let y = 0; y < height; y += gridSize) {
          gridLines.push([[0, y], [width, y]]);
        }

        // 纵向网格线
        for (let x = 0; x < width; x += gridSize) {
          gridLines.push([[x, 0], [x, height]]);
        }

        // 绘制网格线
        svg.selectAll('.grid-line')
          .data(gridLines)
          .enter()
          .append('line')
          .attr('x1', d => d[0][0])
          .attr('y1', d => d[0][1])
          .attr('x2', d => d[1][0])
          .attr('y2', d => d[1][1])
          .attr('stroke', '#1e5383')  // 深蓝色网格线
          .attr('stroke-width', 0.5)
          .attr('opacity', 0.2);

        // 根据设备选择装饰圆环数量
        const decorCircles = isMobile
          ? [
            // 移动设备上只显示1-2个装饰圆环
            { cx: width * 0.75, cy: height * 0.25, r: 30 },
            { cx: width * 0.25, cy: height * 0.75, r: 25 }
          ]
          : [
            // 桌面版显示更多装饰元素
            { cx: width * 0.1, cy: height * 0.2, r: 40 },
            { cx: width * 0.85, cy: height * 0.15, r: 30 },
            { cx: width * 0.75, cy: height * 0.8, r: 50 },
            { cx: width * 0.2, cy: height * 0.7, r: 35 }
          ];

        // 绘制装饰圆环
        decorCircles.forEach(circle => {
          svg.append('circle')
            .attr('cx', circle.cx)
            .attr('cy', circle.cy)
            .attr('r', circle.r)
            .attr('fill', 'none')
            .attr('stroke', '#4a95d0')
            .attr('stroke-width', 1)
            .attr('opacity', 0.15);

          svg.append('circle')
            .attr('cx', circle.cx)
            .attr('cy', circle.cy)
            .attr('r', circle.r * 0.8)
            .attr('fill', 'none')
            .attr('stroke', '#4a95d0')
            .attr('stroke-width', 0.5)
            .attr('opacity', 0.1);
        });
      })
      .catch(error => {
        console.error('加载或渲染世界地图时出错:', error);

        // 如果加载失败，创建备用科技风格背景
        createFallbackTechBackground(svg, width, height, isMobile);
      });
  }, [width, height]);

  // 如果无法加载地图数据，创建备用科技感背景
  const createFallbackTechBackground = (svg, width, height, isMobile) => {
    // 添加背景
    svg.append("rect")
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "#081c31");

    // 创建网格点阵 - 移动设备上使用更大的间距
    const gridSize = isMobile ? 30 : 20;
    const dots = [];

    for (let x = 0; x < width; x += gridSize) {
      for (let y = 0; y < height; y += gridSize) {
        dots.push([x, y]);
      }
    }

    // 点阵
    svg.selectAll('circle')
      .data(dots)
      .enter()
      .append('circle')
      .attr('cx', d => d[0])
      .attr('cy', d => d[1])
      .attr('r', isMobile ? 0.8 : 1.2)
      .attr('fill', '#64b5f6')
      .attr('opacity', isMobile ? 0.4 : 0.5);

    // 装饰线条 - 移动设备上减少线条
    const lineCount = isMobile ? 3 : 5;
    for (let i = 0; i < lineCount; i++) {
      svg.append('line')
        .attr('x1', 0)
        .attr('y1', height / lineCount * i)
        .attr('x2', width)
        .attr('y2', height / lineCount * i)
        .attr('stroke', '#1e5383')
        .attr('stroke-width', 0.5)
        .attr('opacity', 0.3);

      svg.append('line')
        .attr('x1', width / lineCount * i)
        .attr('y1', 0)
        .attr('x2', width / lineCount * i)
        .attr('y2', height)
        .attr('stroke', '#1e5383')
        .attr('stroke-width', 0.5)
        .attr('opacity', 0.3);
    }
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