import SwapUniV2 from './Swap/SwapUniV2Tester';
import SwapUniV3 from './Swap/SwapUniV3Tester';
import UniswapV2PoolTester from './Uniswap/UniswapV2PoolTester';
import UniswapV3PoolTester from './Uniswap/UniswapV3PoolTester';
import UniswapV3FactoryTester from './Uniswap/UniswapV3FactoryTester';
import FlashLoanSimpleTester from './FlashLoan/FlashLoanSimpleTester';
import FlashLoanMultipleTester from './FlashLoan/FlashLoanMultipleTester';
import { ethers } from "hardhat";
import { FeeAmount } from '@uniswap/v3-sdk';
import UniswapV3PoolFetcher from './Uniswap/UniswapV3PoolFetcher';

async function test() {
    let wallet = await (await ethers.provider.getSigner()).getAddress();

    console.log(`Current block: ${await ethers.provider.getBlockNumber()}`)

    // Swap contract: allows to swap 1 WETH for LINK in Uniswap V3 (Section 4.2)
    let swapContractV3 = new SwapUniV3();
    await swapContractV3.initialize();
    await swapContractV3.fundWithWrappedEth("10", wallet);
    await swapContractV3.test();

    console.log("\n")

    // Swap contract: allows to swap 1 WETH for LINK in Uniswap V2 (Section 4.1)
    let swapContractV2 = new SwapUniV2();
    await swapContractV2.initialize();
    await swapContractV2.test();

    console.log("\n")

    // flashLoan contract: does a flash loan, performs arbitrage then repays the loan
    let flashLoanSingle = new FlashLoanSimpleTester(swapContractV3.address);
    await flashLoanSingle.initialize();
    await flashLoanSingle.fundWithWrappedEth("1");
    await flashLoanSingle.test();

    console.log("\n")

    // Get prices from Uniswap V2, pair WETH/USDC (Section 4.1)
    let pairAddressV2 = "0x0d4a11d5eeaac28ec3f61d100daf4d40471f1852"; // WETH/USDC
    let uniswapV2Pool = new UniswapV2PoolTester(pairAddressV2);
    await uniswapV2Pool.initialize();
    let price = await uniswapV2Pool.getWrappedEthPrice();
    console.log(`Price of 1 WETH in USDC in UniV2: ${price}`);

    console.log("\n")

    // Get prices from Uniswap V3, pair USDC/WETH. (Section 4.1)
    let factory = new UniswapV3FactoryTester();
    let usdcWethPair = await factory.getUsdcWethPool();
    let uniswapV3Pool = new UniswapV3PoolTester(usdcWethPair);
    await uniswapV3Pool.initialize();
    price = await uniswapV3Pool.getWrappedEthPrice();
    console.log(`Price of 1 WETH in USDC in UniV3: ${price}`);

    console.log("\n")

    // Get prices from Uniswap V3, pair DAI/WETH. (Section 4.1)
    let daiWethPair = await factory.getDaiWethPool();
    let uniswapV3Pool2 = new UniswapV3PoolTester(daiWethPair);
    await uniswapV3Pool2.initialize();
    price = await uniswapV3Pool2.getWrappedEthPrice();
    console.log(`Price of 1 WETH in DAI in UniV3: ${price}`);

    console.log("\n")

    // Get prices from Uniswap V3, pair DAI/USDC. (Section 4.1)
    let daiUsdtPair = await factory.getDaiUsdcPool();
    let uniswapV3Pool3 = new UniswapV3PoolTester(daiUsdtPair);
    await uniswapV3Pool3.initialize();
    await uniswapV3Pool3.getPrice();

    console.log("\n")

    // Swap 1 WETH -> USDC -> DAI -> WETH in Uniswap V3
    let flashLoanMultiple = new FlashLoanMultipleTester(swapContractV3.address);
    await flashLoanMultiple.initialize();
    await flashLoanMultiple.fundWithWrappedEth("1");
    await flashLoanMultiple.test();

    console.log("\n")
}

async function main() {

    let wallet = await (await ethers.provider.getSigner()).getAddress();

    console.log(`Current block: ${await ethers.provider.getBlockNumber()}`)

    // Get prices from Uniswap V3, pair USDC/WETH. (Section 4.1)

    let feeAmounts = [FeeAmount.LOWEST, FeeAmount.LOW, FeeAmount.MEDIUM, FeeAmount.HIGH];

    for (let feeAmount of feeAmounts) {
        let factory = new UniswapV3FactoryTester();
        let usdcWethPair = await factory.getUsdcWethPool(feeAmount);

        let uniswapV3Pool = new UniswapV3PoolFetcher(usdcWethPair);
        await uniswapV3Pool.initialize();

        let price = await uniswapV3Pool.getWrappedEthPrice();
        let reserves = await uniswapV3Pool.getReserves();
        console.log(`Price of 1 WETH in USDC in UniV3 with fee ${feeAmount}: ${price}. Reserves: ${reserves}`);
    }
}

// Run main and do not exit
main().catch(console.error);