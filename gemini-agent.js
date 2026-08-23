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
                        description: "Fetch live real-time stock quote, volume statistics (current volume, 10-day & 20-day average volume, volume ratio, recent sessions volume breakdown), and technical summary for any Vietnamese stock ticker (HOSE, HNX, UPCoM) such as FPT, HPG, VNM, VCB, SSI, TCO, DRI, etc.",
                        parameters: {
                            type: "OBJECT",
                            properties: {
                                symbol: {
                                    type: "STRING",
                                    description: "The stock ticker symbol in uppercase (e.g. FPT, HPG, TCO, SSI, DRI)."
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
                        description: "Fetch historical daily OHLCV prices, volume metrics, and technical indicators for technical analysis of a Vietnamese stock.",
                        parameters: {
                            type: "OBJECT",
                            properties: {
                                symbol: {
                                    type: "STRING",
                                    description: "Stock ticker symbol (e.g. HPG, SSI, TCO, DRI)."
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
2. TUYỆT ĐỐI KHÔNG tự suy đoán hay bịa đặt giá cổ phiếu, chỉ số thị trường hoặc số liệu khối lượng quá khứ. Bắt buộc dùng số liệu thực tế từ tool.
3. QUY TẮC BẮT BUỘC KHI KHÔNG CÓ DỮ LIỆU LỊCH SỬ (isLiveRealtimeFeed === false hoặc hasHistoricalSeries === false hoặc avgVolume20Sessions === null):
   - BẮT BUỘC PHẢI THÔNG BÁO MINH BẠCH CHO NGƯỜI DÙNG: "⚠️ Hiện tại hệ thống không kết nối được chuỗi nến lịch sử từ sàn giao dịch (đang dùng snapshot tĩnh). Chỉ có số liệu khớp lệnh phiên gần nhất (Khối lượng: ... cp, Giá: ... đ). Không có dữ liệu 20 phiên trước để so sánh trung bình hay vẽ đỉnh/đáy lịch sử."
   - TUYỆT ĐỐI KHÔNG TỰ BỊA ĐẶT số liệu trung bình 20 phiên, tỷ lệ tăng giảm so với quá khứ, hay các phiên trước.
4. PHONG CÁCH TRÌNH BÀY: Súc tích, cô đọng, sắc bén, đi thẳng vào số liệu cốt lõi, KHÔNG viết dài dòng lan man. Dùng các bullet points ngắn gọn, dễ đọc.

CẤU TRÚC PHÂN TÍCH TINH GỌN (CHÍNH XÁC & CÔ ĐỌNG):
Khi phân tích một mã cổ phiếu (khi có đầy đủ dữ liệu nến realtime), bạn trình bày theo cấu trúc 4 phần ngắn gọn sau:

1. 📌 TỔNG QUAN GIÁ & HIỆU SUẤT (Price Action - Tối đa 3-4 dòng):
   - Giá hiện tại, % tăng/giảm trong phiên, biên độ dao động (Thấp nhất - Cao nhất).
   - Hiệu suất lịch sử thực tế: 1 tuần qua (% từ historicalPerformance.perf1Week) và 1 tháng qua (% từ historicalPerformance.perf1Month).
   - Vùng Đỉnh / Đáy 20 phiên: Nêu ngắn gọn vùng đáy và đỉnh 20 phiên từ "priceExtremes" (ví dụ: Đáy 20 phiên: 10.4, Đỉnh 20 phiên: 11.8).

2. 🌊 KHỐI LƯỢNG & DÒNG TIỀN (Volume & Flow - Chuẩn xác số liệu):
   - Khối lượng phiên hiện tại (ví dụ: 846.5K cp), so sánh với Trung bình 20 phiên (avgVolume20Sessions) và tỷ lệ (ratioVs20SessionAvg) -> Đánh giá: Bùng nổ / Tăng tốt / Bình quân / Cạn kiệt.
   - Đối chiếu ngắn với 2-3 phiên liền trước từ "recentSessions".
   - Dòng tiền Khối ngoại: Khối lượng Mua/Bán và Mua/Bán ròng (foreignNet).

3. 📈 KỸ THUẬT & XU HƯỚNG CỐT LÕI (Technical & Trend):
   - Xu hướng: Vị thế giá so với MA20, MA50 (theo "trendStatus").
   - Chỉ báo & Ngưỡng cản: RSI(14) đang ở mức nào; Vùng Hỗ trợ (supportLevel) và Kháng cự mục tiêu (resistanceLevel).
   - Góc nhìn SFI/NWE (1 dòng tóm lược): Hướng dòng tiền Smart Trail và vị trí kênh NWE Envelope.

4. 💡 CHIẾN LƯỢC GIAO DỊCH THỰC CHIẾN:
   - Trạng thái cổ phiếu: (Tích lũy / Bứt phá Breakout / Tăng tiếp diễn / Chốt lời).
   - Kịch bản hành động cụ thể:
     • Vùng mua tích lũy/thăm dò (Entry)
     • Vùng giá mục tiêu (Target)
     • Ngưỡng cắt lỗ quản trị rủi ro (Stop Loss)

*Lưu ý: Phân tích chỉ mang tính chất tham khảo, nhà đầu tư cần chủ động quản trị danh mục.*`
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
