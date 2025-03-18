const { 
  processLoanData, 
  determineLoanTier, 
  getEligibleLenders, 
  getOptimalInterestRate, 
  recommendLenders, 
  prioritizeLoanOffers, 
  calculateProfitability 
} = require("../utils/dataProcessor");

const lenderData=require('../data/companyData.json')

const processLoans = async (req, res) => {
  try {
    const loanOffers = processLoanData();
    if (!loanOffers.length) {
      return res.status(404).json({ error: "No loan data found in the Excel file." });
    }
    res.json(loanOffers);
  } catch (error) {
    console.error("Error processing loan data:", error);
    res.status(500).json({ error: "Error processing loan data" });
  }
};


const prioritizeLoans = async (req, res) => {
  try {
    const loanOffers = processLoanData(); 

    if (!loanOffers.length) {
      return res.status(404).json({ error: "No loan data found." });
    }

    const prioritizedLoans = loanPrioritize(loanOffers).slice(0, 3); 

    res.json(prioritizedLoans);
  } catch (error) {
    console.error("Error processing loan data:", error);
    res.status(500).json({ error: "Error processing loan data" });
  }
};

const loanPrioritize = (loanOffers) => {
  return loanOffers.sort((a, b) => {
    if (a.monthlyRepayment !== b.monthlyRepayment) {
      return a.monthlyRepayment - b.monthlyRepayment; 
    }
    if (a.term !== b.term) {
      return b.term - a.term; 
    }
    return b.loanAmount - a.loanAmount; 
  });
};


const matchLenders = async (req, res) => {
  try {
    const { companyName, netAssets, prevYearNetAssets, tradingTime, loanAmount } = req.body;

    const netAssetsNum = parseFloat(netAssets);
    const prevYearNetAssetsNum = parseFloat(prevYearNetAssets);
    const tradingTimeNum = parseInt(tradingTime, 10);
    const loanAmountNum = parseFloat(loanAmount);

    if (!companyName || isNaN(netAssetsNum) || isNaN(prevYearNetAssetsNum) || isNaN(tradingTimeNum) || isNaN(loanAmountNum)) {
      return res.status(400).json({ error: "Invalid input data. Please check your values." });
    }

    const company = lenderData.find(company => company.companyName.toLowerCase() === companyName.toLowerCase());

    if (!company) {
      return res.status(404).json({ error: "Company not found." });
    }

    const eligibleLenders = company.lenders.filter(lender =>
      lender.netAssets >= netAssetsNum &&
      lender.prevYearNetAssets >= prevYearNetAssetsNum &&
      lender.tradingTime <= tradingTimeNum &&
      lender.loanAmount >= loanAmountNum
    );

    res.json({ companyName, eligibleLenders });
  } catch (error) {
    console.error("Error matching lenders:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const classifyLoanTier = async (req, res) => {
  try {
    const { netAssets, prevYearNetAssets, tradingTime } = req.body;

    if (!netAssets || !prevYearNetAssets || !tradingTime) {
      return res.status(400).json({ error: "Missing required company financial data" });
    }

    const tier = determineLoanTier(netAssets, prevYearNetAssets, tradingTime);
    res.json({ tier });
  } catch (error) {
    console.error("Error classifying loan tier:", error);
    res.status(500).json({ error: "Error classifying loan tier" });
  }
};

const optimizeInterestRate = async (req, res) => {
  try {
    const { loanAmount, term } = req.body;

    if (!loanAmount || !term) {
      return res.status(400).json({ error: "Missing required loan details" });
    }

    const optimalRate = getOptimalInterestRate(loanAmount, term);
    console.log(optimalRate);
    
    res.json({ optimalInterestRate: optimalRate });
  } catch (error) {
    console.error("Error optimizing interest rate:", error);
    res.status(500).json({ error: "Error optimizing interest rate" });
  }
};



const getLenderRecommendations = async (req, res) => {
  try {
    const { netAssets, loanAmount, term } = req.body;

    const netAssetsNum = parseFloat(netAssets);
    const loanAmountNum = parseFloat(loanAmount);
    const termNum = parseInt(term, 10);

    if (isNaN(netAssetsNum) || isNaN(loanAmountNum) || isNaN(termNum)) {
      return res.status(400).json({ error: "Invalid input values. Please check your inputs." });
    }

    const filteredLenders = lenderData.flatMap(company => 
      company.lenders.filter(lender =>
        lender.netAssets >= netAssetsNum &&
        lender.loanAmount >= loanAmountNum &&
        lender.tradingTime >= termNum
      ).map(lender => ({
        companyName: company.companyName,
        lender: lender.lender,
        netAssets: lender.netAssets,
        loanAmount: lender.loanAmount,
        tradingTime: lender.tradingTime,
        interestRate: lender.interestRate,
        monthlyRepayment: lender.monthlyRepayment
      }))
    );

    if (!filteredLenders.length) {
      return res.status(404).json({ message: "No lenders match the given criteria." });
    }

    res.json({ recommendedLenders: filteredLenders });
  } catch (error) {
    console.error("Error recommending lenders:", error);
    res.status(500).json({ error: "Error processing lender recommendations" });
  }
};


const calculateCompanyProfitability = async (req, res) => {
  try {
    const { netAssets, prevYearNetAssets } = req.body;

    if (!netAssets || !prevYearNetAssets) {
      return res.status(400).json({ error: "Missing required financial data" });
    }

    const profitability = calculateProfitability(netAssets, prevYearNetAssets);
    res.json({ profitability });
  } catch (error) {
    console.error("Error calculating profitability:", error);
    res.status(500).json({ error: "Error calculating profitability" });
  }
};

const calculateMonthlyRepayment = async (req, res) => {
  try {
    const { loanAmount, interestRate, term } = req.body;

    // ✅ Validate input
    if (!loanAmount || !interestRate || !term || term <= 0) {
      return res.status(400).json({ error: "Invalid input values" });
    }

    // ✅ Apply Monthly Repayment Formula
    const monthlyRepayment = ((loanAmount * (1 + interestRate)) / term).toFixed(2);

    res.json({ loanAmount, interestRate, term, monthlyRepayment });
  } catch (error) {
    console.error("Error calculating monthly repayment:", error);
    res.status(500).json({ error: "Error processing request" });
  }
};


module.exports = { 
  processLoans, 
  matchLenders, 
  classifyLoanTier, 
  optimizeInterestRate, 
  getLenderRecommendations, 
  prioritizeLoans, 
  calculateCompanyProfitability,
  calculateMonthlyRepayment
  
};
