
import { SwapUniV2 } from '../../typechain-types';
import { ethers } from "hardhat";
import { AaveV3Ethereum } from "@bgd-labs/aave-address-book";
import { ContractManager } from "../lib/ContractManager";
import { token } from '../../typechain-types/@openzeppelin/contracts';
import { BigNumberish } from 'ethers';

export default class SwapUniV2Tester extends ContractManager<SwapUniV2> {

    swapRouterV2Address = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"; // https://docs.uniswap.org/contracts/v2/reference/smart-contracts/router-02

    constructor(address?: string) {
        super("SwapUniV2", address);
    }

    test = async () => {
        console.log(`Will execute a Swap in UniswapV2 using the contract: ${this.address}`);
        console.log(`Will execute transactions from wallet: ${this.wallet}`);

        let balanceBeforeWETH = await this.getWEthBalance(this.wallet);
        let balanceBeforeLink = await this.getLinkBalance(this.wallet);

        let amountToSwap = ethers.parseEther("1");
        await this.executeTrade(amountToSwap, AaveV3Ethereum.ASSETS.WETH.UNDERLYING, AaveV3Ethereum.ASSETS.LINK.UNDERLYING);

        let balanceAfterWETH = await this.getWEthBalance(this.wallet);
        let balanceAfterLink = await this.getLinkBalance(this.wallet);

        console.log(`WETH contract Amount Before Swap: ${balanceBeforeWETH}, WETH Amount After Swap: ${balanceAfterWETH}`);
        console.log(`LINK Wallet Amount Before Swap: ${balanceBeforeLink}, LINK Amount After Swap: ${balanceAfterLink}`);
    }

    /**
     * Executes a trade in UniswapV2
     * @param amount amount as a readable string of the token0 to swap
     * @param token0Address address of token0
     * @param token1Address address of token1
     * @returns the balance of token1 in the wallet after the trade
     */
    async executeTrade(amount: BigNumberish, token0Address: string, token1Address: string) {
        let token0 = await this.getErc20Token(token0Address);

        let token1 = await this.getErc20Token(token1Address);

        let approveTx = await token0.approve(this.address, amount);
        await approveTx.wait();

        let tx = await this.contract.swapSingle(token0Address, token1Address, this.swapRouterV2Address, amount);
        await tx.wait();

        return await token1.balanceOf(this.wallet);
    }
}