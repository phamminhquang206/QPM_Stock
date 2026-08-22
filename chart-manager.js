/**
 * QPM Stock AI - Chart Manager
 * Renders interactive candlestick & volume charts using Lightweight Charts / HTML5 Canvas
 */

class StockChartManager {
    constructor(containerId) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        this.currentSymbol = 'FPT';
        this.currentTimeframe = '3M';
        this.chartInstance = null;
        this.candlestickSeries = null;
        this.volumeSeries = null;
        this.maSeries = null;
        this.chartType = 'candlestick'; // 'candlestick' or 'area'
        
        window.addEventListener('resize', () => this.handleResize());
    }

    init() {
        if (!this.container) return;
        this.container.innerHTML = '';

        if (window.LightweightCharts) {
            this.initLightweightChart();
        } else {
            console.log("LightweightCharts library loading or not found, using Canvas fallback.");
        }
    }

    initLightweightChart() {
        if (!this.container || !window.LightweightCharts) return;
        this.container.innerHTML = '';

        const width = this.container.clientWidth || 500;
        const height = this.container.clientHeight || 320;

        this.chartInstance = LightweightCharts.createChart(this.container, {
            width: width,
            height: height,
            layout: {
                background: { color: 'transparent' },
                textColor: '#94a3b8',
                fontFamily: "'Inter', sans-serif"
            },
            grid: {
                vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
                horzLines: { color: 'rgba(255, 255, 255, 0.05)' }
            },
            crosshair: {
                mode: LightweightCharts.CrosshairMode.Normal,
                vertLine: { color: 'rgba(124, 58, 237, 0.5)', width: 1, style: 3 },
                horzLine: { color: 'rgba(124, 58, 237, 0.5)', width: 1, style: 3 }
            },
            rightPriceScale: {
                borderColor: 'rgba(255, 255, 255, 0.1)',
                scaleMargins: { top: 0.1, bottom: 0.25 }
            },
            timeScale: {
                borderColor: 'rgba(255, 255, 255, 0.1)',
                timeVisible: true,
                secondsVisible: false
            }
        });

        // Candlestick Series (Vietnamese color standard: Green for Up, Red for Down)
        this.candlestickSeries = this.chartInstance.addCandlestickSeries({
            upColor: '#00d084',
            downColor: '#ff4d4f',
            borderVisible: false,
            wickUpColor: '#00d084',
            wickDownColor: '#ff4d4f'
        });

        // Volume Series
        this.volumeSeries = this.chartInstance.addHistogramSeries({
            priceFormat: { type: 'volume' },
            priceScaleId: '', // Overlay on same chart
            scaleMargins: { top: 0.8, bottom: 0 }
        });

        // Moving Average Line (MA20)
        this.maSeries = this.chartInstance.addLineSeries({
            color: '#f59e0b',
            lineWidth: 1.5,
            title: 'MA20'
        });
    }

    async loadStockData(symbol, days = 90) {
        this.currentSymbol = symbol.toUpperCase();
        
        try {
            const bars = await window.StockAPI.getHistoricalBars(this.currentSymbol, 'D', days);
            this.renderData(bars);
        } catch (err) {
            console.error(`Error loading chart data for ${symbol}:`, err);
        }
    }

    renderData(bars) {
        if (!bars || bars.length === 0) return;

        // Deduplicate bars by time and sort ascending
        const uniqueBarsMap = new Map();
        bars.forEach(b => {
            if (b.time !== undefined && b.time !== null) {
                uniqueBarsMap.set(b.time, b);
            }
        });
        const sortedBars = Array.from(uniqueBarsMap.values()).sort((a, b) => {
            return String(a.time).localeCompare(String(b.time));
        });

        if (sortedBars.length === 0) return;

        if (this.chartInstance && this.candlestickSeries) {
            // Format for Lightweight Charts
            const candleData = sortedBars.map(b => ({
                time: b.time,
                open: b.open,
                high: b.high,
                low: b.low,
                close: b.close
            }));

            const volumeData = sortedBars.map(b => ({
                time: b.time,
                value: b.volume,
                color: b.close >= b.open ? 'rgba(0, 208, 132, 0.35)' : 'rgba(255, 77, 79, 0.35)'
            }));

            // Calculate MA20
            const maData = [];
            for (let i = 19; i < sortedBars.length; i++) {
                const slice = sortedBars.slice(i - 19, i + 1);
                const avg = slice.reduce((sum, item) => sum + item.close, 0) / 20;
                maData.push({ time: sortedBars[i].time, value: Math.round(avg * 100) / 100 });
            }

            this.candlestickSeries.setData(candleData);
            this.volumeSeries.setData(volumeData);
            this.maSeries.setData(maData);
            this.chartInstance.timeScale().fitContent();
        } else {
            // Render on HTML5 Canvas Fallback
            this.renderCanvasFallback(sortedBars);
        }
    }

    renderCanvasFallback(bars) {
        if (!this.container) return;
        this.container.innerHTML = `<canvas id="fallback-chart-canvas" width="${this.container.clientWidth || 500}" height="300" style="width:100%; height:100%;"></canvas>`;
        const canvas = document.getElementById('fallback-chart-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        ctx.clearRect(0, 0, width, height);

        // Compute min/max
        const prices = bars.flatMap(b => [b.low, b.high]);
        const minP = Math.min(...prices) * 0.98;
        const maxP = Math.max(...prices) * 1.02;
        const rangeP = maxP - minP || 1;

        const padLeft = 10;
        const padRight = 60;
        const padTop = 20;
        const padBottom = 30;
        const chartW = width - padLeft - padRight;
        const chartH = height - padTop - padBottom;

        const barW = Math.max(3, (chartW / bars.length) * 0.7);
        const gap = chartW / bars.length;

        // Draw grid
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = padTop + (chartH / 4) * i;
            ctx.beginPath();
            ctx.moveTo(padLeft, y);
            ctx.lineTo(width - padRight, y);
            ctx.stroke();

            const pVal = maxP - (rangeP / 4) * i;
            ctx.fillStyle = '#64748b';
            ctx.font = '10px JetBrains Mono, monospace';
            ctx.fillText(Math.round(pVal).toLocaleString('vi-VN'), width - padRight + 6, y + 3);
        }

        // Draw candles
        bars.forEach((b, i) => {
            const x = padLeft + i * gap + gap / 2;
            const isUp = b.close >= b.open;
            const color = isUp ? '#00d084' : '#ff4d4f';

            const yHigh = padTop + chartH * (1 - (b.high - minP) / rangeP);
            const yLow = padTop + chartH * (1 - (b.low - minP) / rangeP);
            const yOpen = padTop + chartH * (1 - (b.open - minP) / rangeP);
            const yClose = padTop + chartH * (1 - (b.close - minP) / rangeP);

            // Wick
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(x, yHigh);
            ctx.lineTo(x, yLow);
            ctx.stroke();

            // Body
            ctx.fillStyle = color;
            const bodyTop = Math.min(yOpen, yClose);
            const bodyH = Math.max(2, Math.abs(yClose - yOpen));
            ctx.fillRect(x - barW / 2, bodyTop, barW, bodyH);
        });
    }

    handleResize() {
        if (this.chartInstance && this.container) {
            this.chartInstance.applyOptions({
                width: this.container.clientWidth,
                height: this.container.clientHeight || 320
            });
        }
    }
}

window.StockChartManager = StockChartManager;
