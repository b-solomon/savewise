import OpenAI from 'openai';
import { query } from './database.js';
import { getAppKey, encrypt, decrypt } from './crypto.js';

let openaiInstance = null;
let openrouterInstance = null;

function getOpenAIClient() {
  if (!openaiInstance && process.env.OPENAI_API_KEY) {
    const key = process.env.OPENAI_API_KEY.trim();
    if (key) {
      openaiInstance = new OpenAI({ apiKey: key });
    }
  }
  return openaiInstance;
}

function getOpenRouterClient() {
  if (!openrouterInstance && process.env.OPENROUTER_API_KEY) {
    const key = process.env.OPENROUTER_API_KEY.trim();
    if (key) {
      openrouterInstance = new OpenAI({
        apiKey: key,
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: {
          "HTTP-Referer": "http://localhost:3001",
          "X-Title": "SaveWise"
        }
      });
    }
  }
  return openrouterInstance;
}


async function buildContext(userId, month) {
  const txns = await query.all('SELECT type, amount, amount_enc, category, merchant, merchant_enc, date FROM transactions WHERE user_id = ? AND date LIKE ?', [userId, month + '%']);
  const budgets = await query.all('SELECT category, monthly_limit FROM budgets WHERE user_id = ?', [userId]);
  const goals = await query.all('SELECT name, target_amount, current_amount, deadline FROM savings_goals WHERE user_id = ?', [userId]);
  const holdings = await query.all('SELECT symbol, exchange, quantity, avg_buy_price FROM holdings WHERE user_id = ?', [userId]);

  let totalIncome = 0, totalExpenses = 0;
  const catSpend = {};
  const key = getAppKey();

  txns.forEach(t => {
    let amt = 0;
    if (t.amount_enc) {
      amt = parseFloat(decrypt(t.amount_enc, key)) || 0;
    } else {
      amt = parseFloat(t.amount) || 0;
    }

    if (t.type === 'income') {
      totalIncome += amt;
    } else {
      totalExpenses += amt;
      catSpend[t.category] = (catSpend[t.category] || 0) + amt;
    }
  });

  return {
    month, totalIncome: Math.round(totalIncome), totalExpenses: Math.round(totalExpenses),
    balance: Math.round(totalIncome - totalExpenses),
    topSpending: Object.entries(catSpend).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([c, v]) => ({ category: c, spent: Math.round(v) })),
    budgets: budgets.map(b => ({ category: b.category, limit: b.monthly_limit, spent: Math.round(catSpend[b.category] || 0), pct: Math.round(((catSpend[b.category] || 0) / b.monthly_limit) * 100) })),
    savingsGoals: goals, portfolio: holdings, txnCount: txns.length
  };
}

const tools = [
  {
    type: 'function',
    function: {
      name: 'add_holding',
      description: 'Add a new stock holding to the user\'s investment portfolio when they say they bought a stock.',
      parameters: {
        type: 'object',
        properties: {
          symbol: { type: 'string', description: 'The stock symbol (e.g. RELIANCE, TRIDENT, TCS, AAPL).' },
          quantity: { type: 'number', description: 'The number of shares purchased.' },
          avgBuyPrice: { type: 'number', description: 'The average purchase price per share.' },
          exchange: { type: 'string', enum: ['NSE', 'BSE', 'US'], description: 'The exchange. Defaults to NSE.' },
          buyDate: { type: 'string', description: 'The purchase date in YYYY-MM-DD format. Defaults to today.' }
        },
        required: ['symbol', 'quantity', 'avgBuyPrice']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'add_transaction',
      description: 'Add a new financial transaction (income or expense) to the database.',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['income', 'expense'], description: 'The transaction type.' },
          amount: { type: 'number', description: 'The transaction amount.' },
          category: { type: 'string', description: 'The category (e.g. Food & Dining, Shopping, Bills & Utilities, Church, Rent, etc.).' },
          description: { type: 'string', description: 'Short description of the transaction.' },
          merchant: { type: 'string', description: 'Merchant name or source.' },
          date: { type: 'string', description: 'Transaction date in YYYY-MM-DD format. Defaults to today.' },
          paymentMethod: { type: 'string', description: 'Payment method used (e.g. UPI, Cash, Credit Card, Debit Card).' }
        },
        required: ['type', 'amount', 'category']
      }
    }
  }
];

// Pending Actions Store with 10-minute expiration for human-in-the-loop confirmation
export const pendingAiActions = new Map();

export function getPendingAction(actionId) {
  const item = pendingAiActions.get(actionId);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    pendingAiActions.delete(actionId);
    return null;
  }
  return item;
}

export async function confirmPendingAction(actionId, userId) {
  const item = getPendingAction(actionId);
  if (!item) {
    return { success: false, error: 'Action not found or expired. Please ask the AI assistant again.' };
  }
  if (item.userId !== userId) {
    return { success: false, error: 'Unauthorized confirmation attempt.' };
  }

  try {
    let resultMessage = '';
    if (item.type === 'add_holding') {
      const { sym, name, ex, quantity, avgBuyPrice, date } = item.data;
      await query.run(
        `INSERT INTO holdings (user_id, symbol, name, exchange, quantity, avg_buy_price, buy_date, asset_type, source) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, sym, name, ex, quantity, avgBuyPrice, date, 'stock', 'ai_confirmed']
      );
      resultMessage = `Confirmed and added ${quantity} shares of ${sym} at ₹${avgBuyPrice} to your portfolio.`;
    } else if (item.type === 'add_transaction') {
      const { type, amount, category, desc, merchant, date, method } = item.data;
      const key = getAppKey();
      await query.run(
        `INSERT INTO transactions (user_id, type, amount, amount_enc, category, description, merchant, merchant_enc, date, payment_method, source) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, type, 0, encrypt(String(amount), key), category, desc, '', encrypt(merchant || '', key), date, method, 'ai_confirmed']
      );
      resultMessage = `Confirmed and added ${type} transaction of ₹${amount} under ${category}.`;
    }
    pendingAiActions.delete(actionId);
    return { success: true, message: resultMessage };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function executeToolCall(userId, tc) {
  const funcName = tc.function.name;
  let args;
  try {
    args = JSON.parse(tc.function.arguments);
  } catch (err) {
    console.error("Raw tool call arguments:", tc.function.arguments);
    throw new Error(`Invalid JSON arguments from AI model: ${err.message}`);
  }
  console.log(`Processing tool proposal for user ${userId}: ${funcName}`, args);

  if (funcName === 'add_holding') {
    const sym = (args.symbol || '').toUpperCase().trim();
    const quantity = parseFloat(args.quantity);
    const avgBuyPrice = parseFloat(args.avgBuyPrice);

    // Robust validation
    if (!sym || !/^[A-Z0-9.-]{1,15}$/.test(sym)) throw new Error('Invalid stock symbol format.');
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Stock quantity must be a positive number.');
    if (!Number.isFinite(avgBuyPrice) || avgBuyPrice <= 0) throw new Error('Average buy price must be a positive number.');

    const name = `${sym} Stock`;
    const date = args.buyDate || new Date().toISOString().split('T')[0];
    const ex = ['NSE', 'BSE', 'US'].includes(args.exchange) ? args.exchange : 'NSE';

    const actionId = `act_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    pendingAiActions.set(actionId, {
      actionId,
      userId,
      type: 'add_holding',
      data: { sym, name, ex, quantity, avgBuyPrice, date },
      createdAt: Date.now(),
      expiresAt: Date.now() + 10 * 60 * 1000
    });

    return {
      status: 'pending_confirmation',
      actionId,
      summary: `Propose adding ${quantity} shares of ${sym} (${ex}) at ₹${avgBuyPrice}/share.`,
      instruction: 'Awaiting explicit user confirmation before recording in the database.'
    };
  }

  if (funcName === 'add_transaction') {
    const type = args.type === 'income' ? 'income' : 'expense';
    const amount = parseFloat(args.amount);
    const category = (args.category || 'Other').trim().slice(0, 50);

    // Robust business validation
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000) {
      throw new Error('Transaction amount must be a positive finite number within realistic limits.');
    }
    if (!category) throw new Error('Category is required.');

    const date = args.date || new Date().toISOString().split('T')[0];
    const method = (args.paymentMethod || 'Other').slice(0, 30);
    const merchant = (args.merchant || '').slice(0, 50);
    const desc = (args.description || `${type === 'income' ? 'Received from' : 'Paid to'} ${merchant || category}`).slice(0, 150);

    const actionId = `act_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    pendingAiActions.set(actionId, {
      actionId,
      userId,
      type: 'add_transaction',
      data: { type, amount, category, desc, merchant, date, method },
      createdAt: Date.now(),
      expiresAt: Date.now() + 10 * 60 * 1000
    });

    return {
      status: 'pending_confirmation',
      actionId,
      summary: `Propose recording ${type} of ₹${amount} under category '${category}'.`,
      instruction: 'Awaiting explicit user confirmation before recording in the database.'
    };
  }

  return { error: 'Unknown function' };
}

async function callClientWithTools(client, modelName, chatMsgs, userId) {
  const completion = await client.chat.completions.create({
    model: modelName,
    messages: chatMsgs,
    tools,
    tool_choice: 'auto',
    max_tokens: 1000,
    temperature: 0.7
  });

  const responseMsg = completion.choices[0].message;
  if (responseMsg.tool_calls && responseMsg.tool_calls.length > 0) {
    const updatedMessages = [...chatMsgs, responseMsg];

    for (const tc of responseMsg.tool_calls) {
      try {
        const result = await executeToolCall(userId, tc);
        updatedMessages.push({
          role: 'tool',
          tool_call_id: tc.id,
          name: tc.function.name,
          content: JSON.stringify(result)
        });
      } catch (err) {
        console.error('Error executing tool:', err.message);
        updatedMessages.push({
          role: 'tool',
          tool_call_id: tc.id,
          name: tc.function.name,
          content: JSON.stringify({ error: err.message })
        });
      }
    }

    const finalCompletion = await client.chat.completions.create({
      model: modelName,
      messages: updatedMessages,
      max_tokens: 1000,
      temperature: 0.7
    });
    return finalCompletion.choices[0].message.content;
  }

  return responseMsg.content;
}

export async function handleAiChat(userId, messages) {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const ctx = await buildContext(userId, month);

  const systemPrompt = `You are SaveWise AI — a brilliant personal finance advisor for Indian users. You have the user's REAL financial data below. Give specific, actionable advice in ₹ amounts. Reference actual categories and numbers. Be encouraging but honest. Use markdown formatting.

REAL FINANCIAL DATA (${month}):
${JSON.stringify(ctx, null, 2)}

Rules:
- Always reference actual ₹ amounts from the data
- Suggest specific areas to cut spending
- Mention budget violations if any
- Comment on savings goal progress
- If they have a portfolio, mention stock performance
- You can add transactions or stock holdings to the user's database directly using the provided tools when they ask you to add them. When you successfully use a tool, confirm it to the user.
- End with a brief disclaimer: "This is AI-generated guidance, not certified financial advice."`;

  let aiResponse = null;

  // Try OpenAI first
  const openai = getOpenAIClient();
  if (openai) {
    try {
      const chatMsgs = [{ role: 'system', content: systemPrompt }, ...messages.map(m => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text }))];
      aiResponse = await callClientWithTools(openai, 'gpt-4o-mini', chatMsgs, userId);
    } catch (err) { 
      console.error('OpenAI error, falling back to OpenRouter...', err.message); 
    }
  }

  // Try OpenRouter next
  if (!aiResponse) {
    const openrouter = getOpenRouterClient();
    if (openrouter) {
      const chatMsgs = [{ role: 'system', content: systemPrompt }, ...messages.map(m => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text }))];
      try {
        aiResponse = await callClientWithTools(openrouter, 'openrouter/free', chatMsgs, userId);
      } catch (err) {
        console.error('OpenRouter free model error, trying paid model fallback:', err.message);
        try {
          aiResponse = await callClientWithTools(openrouter, 'google/gemini-2.5-flash', chatMsgs, userId);
        } catch (paidErr) {
          console.error('OpenRouter paid model fallback error:', paidErr.message);
        }
      }
    }
  }

  if (aiResponse) {
    return { text: aiResponse, sender: 'ai', timestamp: new Date().toISOString() };
  }

  // Offline fallback
  const last = messages[messages.length - 1]?.text?.toLowerCase() || '';
  let reply;
  if (last.includes('cut') || last.includes('save') || last.includes('reduce')) {
    const top = ctx.topSpending.slice(0, 3);
    reply = `Your top spending categories this month:\n\n${top.map(c => `• **${c.category}**: ₹${c.spent.toLocaleString('en-IN')}`).join('\n')}\n\n**Savings tips:**\n• Reduce ${top[0]?.category || 'top category'} by 20% → save ₹${Math.round((top[0]?.spent || 0) * 0.2).toLocaleString('en-IN')}/month\n• Set budget limits for each category\n• Review subscriptions — cancel unused ones`;
  } else if (last.includes('goal') || last.includes('track')) {
    reply = ctx.savingsGoals.length ? `Your goals:\n\n${ctx.savingsGoals.map(g => `• **${g.name}**: ₹${g.current_amount.toLocaleString('en-IN')} / ₹${g.target_amount.toLocaleString('en-IN')} (${Math.round(g.current_amount / g.target_amount * 100)}%)`).join('\n')}` : 'No savings goals set yet. Create one in the Savings Goals tab!';
  } else {
    reply = `**${month} Financial Snapshot:**\n\n• 💰 Income: ₹${ctx.totalIncome.toLocaleString('en-IN')}\n• 💸 Expenses: ₹${ctx.totalExpenses.toLocaleString('en-IN')}\n• 📊 Balance: ₹${ctx.balance.toLocaleString('en-IN')}\n• 📋 Transactions: ${ctx.txnCount}\n\nTop spending: ${ctx.topSpending.slice(0, 3).map(c => `${c.category} (₹${c.spent.toLocaleString('en-IN')})`).join(', ')}\n\nAsk me about cutting expenses, tracking goals, or portfolio analysis!`;
  }
  return { text: reply + '\n\n*Using offline mode. Configure an OpenAI or OpenRouter key for richer analysis.*', sender: 'ai', timestamp: new Date().toISOString() };
}

export async function generateMonthlyReport(userId, month) {
  let report = '';
  let errorOccurred = false;
  const ctx = await buildContext(userId, month);

  const prompt = `Generate a comprehensive monthly financial report for ${month}. Include:
1. Spending analysis — where money went, biggest expenses
2. Budget performance — which budgets were exceeded
3. Savings progress — goal tracking
4. Spending leaks — identify wasteful/unnecessary expenses
5. 5 specific actionable tips to save more next month with ₹ amounts
6. Overall financial health score (1-100)

User data: ${JSON.stringify(ctx)}`;

  // Try OpenAI first
  const openai = getOpenAIClient();
  if (openai) {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a certified financial advisor analyzing real data. Use ₹ amounts. Be specific and actionable. Format in markdown.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 1500
      });
      report = completion.choices[0].message.content;
    } catch (err) {
      console.error('OpenAI error during report generation, trying OpenRouter...', err.message);
      errorOccurred = true;
    }
  } else {
    errorOccurred = true;
  }

  // Try OpenRouter next
  if (errorOccurred || !report) {
    const openrouter = getOpenRouterClient();
    if (openrouter) {
      const messagesPayload = [
        { role: 'system', content: 'You are a certified financial advisor analyzing real data. Use ₹ amounts. Be specific and actionable. Format in markdown.' },
        { role: 'user', content: prompt }
      ];
      try {
        const completion = await openrouter.chat.completions.create({
          model: 'openrouter/free',
          messages: messagesPayload,
          max_tokens: 1500
        });
        report = completion.choices[0].message.content;
        errorOccurred = false; // Reset error flag since OpenRouter succeeded
      } catch (err) {
        console.error('OpenRouter free model error during report generation, trying paid model fallback:', err.message);
        try {
          const completion = await openrouter.chat.completions.create({
            model: 'google/gemini-2.5-flash',
            messages: messagesPayload,
            max_tokens: 1500
          });
          report = completion.choices[0].message.content;
          errorOccurred = false; // Reset error flag since OpenRouter succeeded
        } catch (paidErr) {
          console.error('OpenRouter paid model fallback error during report generation:', paidErr.message);
          errorOccurred = true;
        }
      }
    } else {
      errorOccurred = true;
    }
  }

  const savingsRate = ctx.totalIncome > 0 ? Math.round((ctx.balance / ctx.totalIncome) * 100) : 0;

  if (errorOccurred || !report) {
    const topExpList = ctx.topSpending.map(t => `* **${t.category}**: ₹${t.spent.toLocaleString('en-IN')}`).join('\n');
    const budgetList = ctx.budgets.length > 0
      ? ctx.budgets.map(b => `* **${b.category}**: ₹${b.spent.toLocaleString('en-IN')} spent / ₹${b.limit.toLocaleString('en-IN')} limit (${b.pct}% utilized) ${b.pct > 100 ? `⚠️ **Exceeded by ₹${(b.spent - b.limit).toLocaleString('en-IN')}**` : '✅ Within limit'}`).join('\n')
      : '* No budgets configured for this month.';
    
    const goalList = ctx.savingsGoals.length > 0
      ? ctx.savingsGoals.map(g => `* **${g.name}**: ₹${g.current_amount.toLocaleString('en-IN')} / ₹${g.target_amount.toLocaleString('en-IN')} (${Math.round((g.current_amount / g.target_amount) * 100)}% saved)`).join('\n')
      : '* No savings goals active.';

    const portfolioInfo = ctx.portfolio.length > 0
      ? `* You have **${ctx.portfolio.length}** active holdings in your portfolio.`
      : '* No stock holdings added yet.';

    const healthScore = Math.max(10, Math.min(100, 50 + (savingsRate > 0 ? savingsRate : 0) - (ctx.budgets.filter(b => b.pct > 100).length * 10)));

    report = `### 📊 Monthly Financial Report — ${month} (Offline Fallback)

#### 1. Spending Analysis
* **Total Income:** ₹${ctx.totalIncome.toLocaleString('en-IN')}
* **Total Expenses:** ₹${ctx.totalExpenses.toLocaleString('en-IN')}
* **Net Balance:** ₹${ctx.balance.toLocaleString('en-IN')}
* **Savings Rate:** **${savingsRate}%**

**Top Expense Categories:**
${topExpList || '* No expenses recorded this month.'}

#### 2. Budget Performance
${budgetList}

#### 3. Savings & Investments
**Savings Goals:**
${goalList}

**Portfolio Status:**
${portfolioInfo}

#### 4. Actionable Financial Advice
1. **Reduce Top Spending**: Try to cut down spending in **${ctx.topSpending[0]?.category || 'your main expense category'}** by 10% to save ₹${Math.round((ctx.topSpending[0]?.spent || 0) * 0.1).toLocaleString('en-IN')} next month.
2. **Review Overruns**: Address any category budgets that are exceeding 100% utilization.
3. **Automate Savings**: Set aside your target savings at the beginning of the month rather than saving what is left.
4. **Build Emergency Fund**: Ensure you have at least 3-6 months of expenses in a liquid savings goal.

---
**Financial Health Score: ${healthScore}/100**
*Note: This report was generated locally on your system because the AI service is currently offline or unavailable. Once connection is restored, you can re-generate the report for a deeper AI-powered analysis.*`;
  }

  try {
    await query.run('INSERT INTO ai_reports (user_id, month, report, savings_rate) VALUES (?,?,?,?)', [userId, month, report, savingsRate]);
  } catch (dbErr) {
    console.error('Failed to cache AI report in DB:', dbErr.message);
  }

  return { report, month, savingsRate, cached: false };
}
