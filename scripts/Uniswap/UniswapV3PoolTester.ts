
import { FACTORY_ADDRESS, Pool } from '@uniswap/v3-sdk';
import { ContractManager } from '../lib/ContractManager';
import { ethers } from 'hardhat'
import { IQuoter, IUniswapV3Pool, IERC20Metadata } from '../../typechain-types';

// Main function to execute the script

export default class UniswapV3PoolTester extends ContractManager<IUniswapV3Pool> {
    token0: IERC20Metadata = {} as IERC20Metadata;
    token1: IERC20Metadata = {} as IERC20Metadata;
    token0Address: string = "";
    token1Address: string = "";
    zero = ethers.getBigInt(0);
    reserves = this.zero;

    constructor(address?: string) {
        super("IUniswapV3Pool", address);
    }

    async initialize() {
        await super.initialize();
        this.token0Address = await this.contract.token0();
        this.token1Address = await this.contract.token1();

        this.token0 = await this.getErc20Token(this.token0Address);
        this.token1 = await this.getErc20Token(this.token1Address);

        this.reserves = await this.contract.liquidity();
    }

    async getPrice() {

        const token0Name = await this.token0.name();
        const token1Name = await this.token1.name();

        const token0Symbol = await this.token0.symbol();
        const token1Symbol = await this.token1.symbol();

        const token0Decimals = 10 ** Number(await this.token0.decimals());
        const token1Decimals = 10 ** Number(await this.token1.decimals());

        let slot0 = await this.contract.slot0();
        let sqrtPriceX96 = Number(slot0.sqrtPriceX96);

        let sqrtPrice = sqrtPriceX96 / 2 ** 96

        let price = sqrtPrice * sqrtPrice;

        let adjustedPrice = (price * (token0Decimals / token1Decimals));

        let price1_in_terms_of_0 = (adjustedPrice).toString(10);

        let price0_in_terms_of_1 = ((1) / adjustedPrice).toString(10);

        console.log(`Price of 1 ${token0Name} (${token0Symbol}) in ${token1Name} (${token1Symbol}): ${price1_in_terms_of_0}`)
        console.log(`Price of 1 ${token1Name} (${token1Symbol}) in ${token0Name} (${token0Symbol}): ${price0_in_terms_of_1}`)

        return [price0_in_terms_of_1, price1_in_terms_of_0] as const;
    }

    async getReserves() {
        return this.reserves;
    }

    async getWrappedEthPrice(): Promise<string> {

        const token0Symbol = await this.token0.symbol();
        const token1Symbol = await this.token1.symbol();

        const token0Decimals = 10 ** Number(await this.token0.decimals());
        const token1Decimals = 10 ** Number(await this.token1.decimals());

        let slot0 = await this.contract.slot0();
        let sqrtPriceX96 = Number(slot0.sqrtPriceX96);

        let sqrtPrice = sqrtPriceX96 / 2 ** 96

        let price = sqrtPrice * sqrtPrice;

        let adjustedPrice = (price * (token0Decimals / token1Decimals));

        let price1_in_terms_of_0 = (adjustedPrice).toString(10);

        let price0_in_terms_of_1 = ((1) / adjustedPrice).toString(10);

        if (token0Symbol === "WETH") {
            return price1_in_terms_of_0;
        } else if (token1Symbol === "WETH") {
            return price0_in_terms_of_1;
        } else {
            console.log("Neither token is Wrapped Ether");
            return "0";
        }
    }

}






