
import { SwapUniV3 } from '../../typechain-types';
import { ethers } from "hardhat";
import { AaveV3Ethereum } from "@bgd-labs/aave-address-book";
import { ContractManager } from "../lib/ContractManager";
import { token } from '../../typechain-types/@openzeppelin/contracts';
import { BigNumberish } from 'ethers';

export default class SwapUniV3Tester extends ContractManager<SwapUniV3> {
    swapRouterV3Address = "0xE592427A0AEce92De3Edee1F18E0157C05861564";

    constructor(address?: string) {
        super("SwapUniV3", address);
    }

    /**
     * Executes a trade in UniswapV3
     * @param amount amount, in full units, of the token0 to swap
     * @param token0Address address of token0
     * @param token1Address address of token1
     * @param poolFee pool fee in base 10000
     */
    public async executeTrade(amount: BigNumberish, token0Address: string, token1Address: string, poolFee: number) {

        let token0 = await this.getErc20Token(token0Address);
        let token1 = await this.getErc20Token(token1Address);

        let approveTx = await token0.approve(this.address, amount);
        await approveTx.wait();

        let tx = await this.contract.swapSingle(token0Address, token1Address, this.swapRouterV3Address, amount, poolFee);
        await tx.wait();

        return await token1.balanceOf(this.wallet);
    }

    public async test() {
        let balanceBeforeWETH = await this.getWEthBalance(this.wallet);
        let balanceBeforeLink = await this.getLinkBalance(this.wallet);

        let amountToSwap = ethers.parseEther("1");
        await this.executeTrade(amountToSwap, AaveV3Ethereum.ASSETS.WETH.UNDERLYING, AaveV3Ethereum.ASSETS.LINK.UNDERLYING, 3000);

        let balanceAfterWETH = await this.getWEthBalance(this.wallet);
        let balanceAfterLink = await this.getLinkBalance(this.wallet);

        console.log(`WETH contract Amount Before Swap: ${balanceBeforeWETH}, WETH Amount After Swap: ${balanceAfterWETH}`);
        console.log(`LINK Wallet Amount Before Swap: ${balanceBeforeLink}, LINK Amount After Swap: ${balanceAfterLink}`);
    }
}