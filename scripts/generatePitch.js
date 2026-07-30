const pptxgen = require("pptxgenjs");
const fs = require('fs');

let pres = new pptxgen();
pres.layout = 'LAYOUT_16x9';

// Define master slide for consistency
pres.defineSlideMaster({
  title: "MASTER_SLIDE",
  background: { color: "090a0f" }, // Dark glassmorphism bg
  objects: [
    { rect: { x: 0, y: 0, w: "100%", h: "0.25", fill: { color: "10b981" } } }, // Savings green accent top
    { text: { text: "SaveWise | Pitch Deck", options: { x: 0.5, y: "92%", w: 3, h: 0.5, color: "ffffff", fontSize: 10, transparency: 50 } } },
  ]
});

// Helper function to create standard slides
function addSlide(title, headline, bullets, textWidth = "90%") {
  let slide = pres.addSlide({ masterName: "MASTER_SLIDE" });
  
  // Slide Category Title (e.g., SITUATION)
  slide.addText(title, {
    x: 0.5, y: 0.5, w: "90%", h: 0.6,
    color: "34d399", // savings-light
    fontSize: 16,
    bold: true,
    fontFace: "Arial"
  });

  // Main Headline
  slide.addText(headline, {
    x: 0.5, y: 1.1, w: textWidth, h: 1.0,
    color: "ffffff",
    fontSize: 28,
    bold: true,
    fontFace: "Arial"
  });

  // Bullet Points
  if (bullets && bullets.length > 0) {
    let bulletText = bullets.map(b => ({ text: b, options: { bullet: true, color: "e0e0e0", fontSize: 20, fontFace: "Arial", breakLine: true } }));
    slide.addText(bulletText, {
      x: 0.5, y: 2.2, w: textWidth, h: 3.0,
      valign: "top",
      lineSpacing: 35
    });
  }
  return slide;
}

// 1. Title Slide
let slide1 = pres.addSlide({ masterName: "MASTER_SLIDE" });
slide1.addText("SaveWise", { x: "10%", y: "35%", w: "80%", h: 1, fontSize: 56, bold: true, color: "ffffff", align: "center" });
slide1.addText("Stop tracking. Start growing.", { x: "10%", y: "52%", w: "80%", h: 0.5, fontSize: 24, color: "34d399", align: "center" });
slide1.addText("The intelligent, fully automated personal finance tracker.", { x: "10%", y: "62%", w: "80%", h: 0.5, fontSize: 18, color: "cccccc", align: "center" });

// 2. SITUATION & PROBLEM (Split Layout)
let slideSit = pres.addSlide({ masterName: "MASTER_SLIDE" });
slideSit.addText("SITUATION & PROBLEM", { x: 0.5, y: 0.5, w: "90%", h: 0.6, color: "34d399", fontSize: 16, bold: true, fontFace: "Arial" });
slideSit.addText("Manual expense tracking is broken.", { x: 0.5, y: 1.1, w: 4.5, h: 1.0, color: "ffffff", fontSize: 28, bold: true, fontFace: "Arial" });

// Problem statement block
slideSit.addText(
  "The Problem: Managing daily spending is overwhelming. People make dozens of micro-transactions daily through UPI, making manual tracking tedious. As a result, they lose track, break their budgets, and fail to see how daily spending impacts their long-term wealth.",
  { x: 0.5, y: 2.2, w: 4.5, h: 2.5, color: "e0e0e0", fontSize: 18, fontFace: "Arial", lineSpacing: 25, valign: "top" }
);

// Native PPTX Bar Chart (Right side)
let dataChartBar = [
  {
    name: "Digital Transactions (Billions)",
    labels: ["2022", "2023", "2024", "2025", "2026"],
    values: [45, 74, 114, 160, 220]
  }
];
slideSit.addChart(pres.ChartType.bar, dataChartBar, {
  x: 5.5, y: 1.2, w: 4.2, h: 3.8, // Positioned safely on the right
  showLegend: false,
  showTitle: true,
  title: "Growth in Digital Payments (UPI)",
  titleColor: "ffffff",
  barDir: "col",
  chartColors: ["34d399"],
  valAxisLabelColor: "cccccc",
  catAxisLabelColor: "cccccc",
  gridLineColor: "333333"
});

// 3. TASK
addSlide(
  "TASK: The Objective", 
  "Total financial clarity with zero friction.", 
  [
    "Build a fully automated personal finance tracker.",
    "Eliminate manual data entry completely.",
    "Unify daily cash flow management with long-term wealth building (stocks and investments)."
  ]
);

// 4. ACTION (Split Layout for text and chart)
let slideAct = addSlide(
  "ACTION: The SaveWise Solution", 
  "Intelligent parsing & real-time insights.", 
  [
    "Built a custom engine that parses standard bank SMS alerts instantly.",
    "Integrated live Yahoo Finance data for real-time stock portfolio tracking.",
    "Engineered an AI Advisor that analyzes real spending habits for actionable feedback."
  ],
  4.8 // Restrict text width to left half
);

// Native PPTX Doughnut Chart (Right side)
let dataChartPie = [
  {
    name: "Automated Categorization",
    labels: ["Food", "Transport", "Shopping", "Bills", "Health"],
    values: [40, 20, 15, 15, 10]
  }
];
slideAct.addChart(pres.ChartType.doughnut, dataChartPie, {
  x: 5.5, y: 1.2, w: 4.2, h: 3.8, // Positioned safely on the right
  showLegend: true,
  legendPos: "b",
  legendColor: "ffffff",
  showTitle: true,
  title: "AI-Powered Categorization",
  titleColor: "ffffff",
  chartColors: ["f97316", "3b82f6", "a855f7", "eab308", "14b8a6"],
  dataLabelColor: "ffffff",
  showValue: true,
  showPercent: true
});

// 5. ACTION: The Platform
let slidePhotos = pres.addSlide({ masterName: "MASTER_SLIDE" });
slidePhotos.addText("ACTION: The Platform", { x: 0.5, y: 0.5, w: "90%", h: 0.6, color: "34d399", fontSize: 16, bold: true, fontFace: "Arial" });
slidePhotos.addText("Beautiful, intuitive, and lightning fast.", { x: 0.5, y: 1.1, w: "90%", h: 1.0, color: "ffffff", fontSize: 28, bold: true, fontFace: "Arial" });

// Build a native UI wireframe instead of relying on external images
// Main App Window Outline
slidePhotos.addShape(pres.ShapeType.roundRect, { x: 0.5, y: 1.8, w: 9.0, h: 3.5, fill: { color: "11131f" }, line: { color: "34d399", width: 1 } });

// Sidebar wireframe
slidePhotos.addShape(pres.ShapeType.rect, { x: 0.5, y: 1.8, w: 2.0, h: 3.5, fill: { color: "1a1c29" } });
slidePhotos.addText("SaveWise", { x: 0.6, y: 2.0, w: 1.8, h: 0.3, color: "ffffff", bold: true, fontSize: 14 });
slidePhotos.addText("■ Dashboard\n■ Portfolio\n■ AI Advisor\n■ Settings", { x: 0.6, y: 2.5, w: 1.8, h: 1.5, color: "e0e0e0", fontSize: 12, lineSpacing: 25, valign: "top" });

// Dashboard Content Wireframe
slidePhotos.addText("Total Net Worth", { x: 2.8, y: 2.0, w: 2.5, h: 0.3, color: "cccccc", fontSize: 12 });
slidePhotos.addText("₹ 1,45,000", { x: 2.8, y: 2.3, w: 2.5, h: 0.5, color: "ffffff", bold: true, fontSize: 24 });
slidePhotos.addText("▲ +15% this month", { x: 4.8, y: 2.4, w: 1.5, h: 0.3, color: "34d399", fontSize: 12 });

// Mini Chart inside wireframe
let wireframeChart = [
  { name: "Portfolio", labels: ["M", "T", "W", "T", "F"], values: [120, 125, 130, 128, 145] }
];
slidePhotos.addChart(pres.ChartType.line, wireframeChart, {
  x: 2.8, y: 3.0, w: 3.5, h: 2.0,
  showLegend: false,
  chartColors: ["6366f1"],
  lineDataSymbol: "none",
  lineSize: 3,
  valAxisLabelColor: "666666",
  catAxisLabelColor: "666666",
  gridLineColor: "333333"
});

// Recent Transactions Wireframe
slidePhotos.addShape(pres.ShapeType.roundRect, { x: 6.8, y: 2.0, w: 2.5, h: 3.1, fill: { color: "1a1c29" } });
slidePhotos.addText("Recent Transactions", { x: 7.0, y: 2.2, w: 2.0, h: 0.3, color: "ffffff", bold: true, fontSize: 12 });
slidePhotos.addText("🍔 Swiggy       -₹450\n🚗 Uber          -₹200\n📈 Stocks       -₹5000\n💰 Salary      +₹50000", { x: 7.0, y: 2.6, w: 2.1, h: 2.0, color: "e0e0e0", fontSize: 11, lineSpacing: 25, valign: "top" });

// 6. RESULT
addSlide(
  "RESULT: The Outcome", 
  "A production-ready financial ecosystem.", 
  [
    "100% automated expense tracking achieved for users.",
    "Bank-grade security with AES-256-GCM encryption and robust SQLite fallback.",
    "16 comprehensive automated health checks running daily ensuring maximum reliability.",
    "100% test coverage across core engines."
  ]
);

// 7. Team & Ask
let slideAsk = pres.addSlide({ masterName: "MASTER_SLIDE" });
slideAsk.addText("THE ASK", { x: 0.5, y: 0.5, w: "90%", h: 0.6, color: "34d399", fontSize: 16, bold: true, fontFace: "Arial" });
slideAsk.addText("Let's scale SaveWise.", { x: 0.5, y: 1.1, w: "90%", h: 1.0, color: "ffffff", fontSize: 28, bold: true, fontFace: "Arial" });

slideAsk.addText(
  "The Team:\nBuilt by Soloking (2nd-Year CSE B.Tech Student) with a passion for FinTech and automation. Engineered from the ground up for scale and reliability.",
  { x: 0.5, y: 2.2, w: 4.5, h: 2.0, color: "e0e0e0", fontSize: 18, fontFace: "Arial", lineSpacing: 25, valign: "top" }
);

slideAsk.addText(
  "The Opportunity:\nSeeking seed funding and mentorship to scale infrastructure, integrate direct banking APIs, and drive user acquisition among students and young professionals.",
  { x: 5.5, y: 2.2, w: 4.0, h: 2.0, color: "e0e0e0", fontSize: 18, fontFace: "Arial", lineSpacing: 25, valign: "top" }
);

// Save the Presentation
pres.writeFile({ fileName: "SaveWise_Pitch_Deck_Final.pptx" }).then(fileName => {
  console.log(`Created presentation: ${fileName}`);
});
