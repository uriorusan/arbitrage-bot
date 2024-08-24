import { TokenList, TokenInfo } from '@uniswap/token-lists';
import Furucombo from './Furucombo.tokenlist.json';
import UniswapTokenPairs from './UniswapTokenPairs.tokenlist.json';


export class MyTokenList {
    public tokenList: TokenList;
    public tokenPairlist: TokenList;

    constructor() {
        this.tokenList = Furucombo as TokenList;
        this.tokenPairlist = UniswapTokenPairs as TokenList;
    }

    public async initialize() {
    }

    public getTokenByName(tokenSymbol: string): TokenInfo | undefined {
        return this.tokenList.tokens.find(token => token.symbol === tokenSymbol);
    }

    public getTokenPairByName(token0: string, token1: string): TokenInfo | undefined {
        return this.tokenPairlist.tokens.find(token => token.name.includes(`${token0}/${token1}`) || token.name.includes(`${token1}/${token0}`));
    }
}