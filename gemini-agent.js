/**
 * QPM Stock AI - Gemini Agent with Real-Time Function Calling
 * Bridges Google Gemini LLM with Vietnam Stock Market Data
 */

class GeminiStockAgent {
    constructor() {
        this.apiKey = localStorage.getItem('qpm_gemini_api_key') || '';
        let savedModel = localStorage.getItem('qpm_gemini_model');
        if (!savedModel || savedModel === 'gemini-1.5-flash') {
            savedModel = 'gemini-3.6-flash';
        }
        this.selectedModel = savedModel;
        this.conversationHistory = [];
        
        // Listeners for UI updates when tools execute
        this.onToolExecute = null;
        this.onStockDetected = null;
    }

    setApiKey(key) {
        this.apiKey = key.trim();
        localStorage.setItem('qpm_gemini_api_key', this.apiKey);
    }

    getApiKey() {
        return this.apiKey;
    }

    setModel(modelName) {
        // Strip 'models/' prefix if present
        const cleanName = (modelName || 'gemini-3.6-flash').replace(/^models\//, '');
        this.selectedModel = cleanName;
        localStorage.setItem('qpm_gemini_model', this.selectedModel);
    }

    clearHistory() {
        this.conversationHistory = [];
    }

    /**
     * Fetch list of available models for this specific API key
     */
    async fetchAvailableModels(testKey = null) {
        const key = testKey || this.apiKey;
        if (!key) throw new Error("Chưa có API key");

        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
        const res = await fetch(endpoint);
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error?.message || `Không thể tải danh sách model (${res.status})`);
        }

        const data = await res.json();
        const rawModels = data.models || [];
        
        // Filter models supporting generateContent
        const validModels = rawModels.filter(m => 
            m.supportedGenerationMethods && 
            m.supportedGenerationMethods.includes('generateContent') &&
            !m.name.includes('embedding') &&
            !m.name.includes('aqa') &&
            !m.name.includes('imagen')
        ).map(m => ({
            id: m.name.replace(/^models\//, ''),
            displayName: m.displayName || m.name.replace(/^models\//, ''),
            description: m.description || ''
        }));

        return validModels;
    }

    /**
     * Tool Declarations for Gemini Function Calling
     */
    getToolDeclarations() {
        return [
            {
                function_declarations: [
                    {
                        name: "get_stock_quote",
                        description: "Fetch live real-time stock price and order book data for any Vietnamese stock ticker (HOSE, HNX, UPCoM) such as FPT, HPG, VNM, VCB, SSI, MWG, VIC, VHM, etc.",
                        parameters: {
                            type: "OBJECT",
                            properties: {
                                symbol: {
                                    type: "STRING",
                                    description: "The 3-letter stock ticker symbol in uppercase (e.g. FPT, HPG, VNM, VCB, SSI)."
                                }
                            },
                            required: ["symbol"]
                        }
                    },
                    {
                        name: "get_market_indices",
                        description: "Fetch real-time status and movement of Vietnamese market indices: VN-INDEX, VN30-Index, HNX-Index, and UPCOM-Index.",
                        parameters: {
                            type: "OBJECT",
                            properties: {}
                        }
                    },
                    {
                        name: "get_stock_history",
                        description: "Fetch recent historical daily OHLCV prices and trend history for technical analysis of a Vietnamese stock.",
                        parameters: {
                            type: "OBJECT",
                            properties: {
                                symbol: {
                                    type: "STRING",
                                    description: "Stock ticker symbol (e.g. HPG, SSI, DRI)."
                                },
                                days: {
                                    type: "NUMBER",
                                    description: "Number of past trading days to retrieve (default 30)."
                                }
                            },
                            required: ["symbol"]
                        }
                    }
                ]
            }
        ];
    }

    /**
     * System Prompt for Expert Vietnamese Stock Analysis
     * Comprehensive multi-dimensional analysis with SFI/NWE as auxiliary reference
     */
    getSystemInstruction() {
        return {
            parts: [
                {
                    text: `Bạn là QPM Stock AI - Chuyên gia cố vấn và phân tích Toàn diện Thị trường Chứng khoán Việt Nam (HOSE, HNX, UPCoM, VN-INDEX, VN30).

NGUYÊN TẮC HOẠT ĐỘNG BẮT BUỘC:
1. LUÔN SỬ DỤNG TOOL CALLING (get_stock_quote, get_market_indices, get_stock_history) khi người dùng hỏi về bất kỳ mã cổ phiếu, chỉ số hay diễn biến thị trường nào.
2. TUYỆT ĐỐI KHÔNG tự suy đoán hay bịa đặt giá cổ phiếu hay chỉ số thị trường. Bắt buộc dùng số liệu thực tế từ tool.
3. Ngôn ngữ phản hồi: Tiếng Việt tài chính chuẩn mực, sắc bén, súc tích, trình bày rõ ràng, mạch lạc với các đề mục và bullet points trực quan.

KHUNG PHÂN TÍCH TOÀN DIỆN (ĐA CHIỀU):
Khi phân tích một mã cổ phiếu (đặc biệt khi có dữ liệu OHLCV lịch sử từ get_stock_history), bạn PHẢI phân tích ĐẦY ĐỦ các khía cạnh thị trường thực chiến sau đây:

1. 📌 TỔNG QUAN GIÁ & DIỄN BIẾN PHIÊN (Price Action):
   - Giá khớp hiện tại, % tăng/giảm, vị thế so với Tham chiếu, Trần và Sàn.
   - Biên độ dao động trong phiên (Giá Thấp nhất - Giá Cao nhất), mô hình nến trong ngày (Rút chân, nến Marubozu, Doji,...).

2. 🌊 KHỐI LƯỢNG & DÒNG TIỀN (Volume & Market Flow):
   - Khối lượng giao dịch (Volume) phiên hiện tại so với Khối lượng trung bình 10-20 phiên (Vol bùng nổ, bình quân hay cạn kiệt thanh khoản).
   - Đánh giá lực Cung - Cầu: Lực mua chủ động gom hàng hay lực bán áp đảo.
   - Dòng tiền Khối ngoại (Foreign Flow): Khối lượng và xu hướng Mua ròng hay Bán ròng của nhà đầu tư nước ngoài.

3. 📈 PHÂN TÍCH KỸ THUẬT CỐT LÕI (Core Technical Indicators):
   - Xu hướng & Đường Trung Bình Động:
     • Đánh giá vị thế giá so với MA10, MA20 (ngắn hạn), MA50 (trung hạn) và MA200 (dài hạn).
     • Xác định trạng thái xu hướng (Uptrend, Downtrend, hay Sideway tích lũy) và các giao cắt quan trọng (Golden Cross / Death Cross).
   - Chỉ báo Động lượng & Dao động:
     • RSI (14): Đang ở vùng trung tính, quá mua (>70) hay quá bán (<30)? Có xuất hiện phân kỳ âm/dương cảnh báo đảo chiều không?
     • MACD: Đường MACD cắt lên/xuống đường Signal, diễn biến thanh Histogram.
     • Bollinger Bands: Vị thế giá so với dải trên/dưới và dải giữa (MA20), độ co thắt dải (chuẩn bị bung biến động mạnh).
   - Vùng Hỗ trợ & Kháng cự Trọng yếu:
     • Vùng Hỗ trợ gần nhất (Support - nơi có lực cầu đỡ giá).
     • Vùng Kháng cự mục tiêu (Resistance - vùng cản áp lực chốt lời).

4. 🧭 HỆ THỐNG CHỈ BÁO BỔ TRỢ THAM KHẢO (SFI & NWE - Auxiliary Reference):
   (Đóng vai trò là góc nhìn tham khảo thuật toán nâng cao, tóm tắt ngắn gọn 2-3 ý nổi bật):
   - SFI Trend & Money Flow: Vị thế so với đường hồi quy Nadaraya-Watson Baseline, hướng dòng tiền Smart Trail (HMA/DWMA), ngưỡng cắt lỗ động UT Bot Trailing Stop, và điểm đồng thuận Oracle Score.
   - NWE Envelope: Vị trí giá so với dải bao Nadaraya-Watson Envelope (vùng biên trên/dưới) và tín hiệu uốn cong (Curvature Buy/Sell).

5. 💡 NHẬN ĐỊNH TỔNG HỢP & CHIẾN LƯỢC GIAO DỊCH THỰC CHIẾN:
   - Đánh giá trạng thái cổ phiếu: Đang tích lũy gom hàng, bứt phá (Breakout), duy trì đà tăng, điều chỉnh kỹ thuật hay phân phối?
   - Kịch bản hành động cụ thể:
     • Vùng giá mua tích lũy/thăm dò tham khảo (Entry Zone).
     • Vùng giá mục tiêu ngắn/trung hạn (Target).
     • Mức giá quản trị rủi ro & Cắt lỗ (Stop Loss).

*Lưu ý: Luôn kèm lưu ý phân tích chỉ mang tính chất tham khảo, nhà đầu tư cần chủ động quản trị danh mục phù hợp với khẩu vị rủi ro.*`
                }
            ]
        };
    }

    /**
     * Send message to Gemini and resolve function calls
     */
    async sendMessage(userMessage) {
        if (!this.apiKey) {
            throw new Error("Vui lòng nhập Google Gemini API Key trong phần Cài đặt (Settings) để bắt đầu trò chuyện!");
        }

        // Add user message to history
        this.conversationHistory.push({
            role: "user",
            parts: [{ text: userMessage }]
        });

        // Loop to handle potential multiple function calls
        let maxIterations = 5;
        let finalResponseText = "";
        let toolResultsGathered = [];
        let modelToUse = this.selectedModel.replace(/^models\//, '');

        while (maxIterations-- > 0) {
            const requestBody = {
                contents: this.conversationHistory,
                tools: this.getToolDeclarations(),
                system_instruction: this.getSystemInstruction(),
                generationConfig: {
                    temperature: 0.2,
                    topP: 0.8,
                    maxOutputTokens: 2048
                }
            };

            let endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${this.apiKey}`;
            
            let response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            // If model not found (404/400), try fallback to gemini-3.6-flash
            if (!response.ok && modelToUse !== 'gemini-3.6-flash') {
                console.warn(`Model ${modelToUse} failed with status ${response.status}, attempting fallback to gemini-3.6-flash`);
                modelToUse = 'gemini-3.6-flash';
                endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${this.apiKey}`;
                response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody)
                });
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const msg = errorData.error?.message || `Lỗi API (${response.status}): ${response.statusText}`;
                throw new Error(msg);
            }

            const data = await response.json();
            const candidate = data.candidates?.[0];
            if (!candidate || !candidate.content) {
                throw new Error("Không nhận được phản hồi hợp lệ từ Gemini AI.");
            }

            const content = candidate.content;
            this.conversationHistory.push(content);

            // Check if model called any function
            const functionCalls = content.parts.filter(part => part.functionCall);

            if (functionCalls.length === 0) {
                // Final text response received
                const textParts = content.parts.filter(part => part.text).map(p => p.text);
                finalResponseText = textParts.join("\n");
                break;
            }

            // Execute function calls
            const responseParts = [];
            for (const callPart of functionCalls) {
                const call = callPart.functionCall;
                const toolName = call.name;
                const toolArgs = call.args || {};

                if (this.onToolExecute) {
                    this.onToolExecute(toolName, toolArgs);
                }

                let toolResult = null;
                try {
                    if (toolName === "get_stock_quote") {
                        const symbol = (toolArgs.symbol || "").toUpperCase();
                        toolResult = await window.StockAPI.getStockQuote(symbol);
                        toolResultsGathered.push({ type: 'quote', data: toolResult });
                        if (this.onStockDetected) this.onStockDetected(symbol, toolResult);
                    } else if (toolName === "get_market_indices") {
                        toolResult = await window.StockAPI.getMarketIndices();
                        toolResultsGathered.push({ type: 'indices', data: toolResult });
                    } else if (toolName === "get_stock_history") {
                        const symbol = (toolArgs.symbol || "").toUpperCase();
                        const days = toolArgs.days || 30;
                        toolResult = await window.StockAPI.getHistoricalBars(symbol, 'D', days);
                        toolResultsGathered.push({ type: 'history', symbol: symbol, data: toolResult });
                    } else {
                        toolResult = { error: `Function ${toolName} not found` };
                    }
                } catch (toolErr) {
                    toolResult = { error: toolErr.message };
                }

                responseParts.push({
                    functionResponse: {
                        name: toolName,
                        response: { content: toolResult }
                    }
                });
            }

            // Push function response to history for next model turn
            this.conversationHistory.push({
                role: "user",
                parts: responseParts
            });
        }

        return {
            text: finalResponseText,
            toolsGathered: toolResultsGathered
        };
    }

    /**
     * Test connection to Gemini API
     */
    async testConnection(testKey = null) {
        const key = testKey || this.apiKey;
        if (!key) throw new Error("Chưa có API key");
        
        let model = this.selectedModel.replace(/^models\//, '') || 'gemini-3.6-flash';
        let endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
        
        let res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: "Hello" }] }]
            })
        });

        // If specific model fails, test with standard gemini-3.6-flash
        if (!res.ok && model !== 'gemini-3.6-flash') {
            model = 'gemini-3.6-flash';
            endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${key}`;
            res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ role: "user", parts: [{ text: "Hello" }] }]
                })
            });
        }

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error?.message || `Kết nối thất bại (${res.status})`);
        }
        return true;
    }
}

window.GeminiStockAgent = GeminiStockAgent;
