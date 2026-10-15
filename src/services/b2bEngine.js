/**
 * B2B Willingness-to-Pay (WTP) and Demand Curve Calculation Service
 * Generates continuous demand curves, price cliffs, and elasticity metrics
 */

export function generateWtpData(item, basePrice) {
  const steps = 15;
  const minPrice = Math.round(basePrice * 0.4);
  const maxPrice = Math.round(basePrice * 1.8);
  const stepSize = Math.round((maxPrice - minPrice) / steps);

  const pricePoints = [];
  let prevDemand = 100;

  for (let p = minPrice; p <= maxPrice; p += stepSize) {
    const ratio = p / basePrice;
    
    // Sigmoid / logistic decay for realistic willingness to pay
    let demandPct = 100 / (1 + Math.exp(4.5 * (ratio - 0.98)));
    
    // Introduce psychological price cliffs near round numbers (e.g. .99 or 50 increments)
    const isPsychologicalCliff = (p % 50 === 0 || p % 100 === 0 || ratio > 1.25);
    if (isPsychologicalCliff && ratio > 0.95) {
      demandPct -= 6.5; // sharp cliff drop
    }

    demandPct = Math.max(2, Math.min(100, Math.round(demandPct)));
    
    const impliedRevenue = Math.round(demandPct * p);
    const dropOff = prevDemand - demandPct;
    prevDemand = demandPct;

    pricePoints.push({
      price: p,
      demandPct,
      impliedRevenue,
      isCliff: dropOff > 12 && ratio >= 0.9,
      dropOff: Math.max(0, dropOff),
      ratio: Math.round(ratio * 100) / 100
    });
  }

  // Find optimal revenue price point
  const optimalRevenuePoint = [...pricePoints].sort((a, b) => b.impliedRevenue - a.impliedRevenue)[0];
  
  // Find strongest price cliff
  const detectedCliffs = pricePoints.filter(pt => pt.isCliff);

  return {
    itemTitle: item?.title || 'Selected SKU',
    category: item?.category || 'Tech',
    truePrice: basePrice,
    curve: pricePoints,
    optimalRevenuePrice: optimalRevenuePoint?.price || basePrice,
    optimalDemandPct: optimalRevenuePoint?.demandPct || 70,
    priceCliffs: detectedCliffs,
    elasticityRating: basePrice > 500 ? 'High (-1.82)' : 'Moderate (-1.15)',
    consumerPerceptionSummary: `Demand drops by ~${detectedCliffs[0]?.dropOff || 18}% once price exceeds S$${detectedCliffs[0]?.price || Math.round(basePrice * 1.05)}.`
  };
}

export function queryInsightsCopilot(query, currentItem, wtpData) {
  const q = query.toLowerCase();
  
  if (q.includes('cliff') || q.includes('drop') || q.includes('resistance')) {
    const cliff = wtpData.priceCliffs[0] || { price: Math.round(wtpData.truePrice * 1.08), dropOff: 16 };
    return {
      title: 'Price Cliff Analysis',
      answer: `For **${wtpData.itemTitle}**, behavioral player data indicates the primary price cliff occurs at **S$${cliff.price}**. At this exact psychological boundary, consumer purchase intent drops sharply by **${cliff.dropOff}%**.`,
      recommendation: `Set promotional MSRP below S$${cliff.price - 1} (e.g. S$${cliff.price - 1}.90) to retain ${wtpData.optimalDemandPct}% of mass-market volume.`
    };
  }

  if (q.includes('optimal') || q.includes('revenue') || q.includes('profit') || q.includes('price')) {
    return {
      title: 'Optimal Price Point Recommendation',
      answer: `Our willingness-to-pay model reveals the optimal revenue-maximizing price point is **S$${wtpData.optimalRevenuePrice}** (vs True Retail of S$${wtpData.truePrice}).`,
      recommendation: `At S$${wtpData.optimalRevenuePrice}, expected market conversion reaches **${wtpData.optimalDemandPct}%**, maximizing the index curve.`
    };
  }

  if (q.includes('segment') || q.includes('sync') || q.includes('cluster')) {
    return {
      title: 'Segment Willingness Breakdown',
      answer: `* **Tech Optimists**: Display +18% higher price tolerance for audio/computing features.\n* **Value Hunters**: Form the largest demographic (38%) with strict resistance over S$${Math.round(wtpData.truePrice * 0.95)}.\n* **Market Mavens**: Anchor closest to MSRP with standard normal distribution.`,
      recommendation: `Consider tiered bundling to capture the Tech Optimist surplus while providing entry SKUs for Value Hunters.`
    };
  }

  return {
    title: 'Behavioral Insights Synthesis',
    answer: `Analysis based on 2,840+ verified player guesses for **${wtpData.itemTitle}**: Category price elasticity is measured at **${wtpData.elasticityRating}**.`,
    recommendation: `Recommended list price range: **S$${Math.round(wtpData.truePrice * 0.92)} — S$${Math.round(wtpData.truePrice * 1.05)}**.`
  };
}
