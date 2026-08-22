/**
 * QPM Stock AI - Main Application Controller
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Components
    const agent = new window.GeminiStockAgent();
    
    // UI Elements
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const btnSend = document.getElementById('btn-send');
    const promptChips = document.getElementById('prompt-chips');
    const marketTickerBar = document.getElementById('market-ticker-bar');
    const searchInput = document.getElementById('search-input');
    const apiKeyModal = document.getElementById('api-key-modal');
    const btnOpenSettings = document.getElementById('btn-open-settings');
    const btnCloseModal = document.getElementById('btn-close-modal');
    const btnSaveSettings = document.getElementById('btn-save-settings');
    const btnTestApi = document.getElementById('btn-test-api');
    const btnFetchModels = document.getElementById('btn-fetch-models');
    const inputApiKey = document.getElementById('input-api-key');
    const selectModel = document.getElementById('select-model');
    const apiStatusDot = document.getElementById('api-status-dot');
    const apiStatusText = document.getElementById('api-status-text');
    const testResult = document.getElementById('test-result');

    // Inspector Elements
    const heroSymbol = document.getElementById('hero-symbol');
    const heroName = document.getElementById('hero-name');
    const heroPrice = document.getElementById('hero-price');
    const heroChange = document.getElementById('hero-change');
    const metricOpen = document.getElementById('metric-open');
    const metricRef = document.getElementById('metric-ref');
    const metricCeilFloor = document.getElementById('metric-ceil-floor');
    const metricVol = document.getElementById('metric-vol');
    const metricForeignBuySell = document.getElementById('metric-foreign-buy-sell');
    const metricHighLow = document.getElementById('metric-highlow');
    const watchlistContainer = document.getElementById('watchlist-items');

    let currentSelectedTicker = 'FPT';
    window.currentStockTicker = 'FPT';
    const defaultWatchlist = ['FPT', 'HPG', 'SSI', 'PVS', 'SHS', 'BSR', 'ACV', 'MCH'];

    // 2. Initial Load
    loadTickerToInspector('FPT');
    loadMarketTicker();
    loadWatchlist();
    updateApiKeyStatusUI();

    // Auto-refresh market indices every 30s
    setInterval(loadMarketTicker, 30000);

    // 3. API Key & Settings Event Handlers
    btnOpenSettings.addEventListener('click', () => {
        inputApiKey.value = agent.getApiKey();
        selectModel.value = agent.selectedModel;
        testResult.textContent = '';
        apiKeyModal.classList.add('active');
    });

    btnCloseModal.addEventListener('click', () => {
        apiKeyModal.classList.remove('active');
    });

    apiKeyModal.addEventListener('click', (e) => {
        if (e.target === apiKeyModal) apiKeyModal.classList.remove('active');
    });

    btnSaveSettings.addEventListener('click', () => {
        const key = inputApiKey.value.trim();
        agent.setApiKey(key);
        agent.setModel(selectModel.value);
        updateApiKeyStatusUI();
        apiKeyModal.classList.remove('active');
    });

    btnFetchModels.addEventListener('click', async () => {
        const key = inputApiKey.value.trim() || agent.getApiKey();
        if (!key) {
            testResult.textContent = '⚠️ Vui lòng nhập API Key trước.';
            testResult.style.color = '#ff4d4f';
            return;
        }
        testResult.textContent = '⏳ Đang quét danh sách model...';
        testResult.style.color = '#94a3b8';
        try {
            const models = await agent.fetchAvailableModels(key);
            if (models.length > 0) {
                selectModel.innerHTML = '';
                models.forEach(m => {
                    const opt = document.createElement('option');
                    opt.value = m.id;
                    opt.textContent = `${m.id} (${m.displayName})`;
                    if (m.id === agent.selectedModel || (!agent.selectedModel && m.id === 'gemini-3.6-flash')) {
                        opt.selected = true;
                    }
                    selectModel.appendChild(opt);
                });
                testResult.textContent = `✅ Đã tìm thấy ${models.length} model khả dụng!`;
                testResult.style.color = '#00d084';
            }
        } catch (err) {
            testResult.textContent = `❌ ${err.message}`;
            testResult.style.color = '#ff4d4f';
        }
    });

    btnTestApi.addEventListener('click', async () => {
        const key = inputApiKey.value.trim();
        if (!key) {
            testResult.textContent = '⚠️ Vui lòng nhập API Key trước khi kiểm tra.';
            testResult.style.color = '#ff4d4f';
            return;
        }
        testResult.textContent = '⏳ Đang kiểm tra kết nối...';
        testResult.style.color = '#94a3b8';
        try {
            await agent.testConnection(key);
            testResult.textContent = '✅ Kết nối Gemini API thành công!';
            testResult.style.color = '#00d084';
        } catch (err) {
            testResult.textContent = `❌ Lỗi: ${err.message}`;
            testResult.style.color = '#ff4d4f';
        }
    });

    function updateApiKeyStatusUI() {
        if (agent.getApiKey()) {
            apiStatusDot.classList.add('active');
            apiStatusText.textContent = `Gemini (${agent.selectedModel})`;
        } else {
            apiStatusDot.classList.remove('active');
            apiStatusText.textContent = 'Cần cấu hình API Key';
        }
    }

    // 4. Market Ticker Loader
    async function loadMarketTicker() {
        try {
            const indices = await window.StockAPI.getMarketIndices();
            marketTickerBar.innerHTML = '';
            indices.forEach(idx => {
                const item = document.createElement('div');
                item.className = 'ticker-item';
                const sign = idx.change > 0 ? '+' : '';
                item.innerHTML = `
                    <span class="ticker-name">${idx.name}</span>
                    <span class="ticker-price">${window.StockAPI.formatNumber(idx.price, 2)}</span>
                    <span class="ticker-change ${idx.status}">${sign}${window.StockAPI.formatNumber(idx.change, 2)} (${sign}${idx.percentChange}%)</span>
                `;
                item.addEventListener('click', () => {
                    loadTickerToInspector(idx.symbol);
                });
                marketTickerBar.appendChild(item);
            });
        } catch (e) {
            console.error('Failed loading market ticker:', e);
        }
    }

    // 5. Watchlist Loader
    async function loadWatchlist() {
        watchlistContainer.innerHTML = '';
        for (const sym of defaultWatchlist) {
            const row = document.createElement('div');
            row.className = 'wl-item';
            row.id = `wl-${sym}`;
            row.innerHTML = `
                <span class="wl-symbol">${sym}</span>
                <div class="wl-price-group">
                    <div class="wl-price" id="wl-p-${sym}">--</div>
                    <div class="wl-change" id="wl-c-${sym}">--</div>
                </div>
            `;
            row.addEventListener('click', () => loadTickerToInspector(sym));
            watchlistContainer.appendChild(row);

            // Fetch quote asynchronously
            window.StockAPI.getStockQuote(sym).then(q => {
                const pEl = document.getElementById(`wl-p-${sym}`);
                const cEl = document.getElementById(`wl-c-${sym}`);
                if (pEl && cEl) {
                    pEl.textContent = window.StockAPI.formatNumber(q.currentPrice);
                    pEl.style.color = getPriceColor(q.status);
                    const sign = q.change > 0 ? '+' : '';
                    cEl.textContent = `${sign}${q.percentChange}%`;
                    cEl.style.color = getPriceColor(q.status);
                }
            });
        }
    }

    function getPriceColor(status) {
        if (status === 'up') return '#00d084';
        if (status === 'down') return '#ff4d4f';
        if (status === 'ceiling') return '#c084fc';
        if (status === 'floor') return '#38bdf8';
        return '#f59e0b';
    }

    // 6. Stock Inspector Loader
    async function loadTickerToInspector(symbol) {
        currentSelectedTicker = symbol.toUpperCase();
        heroSymbol.textContent = currentSelectedTicker;
        heroName.textContent = 'Đang tải dữ liệu...';
        heroPrice.textContent = '--';
        heroChange.textContent = '--';

        try {
            const quote = await window.StockAPI.getStockQuote(currentSelectedTicker);

            heroName.textContent = quote.name;
            heroPrice.textContent = window.StockAPI.formatNumber(quote.currentPrice);
            heroPrice.className = `hero-price ${quote.status}`;
            const sign = quote.change > 0 ? '+' : '';
            heroChange.textContent = `${sign}${window.StockAPI.formatNumber(quote.change)} (${sign}${quote.percentChange}%)`;
            heroChange.style.color = getPriceColor(quote.status);

            // Metrics
            if (metricOpen) metricOpen.textContent = window.StockAPI.formatNumber(quote.openPrice);
            if (metricRef) metricRef.textContent = window.StockAPI.formatNumber(quote.referencePrice);
            if (metricCeilFloor) {
                metricCeilFloor.innerHTML = `<span style="color:var(--color-ceiling)">${window.StockAPI.formatNumber(quote.ceilingPrice)}</span> / <span style="color:var(--color-floor)">${window.StockAPI.formatNumber(quote.floorPrice)}</span>`;
            }
            if (metricVol) metricVol.textContent = window.StockAPI.formatVolume(quote.volume);
            if (metricForeignBuySell) {
                metricForeignBuySell.textContent = `${window.StockAPI.formatVolume(quote.foreignBuy)} / ${window.StockAPI.formatVolume(quote.foreignSell)}`;
            }
            if (metricHighLow) {
                const low = quote.lowestPrice || quote.currentPrice || quote.referencePrice || 0;
                const high = quote.highestPrice || quote.currentPrice || quote.referencePrice || 0;
                metricHighLow.innerHTML = `<span style="color:var(--color-down, #ff4d4f);">${window.StockAPI.formatNumber(low)}</span> - <span style="color:var(--color-up, #00d084);">${window.StockAPI.formatNumber(high)}</span>`;
            }
            
            // Update FireAnt dynamic target links
            updateFireAntLinks(currentSelectedTicker);

        } catch (e) {
            console.error(`Failed to load ticker ${symbol}:`, e);
            heroName.textContent = 'Không tìm thấy dữ liệu';
        }
    }

    function updateFireAntLinks(symbol) {
        const sym = (symbol || 'FPT').toUpperCase();
        window.currentStockTicker = sym;
        const faTargetSymbol = document.getElementById('fa-target-symbol');
        if (faTargetSymbol) faTargetSymbol.textContent = sym;
    }

    // Search bar listener
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const sym = searchInput.value.trim().toUpperCase();
            if (sym) {
                loadTickerToInspector(sym);
                searchInput.value = '';
            }
        }
    });

    // 7. Chat Message Handling
    btnSend.addEventListener('click', handleSendMessage);
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });

    // Prompt Chips
    promptChips.addEventListener('click', (e) => {
        const chip = e.target.closest('.chip-btn');
        if (chip) {
            const prompt = chip.dataset.prompt;
            chatInput.value = prompt;
            handleSendMessage();
        }
    });

    // Agent event bindings
    let currentToolPill = null;
    agent.onToolExecute = (toolName, args) => {
        let msg = `⚡ Đang gọi lệnh: ${toolName}`;
        if (toolName === 'get_stock_quote') msg = `⚡ Đang cập nhật bảng giá realtime cho mã: ${args.symbol}`;
        if (toolName === 'get_market_indices') msg = `⚡ Đang truy vấn diễn biến chỉ số VN-INDEX, VN30`;
        if (toolName === 'get_financial_ratios') msg = `📊 Đang phân tích chỉ số tài chính (P/E, ROE, EPS) cho: ${args.symbol}`;
        if (toolName === 'get_stock_history') msg = `📈 Đang tính toán dữ liệu lịch sử giá cho: ${args.symbol}`;
        if (toolName === 'get_financial_statements') msg = `📑 Đang đọc Báo cáo tài chính (${args.period_type === 'year' ? 'theo Năm' : 'theo Quý'}) của ${args.symbol}`;

        if (currentToolPill) {
            currentToolPill.textContent = msg;
        }
    };

    agent.onStockDetected = (symbol, quote) => {
        // Automatically synchronize right-hand inspector panel with the stock being discussed
        loadTickerToInspector(symbol);
    };

    async function handleSendMessage() {
        const messageText = chatInput.value.trim();
        if (!messageText) return;

        if (!agent.getApiKey()) {
            apiKeyModal.classList.add('active');
            return;
        }

        // Render User Message
        appendMessage('user', messageText);
        chatInput.value = '';
        btnSend.disabled = true;

        // Create AI response container
        const aiMsgWrapper = createAiMessagePlaceholder();
        const contentDiv = aiMsgWrapper.querySelector('.message-content');
        
        currentToolPill = document.createElement('div');
        currentToolPill.className = 'tool-status-pill';
        currentToolPill.textContent = '🤖 Gemini đang suy nghĩ...';
        contentDiv.appendChild(currentToolPill);

        try {
            const result = await agent.sendMessage(messageText);
            
            // Remove tool loading pill
            if (currentToolPill) {
                currentToolPill.remove();
                currentToolPill = null;
            }

            // Render embedded stock card if retrieved
            if (result.toolsGathered) {
                result.toolsGathered.forEach(item => {
                    if (item.type === 'quote') {
                        const card = renderEmbeddedStockCard(item.data);
                        contentDiv.appendChild(card);
                    }
                });
            }

            // Render Markdown text response
            const textDiv = document.createElement('div');
            textDiv.className = 'markdown-body';
            textDiv.innerHTML = formatMarkdown(result.text);
            contentDiv.appendChild(textDiv);

        } catch (err) {
            if (currentToolPill) currentToolPill.remove();
            const errDiv = document.createElement('div');
            errDiv.style.color = '#ff4d4f';
            errDiv.textContent = `❌ ${err.message}`;
            contentDiv.appendChild(errDiv);
        } finally {
            btnSend.disabled = false;
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }

    function appendMessage(role, text) {
        const msg = document.createElement('div');
        msg.className = `message ${role}`;
        msg.innerHTML = `
            <div class="message-avatar">${role === 'user' ? '👤' : '⚡'}</div>
            <div class="message-content">${escapeHTML(text)}</div>
        `;
        chatMessages.appendChild(msg);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return msg;
    }

    function createAiMessagePlaceholder() {
        const msg = document.createElement('div');
        msg.className = 'message ai';
        msg.innerHTML = `
            <div class="message-avatar">⚡</div>
            <div class="message-content"></div>
        `;
        chatMessages.appendChild(msg);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return msg;
    }

    function renderEmbeddedStockCard(q) {
        const card = document.createElement('div');
        card.className = 'chat-stock-card';
        const sign = q.change > 0 ? '+' : '';
        card.innerHTML = `
            <div class="csc-header">
                <div class="csc-ticker">${q.ticker} <span style="font-size:0.75rem; color:var(--text-muted); font-weight:normal;">(${q.exchange}) - ${q.name}</span></div>
                <div style="display:flex; gap:6px;">
                    <span class="brand-badge" style="cursor:pointer;" onclick="window.inspectStock('${q.ticker}')">🔍 Tra cứu</span>
                    <span class="brand-badge" style="cursor:pointer; background:rgba(249, 115, 22, 0.2); color:#fb923c; border-color:rgba(249,115,22,0.4);" onclick="window.openFireAnt('${q.ticker}')">🔥 FireAnt ↗</span>
                </div>
            </div>
            <div class="csc-price-row">
                <span class="csc-price ${q.status}">${window.StockAPI.formatNumber(q.currentPrice)}</span>
                <span class="csc-change" style="color:${getPriceColor(q.status)}">${sign}${window.StockAPI.formatNumber(q.change)} (${sign}${q.percentChange}%)</span>
            </div>
            <div class="csc-stats-grid">
                <div class="csc-stat-item">
                    <span class="csc-stat-label">Tham chiếu</span>
                    <span class="csc-stat-val" style="color:var(--color-ref)">${window.StockAPI.formatNumber(q.referencePrice)}</span>
                </div>
                <div class="csc-stat-item">
                    <span class="csc-stat-label">Trần / Sàn</span>
                    <span class="csc-stat-val"><span style="color:var(--color-ceiling)">${window.StockAPI.formatNumber(q.ceilingPrice)}</span> / <span style="color:var(--color-floor)">${window.StockAPI.formatNumber(q.floorPrice)}</span></span>
                </div>
                <div class="csc-stat-item">
                    <span class="csc-stat-label">Khối lượng</span>
                    <span class="csc-stat-val">${window.StockAPI.formatVolume(q.volume)}</span>
                </div>
                <div class="csc-stat-item">
                    <span class="csc-stat-label">Thấp - Cao</span>
                    <span class="csc-stat-val">${window.StockAPI.formatNumber(q.lowestPrice)} - ${window.StockAPI.formatNumber(q.highestPrice)}</span>
                </div>
            </div>
        `;
        return card;
    }

    // Global helper to inspect stock from chat card
    window.inspectStock = (ticker) => {
        loadTickerToInspector(ticker);
    };

    // Global FireAnt Launcher (Handles Mobile & Desktop Optimized Layouts)
    window.openFireAnt = (ticker) => {
        const symbol = (ticker || window.currentStockTicker || currentSelectedTicker || 'FPT').toUpperCase();
        const isMobile = /Android|iPhone|iPad|iPod|Windows Phone|Mobile/i.test(navigator.userAgent || navigator.vendor || window.opera);
        
        // Mobile layout: `https://fireant.vn/dashboard/symbols/{symbol}` (Responsive single-column)
        // Desktop layout: `https://fireant.vn/dashboard/content/symbols/{symbol}` (Pro 4-column)
        const targetUrl = isMobile
            ? `https://fireant.vn/dashboard/symbols/${symbol}`
            : `https://fireant.vn/dashboard/content/symbols/${symbol}`;

        window.open(targetUrl, '_blank');
    };

    function escapeHTML(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function formatMarkdown(text) {
        if (!text) return '';
        let html = escapeHTML(text);
        // Bold
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // Italic
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
        // Bullet points
        html = html.replace(/^\s*[-•]\s+(.*)$/gm, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
        // Linebreaks
        html = html.replace(/\n/g, '<br/>');
        return html;
    }
});
