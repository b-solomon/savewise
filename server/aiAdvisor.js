import OpenAI from 'openai';
import { query } from './database.js';

let openaiInstance = null;
function getClient() {
  if (!openaiInstance && process.env.OPENAI_API_KEY) openaiInstance = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openaiInstance;
}

async function buildContext(userId, month) {
  const txns = await query.all('SELECT type, amount, category, merchant, date FROM transactions WHERE user_id = ? AND date LIKE ?', [userId, month + '%']);
  const budgets = await query.all('SELECT category, monthly_limit FROM budgets WHERE user_id = ?', [userId]);
  const goals = await query.all('SELECT name, target_amount, current_amount, deadline FROM savings_goals WHERE user_id = ?', [userId]);
  const holdings = await query.all('SELECT symbol, exchange, quantity, avg_buy_price FROM holdings WHERE user_id = ?', [userId]);

  let totalIncome = 0, totalExpenses = 0;
  const catSpend = {};
  txns.forEach(t => {
    if (t.type === 'income') totalIncome += t.amount;
    else { totalExpenses += t.amount; catSpend[t.category] = (catSpend[t.category] || 0) + t.amount; }
  });

  return {
    month, totalIncome: Math.round(totalIncome), totalExpenses: Math.round(totalExpenses),
    balance: Math.round(totalIncome - totalExpenses),
    topSpending: Object.entries(catSpend).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([c, v]) => ({ category: c, spent: Math.round(v) })),
    budgets: budgets.map(b => ({ category: b.category, limit: b.monthly_limit, spent: Math.round(catSpend[b.category] || 0), pct: Math.round(((catSpend[b.category] || 0) / b.monthly_limit) * 100) })),
    savingsGoals: goals, portfolio: holdings, txnCount: txns.length
  };
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
- End with a brief disclaimer: "This is AI-generated guidance, not certified financial advice."`;

  const openai = getClient();

  if (openai) {
    try {
      const chatMsgs = [{ role: 'system', content: systemPrompt }, ...messages.map(m => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text }))];
      const completion = await openai.chat.completions.create({ model: 'gpt-4o-mini', messages: chatMsgs, max_tokens: 1000, temperature: 0.7 });
      return { text: completion.choices[0].message.content, sender: 'ai', timestamp: new Date().toISOString() };
    } catch (err) { console.error('OpenAI error:', err.message); }
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
  return { text: reply + '\n\n*Using offline mode. Connect OpenAI key for richer analysis.*', sender: 'ai', timestamp: new Date().toISOString() };
}

export async function generateMonthlyReport(userId, month) {
  const ctx = await buildContext(userId, month);
  const openai = getClient();
  
  let report = '';
  let errorOccurred = false;

  if (openai) {
    try {
      const prompt = `Generate a comprehensive monthly financial report for ${month}. Include:
1. Spending analysis — where money went, biggest expenses
2. Budget performance — which budgets were exceeded
3. Savings progress — goal tracking
4. Spending leaks — identify wasteful/unnecessary expenses
5. 5 specific actionable tips to save more next month with ₹ amounts
6. Overall financial health score (1-100)

User data: ${JSON.stringify(ctx)}`;

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
      console.error('OpenAI error during monthly report generation:', err.message);
      errorOccurred = true;
    }
  } else {
    errorOccurred = true;
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
