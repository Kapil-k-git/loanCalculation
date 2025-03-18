const xlsx = require("xlsx");
const path = require("path");

const filePath = path.join(__dirname, "../data/Calculation.xlsx");

const cleanNumber = (value) => {
  if (!value || value === "N/A") return 0; 
  return parseFloat(value.toString().replace(/[^\d.-]/g, "")) || 0; 
};
const extractLoanRange = (loanAmount) => {
  if (!loanAmount) return [0, Infinity];
  const amounts = loanAmount.split("-").map((amt) => cleanNumber(amt));
  return [amounts[0] || 0, amounts[1] || Infinity];
};


const extractTermYears = (term) => {
  if (!term) return 0; 
  const match = term.toString().match(/\d+/g); 
  return match ? parseInt(match[0]) : 0; 
};



const processLoanData = () => {
  try {
    const workbook = xlsx.readFile(filePath);
    const recentOffersSheet = xlsx.utils.sheet_to_json(workbook.Sheets["Recent Offers"]);

    const cleanedData = recentOffersSheet.map((offer) => {
      console.log(offer);
      
      let loanAmountStr = offer["Loan Amount "] || "0";
      loanAmountStr = loanAmountStr.trim().toLowerCase().replace(/\r?\n/g, ""); // Remove extra spaces & newlines
      let loanAmount = parseFloat(loanAmountStr.replace(/[^\d.]/g, "")) || 0;
      
      if (loanAmountStr.includes("k")) {
        loanAmount *= 1000; 
      }

      const interestRate = offer["Interest Rate"]; 

      const term = offer["Term"] ? parseInt(offer["Term"]) : 0;

      let monthlyRepayment = offer["Monthly Repayment"];
      monthlyRepayment = (monthlyRepayment && monthlyRepayment !== "N/A") ? parseFloat(monthlyRepayment) : 0;

      const lender = offer["Lenders"] ? offer["Lenders"].trim() : "Not Specified";

      const companyName = offer["Company name"] || "Unknown";

      if (monthlyRepayment === 0 && loanAmount > 0 && term > 0) {
        monthlyRepayment = ((loanAmount * (1 + interestRate)) / term).toFixed(2);
      }

      return {
        companyName,
        lender,
        loanAmount: loanAmount.toFixed(2), 
        interestRate: interestRate, 
        term: term || "N/A",
        monthlyRepayment: monthlyRepayment
      };
    });

    return cleanedData;
  } catch (error) {
    console.error("Error processing loan data:", error);
    return [];
  }
};



const calculateProfitability = (netAssets, prevYearNetAssets) => {
  return netAssets - prevYearNetAssets;
};

const determineLoanTier = (netAssets, prevYearNetAssets, tradingTime) => {
  const profitability = calculateProfitability(netAssets, prevYearNetAssets);
  if (tradingTime >= 3 && profitability > 50000) return "Tier 1";
  if (tradingTime >= 2 && profitability > 30000) return "Tier 2";
  return "Tier 3";
};


const getEligibleLenders = (netAssets, tradingTime, loanAmount) => {
  const workbook = xlsx.readFile(filePath);
  const sheet = xlsx.utils.sheet_to_json(workbook.Sheets["Lender Criteria"], { header: 1 });

  if (!sheet) {
    console.error("❌ Error: Sheet does not contain enough data.");
    return [];
  }

  const lenderNames = sheet[0].slice(1); 

  const lenders = lenderNames.map((lender, index) => ({
    name: lender?.trim() || "Unknown Lender",
    minAssets: cleanNumber(sheet[1][index + 1]),  
    loanAmountRange: sheet[2][index + 1]?.trim() || "N/A",  
    term: sheet[3][index + 1]?.trim() || "N/A",  
    interestRate: sheet[4][index + 1]?.trim() || "N/A",  
    minYears: extractTermYears(sheet[6][index + 1]) || 0,  
  }));

  console.log("✅ Transformed Lenders Data:", lenders);

  return lenders
    .filter((lender) => {
      const [minLoan, maxLoan] = extractLoanRange(lender.loanAmountRange);
      return (
        netAssets >= lender.minAssets &&
        tradingTime >= lender.minYears &&
        loanAmount >= minLoan &&
        loanAmount <= maxLoan
      );
    })
    .map((lender) => ({
      name: lender.name,
      loanAmountRange: lender.loanAmountRange,
      interestRate: lender.interestRate,
      term: lender.term,
    }));
};



const getOptimalInterestRate = (loanAmount, term) => {
  console.log("🔹 Input Loan Amount:", loanAmount, "Term:", term);

  const workbook = xlsx.readFile(filePath);
  const recentOffersSheet = xlsx.utils.sheet_to_json(workbook.Sheets["Recent Offers"]);

  const similarLoans = recentOffersSheet.filter(offer => {
    let loanKey = Object.keys(offer).find(key => key.trim().toLowerCase() === "loan amount");
    
    if (!loanKey) {
      console.error("❌ Error: Loan Amount key not found in offer", offer);
      return false;
    }

    let pastLoanAmountStr = offer[loanKey] || "0";
    pastLoanAmountStr = pastLoanAmountStr.trim().toLowerCase().replace(/\r?\n/g, "");
    let pastLoanAmount = parseFloat(pastLoanAmountStr.replace(/[^\d.]/g, "")) || 0;

    if (pastLoanAmountStr.includes("k")) {
      pastLoanAmount *= 1000;
    }

    const pastTerm = parseInt(offer["Term"]) || 0;

    console.log("🔹 Checking Loan:", pastLoanAmount, "Term:", pastTerm);

    // ✅ Allow loan amount within ±50% range instead of ±20%
    const loanAmountMin = loanAmount * 0.5;
    const loanAmountMax = loanAmount * 1.5;

    // ✅ Allow term within ±6 months instead of exact match
    const termMin = term - 6;
    const termMax = term + 6;

    return (
      pastLoanAmount >= loanAmountMin && 
      pastLoanAmount <= loanAmountMax && 
      pastTerm >= termMin && 
      pastTerm <= termMax
    );
  });

  console.log("✅ Similar Loans Found:", similarLoans.length, similarLoans);

  const acceptedRates = similarLoans
    .map(offer => {
      let rate = parseFloat(offer["Interest Rate"]);
      console.log("🔹 Raw Interest Rate:", offer["Interest Rate"], "Parsed:", rate);
      return rate / 100;
    })
    .filter(rate => rate > 0 && rate <= 0.24);

  console.log("✅ Accepted Rates:", acceptedRates);

  const optimalRate = acceptedRates.length 
    ? (acceptedRates.reduce((sum, rate) => sum + rate, 0) / acceptedRates.length ) * 100
    : 0.15;

  console.log("🎯 Final Optimal Rate:", optimalRate);
  return Math.min(optimalRate, 0.24);
};




const recommendLenders = (netAssets, loanAmount, term) => {
    const workbook = xlsx.readFile(filePath);
    const lendersSheet = xlsx.utils.sheet_to_json(workbook.Sheets["Lender Criteria"]);

    let matchingLenders = lendersSheet.filter(lender => {
      const minLoan = parseFloat(lender["Loan amount"].split("-")[0]?.replace(/[^\d.-]/g, "")) || 0;
      const maxLoan = parseFloat(lender["Loan amount"].split("-")[1]?.replace(/[^\d.-]/g, "")) || Infinity;
      const lenderTerm = parseInt(lender["Term"]?.match(/\d+/g)?.[0]) || 0;

      return loanAmount >= minLoan && loanAmount <= maxLoan && term <= lenderTerm;
    });

    matchingLenders.sort((a, b) => {
      const rateA = parseFloat(a["Rates"]) || 0;
      const rateB = parseFloat(b["Rates"]) || 0;
      const maxLoanA = parseFloat(a["Loan amount"].split("-")[1]?.replace(/[^\d.-]/g, "")) || 0;
      const maxLoanB = parseFloat(b["Loan amount"].split("-")[1]?.replace(/[^\d.-]/g, "")) || 0;
      const termA = parseInt(a["Term"]?.match(/\d+/g)?.[0]) || 0;
      const termB = parseInt(b["Term"]?.match(/\d+/g)?.[0]) || 0;

      return rateA - rateB || maxLoanB - maxLoanA || termB - termA;
    });

    return matchingLenders.slice(0, 3).map(lender => ({
      name: lender["Lender"],
      loanAmountRange: lender["Loan amount"],
      interestRate: lender["Rates"],
      term: lender["Term"],
    }));
};

const prioritizeLoanOffers = (loanOffers) => {
    if (!loanOffers || loanOffers.length === 0) {
      return [];
    }

    loanOffers.sort((a, b) => {
      const repaymentA = parseFloat(a.monthlyRepayment) || 0;
      const repaymentB = parseFloat(b.monthlyRepayment) || 0;
      const termA = parseInt(a.term) || 0;
      const termB = parseInt(b.term) || 0;
      const amountA = parseFloat(a.loanAmount) || 0;
      const amountB = parseFloat(b.loanAmount) || 0;

      return repaymentA - repaymentB || termB - termA || amountB - amountA;
    });

    return loanOffers.slice(0, 3);
};

module.exports = { 
  processLoanData, 
  determineLoanTier, 
  getEligibleLenders, 
  getOptimalInterestRate, 
  recommendLenders, 
  prioritizeLoanOffers,
  calculateProfitability
};
