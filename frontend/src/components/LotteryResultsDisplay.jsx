import React from 'react';
import { Trophy, RefreshCw } from 'lucide-react';

// Lottery logo URLs - mapped by lottery name patterns
const LOTTERY_LOGOS = {
  'georgia': 'https://upload.wikimedia.org/wikipedia/en/thumb/6/6d/Georgia_Lottery_logo.svg/200px-Georgia_Lottery_logo.svg.png',
  'florida': 'https://upload.wikimedia.org/wikipedia/en/thumb/5/56/Florida_Lottery_logo.svg/200px-Florida_Lottery_logo.svg.png',
  'new york': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/NY_Lottery.svg/200px-NY_Lottery.svg.png',
  'ny': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/NY_Lottery.svg/200px-NY_Lottery.svg.png',
  'california': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/California_State_Lottery_logo.svg/200px-California_State_Lottery_logo.svg.png',
  'texas': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f9/Texas_Lottery_Commission_logo.svg/200px-Texas_Lottery_Commission_logo.svg.png',
  'illinois': 'https://upload.wikimedia.org/wikipedia/en/thumb/6/61/Illinois_Lottery_logo.svg/200px-Illinois_Lottery_logo.svg.png',
  'pennsylvania': 'https://upload.wikimedia.org/wikipedia/en/thumb/4/4f/Pennsylvania_Lottery_logo.svg/200px-Pennsylvania_Lottery_logo.svg.png',
  'ohio': 'https://upload.wikimedia.org/wikipedia/en/thumb/8/83/Ohio_Lottery_Commission_logo.svg/200px-Ohio_Lottery_Commission_logo.svg.png',
  'michigan': 'https://upload.wikimedia.org/wikipedia/en/thumb/2/26/Michigan_Lottery_logo.svg/200px-Michigan_Lottery_logo.svg.png',
  'new jersey': 'https://upload.wikimedia.org/wikipedia/en/thumb/9/9e/New_Jersey_Lottery_logo.svg/200px-New_Jersey_Lottery_logo.svg.png',
  'nj': 'https://upload.wikimedia.org/wikipedia/en/thumb/9/9e/New_Jersey_Lottery_logo.svg/200px-New_Jersey_Lottery_logo.svg.png',
  'massachusetts': 'https://upload.wikimedia.org/wikipedia/en/thumb/4/4d/Massachusetts_State_Lottery_logo.svg/200px-Massachusetts_State_Lottery_logo.svg.png',
  'virginia': 'https://upload.wikimedia.org/wikipedia/en/thumb/0/02/Virginia_Lottery_logo.svg/200px-Virginia_Lottery_logo.svg.png',
  'maryland': 'https://upload.wikimedia.org/wikipedia/en/thumb/9/98/Maryland_Lottery_logo.svg/200px-Maryland_Lottery_logo.svg.png',
  'north carolina': 'https://upload.wikimedia.org/wikipedia/en/thumb/b/bb/North_Carolina_Education_Lottery_logo.svg/200px-North_Carolina_Education_Lottery_logo.svg.png',
  'nc': 'https://upload.wikimedia.org/wikipedia/en/thumb/b/bb/North_Carolina_Education_Lottery_logo.svg/200px-North_Carolina_Education_Lottery_logo.svg.png',
  'washington': 'https://upload.wikimedia.org/wikipedia/en/thumb/5/58/Washington%27s_Lottery_logo.svg/200px-Washington%27s_Lottery_logo.svg.png',
  'colorado': 'https://upload.wikimedia.org/wikipedia/en/thumb/d/d9/Colorado_Lottery_logo.svg/200px-Colorado_Lottery_logo.svg.png',
  'arizona': 'https://upload.wikimedia.org/wikipedia/en/thumb/5/59/Arizona_Lottery_logo.svg/200px-Arizona_Lottery_logo.svg.png',
  'connecticut': 'https://upload.wikimedia.org/wikipedia/en/thumb/b/be/Connecticut_Lottery_logo.svg/200px-Connecticut_Lottery_logo.svg.png',
  'ct': 'https://upload.wikimedia.org/wikipedia/en/thumb/b/be/Connecticut_Lottery_logo.svg/200px-Connecticut_Lottery_logo.svg.png',
  'arkansas': 'https://upload.wikimedia.org/wikipedia/en/6/6d/Arkansas_Scholarship_Lottery_logo.png',
  'ar': 'https://upload.wikimedia.org/wikipedia/en/6/6d/Arkansas_Scholarship_Lottery_logo.png',
  'default': null
};

// Get logo URL for a lottery
const getLotteryLogo = (lotteryName) => {
  if (!lotteryName) return null;
  const nameLower = lotteryName.toLowerCase();
  
  for (const [key, url] of Object.entries(LOTTERY_LOGOS)) {
    if (nameLower.includes(key)) {
      return url;
    }
  }
  return null;
};

// Get flag emoji based on lottery name
const getLotteryFlag = (lotteryName) => {
  if (!lotteryName) return '🎰';
  const nameLower = lotteryName.toLowerCase();
  
  // US States
  if (nameLower.includes('ny') || nameLower.includes('new york')) return '🗽';
  if (nameLower.includes('florida') || nameLower.includes('fl')) return '🌴';
  if (nameLower.includes('georgia') || nameLower.includes('ga')) return '🍑';
  if (nameLower.includes('california') || nameLower.includes('ca')) return '☀️';
  if (nameLower.includes('texas') || nameLower.includes('tx')) return '🤠';
  
  return '🎰';
};

// Parse winning numbers from various formats
const parseWinningNumbers = (wn) => {
  if (!wn) return ['--', '--', '--'];
  
  // If array
  if (Array.isArray(wn)) {
    const nums = wn.slice(0, 3);
    while (nums.length < 3) nums.push('--');
    return nums;
  }
  
  // If object with first/second/third
  if (typeof wn === 'object') {
    return [
      wn.first || '--',
      wn.second || '--', 
      wn.third || '--'
    ];
  }
  
  // If string, split by common delimiters
  if (typeof wn === 'string') {
    const nums = wn.split(/[-,\s]+/).filter(n => n.trim());
    while (nums.length < 3) nums.push('--');
    return nums.slice(0, 3);
  }
  
  return ['--', '--', '--'];
};

// Number display component with colored boxes
const NumberBox = ({ number, position }) => {
  const colors = {
    0: 'bg-emerald-500', // Green for 1st
    1: 'bg-amber-400',   // Yellow for 2nd
    2: 'bg-blue-500'     // Blue for 3rd
  };
  
  return (
    <div className={`${colors[position] || 'bg-slate-500'} w-12 h-14 sm:w-14 sm:h-16 flex items-center justify-center rounded-lg shadow-lg`}>
      <span className="text-white font-bold text-lg sm:text-xl">{number}</span>
    </div>
  );
};

// Single lottery result card
const LotteryResultCard = ({ lottery, todayResult, yesterdayResult }) => {
  const logoUrl = getLotteryLogo(lottery.lottery_name);
  const flag = getLotteryFlag(lottery.lottery_name);
  
  const todayNumbers = parseWinningNumbers(todayResult?.winning_numbers);
  const yesterdayNumbers = parseWinningNumbers(yesterdayResult?.winning_numbers);
  
  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-slate-200 hover:shadow-xl transition-shadow">
      <div className="p-4 sm:p-6">
        {/* Logo and Lottery Name */}
        <div className="flex items-center gap-4 mb-4">
          {logoUrl ? (
            <img 
              src={logoUrl} 
              alt={lottery.lottery_name}
              className="w-16 h-16 sm:w-20 sm:h-20 object-contain"
              onError={(e) => {
                e.target.onerror = null;
                e.target.style.display = 'none';
              }}
            />
          ) : (
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-purple-500 to-purple-700 rounded-full flex items-center justify-center text-3xl">
              {flag}
            </div>
          )}
          <div>
            <h3 className="font-bold text-slate-800 text-sm sm:text-base">{lottery.lottery_name}</h3>
            <span className="text-xs text-slate-500">{lottery.flag_type || 'USA'}</span>
          </div>
        </div>
        
        {/* Today's Result (MATIN) */}
        <div className="mb-4">
          <p className="text-sm font-semibold text-slate-600 mb-2">
            Aujourd'hui ({todayResult?.draw_time || 'MATIN'})
          </p>
          <div className="flex gap-2 justify-center">
            {todayNumbers.map((num, idx) => (
              <NumberBox key={`today-${idx}`} number={num} position={idx} />
            ))}
          </div>
        </div>
        
        {/* Yesterday's Result (SOIR) */}
        {yesterdayResult && (
          <div>
            <p className="text-sm font-semibold text-slate-600 mb-2">
              Hier ({yesterdayResult?.draw_time || 'SOIR'})
            </p>
            <div className="flex gap-2 justify-center">
              {yesterdayNumbers.map((num, idx) => (
                <NumberBox key={`yesterday-${idx}`} number={num} position={idx} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Main component - displays all lottery results
const LotteryResultsDisplay = ({ results = [], lotteries = [], onRefresh, loading = false }) => {
  // Group results by lottery and date
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  
  // Create a map of results by lottery_id and date
  const resultsByLottery = {};
  results.forEach(result => {
    const lid = result.lottery_id;
    if (!resultsByLottery[lid]) {
      resultsByLottery[lid] = { today: null, yesterday: null, lottery_name: result.lottery_name };
    }
    if (result.draw_date === today) {
      resultsByLottery[lid].today = result;
    } else if (result.draw_date === yesterday) {
      resultsByLottery[lid].yesterday = result;
    } else if (!resultsByLottery[lid].today && !resultsByLottery[lid].yesterday) {
      // Use most recent result as "today" if no today result
      resultsByLottery[lid].today = result;
    }
  });
  
  // Get unique lotteries with results
  const lotteriesWithResults = Object.entries(resultsByLottery).map(([lid, data]) => ({
    lottery_id: lid,
    lottery_name: data.lottery_name,
    todayResult: data.today,
    yesterdayResult: data.yesterday
  }));
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Trophy className="w-8 h-8 text-amber-500" />
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Derniers Résultats</h1>
            <p className="text-sm text-slate-500">Résultats officiels des loteries</p>
          </div>
        </div>
        {onRefresh && (
          <button 
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
        )}
      </div>
      
      {/* Results Grid */}
      {lotteriesWithResults.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-xl">
          <Trophy className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">Aucun résultat disponible</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {lotteriesWithResults.map((item) => (
            <LotteryResultCard
              key={item.lottery_id}
              lottery={item}
              todayResult={item.todayResult}
              yesterdayResult={item.yesterdayResult}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default LotteryResultsDisplay;
