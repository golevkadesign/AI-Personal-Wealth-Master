export interface MarketUniverseInstrument {
  symbol: string;
  stooqSymbol: string;
  label: string;
  category:
    | 'equity_index'
    | 'rates'
    | 'credit'
    | 'fx'
    | 'commodity'
    | 'crypto'
    | 'volatility'
    | 'unknown';
}

export const DEFAULT_MARKET_UNIVERSE: MarketUniverseInstrument[] = [
  {
    symbol: 'SPY',
    stooqSymbol: 'spy.us',
    label: 'S&P 500 ETF',
    category: 'equity_index'
  },
  {
    symbol: 'QQQ',
    stooqSymbol: 'qqq.us',
    label: 'Nasdaq 100 ETF',
    category: 'equity_index'
  },
  {
    symbol: 'IWM',
    stooqSymbol: 'iwm.us',
    label: 'Russell 2000 ETF',
    category: 'equity_index'
  },
  {
    symbol: 'TLT',
    stooqSymbol: 'tlt.us',
    label: '20Y Treasury Bond ETF',
    category: 'rates'
  },
  {
    symbol: 'HYG',
    stooqSymbol: 'hyg.us',
    label: 'High Yield Credit ETF',
    category: 'credit'
  },
  {
    symbol: 'LQD',
    stooqSymbol: 'lqd.us',
    label: 'Investment Grade Credit ETF',
    category: 'credit'
  },
  {
    symbol: 'GLD',
    stooqSymbol: 'gld.us',
    label: 'Gold ETF',
    category: 'commodity'
  },
  {
    symbol: 'USO',
    stooqSymbol: 'uso.us',
    label: 'WTI Crude Oil ETF',
    category: 'commodity'
  },
  {
    symbol: 'CPER',
    stooqSymbol: 'cper.us',
    label: 'Copper ETF',
    category: 'commodity'
  },
  {
    symbol: 'UUP',
    stooqSymbol: 'uup.us',
    label: 'US Dollar Bullish ETF',
    category: 'fx'
  },
  {
    symbol: 'KWEB',
    stooqSymbol: 'kweb.us',
    label: 'China Internet ETF',
    category: 'equity_index'
  },
  {
    symbol: 'BTC',
    stooqSymbol: 'btcusd',
    label: 'Bitcoin USD',
    category: 'crypto'
  }
];
