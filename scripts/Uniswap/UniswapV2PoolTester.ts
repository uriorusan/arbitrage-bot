
import { FACTORY_ADDRESS } from '@uniswap/v3-sdk';
import { ContractManager } from '../lib/ContractManager';
import { ethers } from 'hardhat'
import { IUniswapV2Pair, IERC20Metadata } from '../../typechain-types';

// Main function to execute the script

export default class UniswapV2PoolTester extends ContractManager<IUniswapV2Pair> {
    token0: IERC20Metadata = {} as IERC20Metadata;
    token1: IERC20Metadata = {} as IERC20Metadata;
    token0Address: string = "";
    token1Address: string = "";
    zero = ethers.getBigInt(0);
    reserves = [this.zero, this.zero, this.zero];

    constructor(address?: string) {
        super("@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol:IUniswapV2Pair", address);
    }

    async initialize() {
        await super.initialize();
        this.token0Address = await this.contract.token0();
        this.token1Address = await this.contract.token1();

        this.token0 = await this.getErc20Token(this.token0Address);
        this.token1 = await this.getErc20Token(this.token1Address);

        this.reserves = await this.contract.getReserves();
    }

    async getPrice() {

        const token0Name = await this.token0.name();
        const token1Name = await this.token1.name();

        const token0Symbol = await this.token0.symbol();
        const token1Symbol = await this.token1.symbol();

        const token0Decimals = await this.token0.decimals();
        const token1Decimals = await this.token1.decimals();

        let reserve0 = Number(this.reserves[0] / (ethers.getBigInt(10) ** token0Decimals));
        let reserve1 = Number(this.reserves[1] / (ethers.getBigInt(10) ** token1Decimals));

        let price0_in_terms_of_1 = "";
        if (reserve1 > 0) {
            price0_in_terms_of_1 = (reserve0 / reserve1).toString(10);
        }

        let price1_in_terms_of_0 = "";
        if (reserve0 > 0) {
            price1_in_terms_of_0 = (reserve1 / reserve0).toString(10);
        }

        console.log(`Price of 1 ${token0Name} (${token0Symbol}) in ${token1Name} (${token1Symbol}): ${price1_in_terms_of_0}`)
        console.log(`Price of 1 ${token1Name} (${token1Symbol}) in ${token0Name} (${token0Symbol}): ${price0_in_terms_of_1}`)

    }

    async getWrappedEthPrice(): Promise<string> {
        const token0Name = await this.token0.name();
        const token1Name = await this.token1.name();

        const token0Symbol = await this.token0.symbol();
        const token1Symbol = await this.token1.symbol();

        const token0Decimals = await this.token0.decimals();
        const token1Decimals = await this.token1.decimals();

        let reserve0 = Number(this.reserves[0] / (ethers.getBigInt(10) ** token0Decimals));
        let reserve1 = Number(this.reserves[1] / (ethers.getBigInt(10) ** token1Decimals));

        let price0_in_terms_of_1 = "";
        if (reserve1 > 0) {
            price0_in_terms_of_1 = (reserve0 / reserve1).toString(10);
        }

        let price1_in_terms_of_0 = "";
        if (reserve0 > 0) {
            price1_in_terms_of_0 = (reserve1 / reserve0).toString(10);
        }

        if (token0Symbol === "WETH") {
            return price1_in_terms_of_0;
        } else if (token1Symbol === "WETH") {
            return price0_in_terms_of_1;
        } else {
            console.log("Neither token is WETH");
            return "0";
        }
    }
}
