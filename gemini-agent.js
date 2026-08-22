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
     */
    getSystemInstruction() {
        return {
            parts: [
                {
                    text: `Bạn là QPM Stock AI - Chuyên gia cố vấn và phân tích Thị trường Chứng khoán Việt Nam (HOSE, HNX, UPCoM, VN-INDEX, VN30).

NGUYÊN TẮC HOẠT ĐỘNG BẮT BUỘC:
1. LUÔN SỬ DỤNG TOOL CALLING (get_stock_quote, get_market_indices, get_stock_history) khi người dùng hỏi về bất kỳ mã cổ phiếu, chỉ số hay diễn biến thị trường nào.
2. TUYỆT ĐỐI KHÔNG tự suy đoán hay bịa đặt giá cổ phiếu hay chỉ số thị trường. Bắt buộc dùng số liệu thực tế từ tool.
3. Khi phân tích CỔ PHIẾU & KỸ THUẬT:
   - Cung cấp đầy đủ Giá khớp lệnh, % tăng/giảm, Giá Trần / Sàn / Tham chiếu, Biên độ dao động trong phiên.
   - Phân tích Khối lượng giao dịch (Volume), Dòng tiền Cung - Cầu, và Giao dịch mua/bán của Khối ngoại (Foreign Net Flow).
   - Chỉ ra các vùng Hỗ trợ (Support), Kháng cự (Resistance) và xu hướng ngắn hạn/trung hạn.
4. Khi phân tích THỊ TRƯỜNG:
   - Tổng hợp diễn biến VN-INDEX, VN30, HNX, UPCoM, thanh khoản và các nhóm ngành dẫn dắt dòng tiền.
5. Ngôn ngữ phản hồi: Tiếng Việt tài chính chuẩn mực, sắc sảo, ngắn gọn, súc tích, trình bày rõ ràng với markdown bullet points.`
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
