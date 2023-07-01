import TokenConfigInterface from '../lib/TokenConfigInterface';
import * as Networks from '../lib/Networks';

const TokenConfig: TokenConfigInterface = {
  testnet: Networks.bscTestnet,
  mainnet: Networks.bscMainnet,
  contractName: 'TBCCFinanceFeeHandler',
  weth: '0xae13d989dac2f0debff460ac112a837c89baa7cd',
  tbcc: '0x74494Ae1B98B117161c16470A378Db1d48edf72B',
  tbccFinanceSwapRouter: '0x92bDE4E4300b0597bF329F7727d925Fa183Fb017',
  operatorAddress: '0x1ACD966478c53145e4dfEA60021264C03750c4A2',
  tbccBurnAddress: '0x55Ed6f63d2eD14Cb40A6513c52AFfF7396ea2692',
  tbccVaultAddress: '0xaa2E987B35e39bDAFce1d416cDBf577E4776Aa26',
  tbccBurnRate: '6250',
  contractAddress: '0xA9b72b7D1b8A71df0a1a8BF625E8a7E0c6A7984E',
  proxyAdminAddress: '0x73f1908E18660F2842C6494a369c6AC1Ea0ba82e',
  multiSigAddress: '0x447E77Cb651Ba486D59E3a024D2793f6c6B96510',
};

export default TokenConfig;
