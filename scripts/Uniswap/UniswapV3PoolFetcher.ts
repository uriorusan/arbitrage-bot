import { FeeAmount, Pool, Tick } from '@uniswap/v3-sdk'
import { ethers } from "hardhat";
import { Token } from '@uniswap/sdk-core'
import JSBI from 'jsbi'
import { Contract, Provider } from 'ethers-multicall'
import UniswapV3PoolTester from './UniswapV3PoolTester'
import { IERC20Metadata } from '../../typechain-types'


export interface PoolData {
    address: string
    tokenA: Token
    tokenB: Token
    fee: FeeAmount
    sqrtPriceX96: JSBI
    liquidity: JSBI
    tick: number
    tickSpacing: number
}

export default class UniswapV3PoolFetcher extends UniswapV3PoolTester {

    constructor(address: string) {
        super(address);
    }

    async getPool() {
        let slot0 = await this.contract.slot0();
        let liquidity = await this.contract.liquidity();

        let tickSpacing = Number(await this.contract.tickSpacing());

        const minWord = tickToWord(-887272, tickSpacing)
        const maxWord = tickToWord(887272, tickSpacing)

        let results: bigint[] = []
        let wordPosIndices: number[] = []
        for (let i = minWord; i <= maxWord; i++) {
            wordPosIndices.push(i)
            results.push(BigInt(await this.contract.tickBitmap(i)))
        }

        const tickIndices: number[] = []

        for (let j = 0; j < wordPosIndices.length; j++) {
            const ind = wordPosIndices[j]
            const bitmap = results[j]

            if (bitmap !== 0n) {
                for (let i = 0; i < 256; i++) {
                    const bit = 1n
                    const initialized = (bitmap & (bit << BigInt(i))) !== 0n
                    if (initialized) {
                        const tickIndex = (ind * 256 + i) * tickSpacing
                        tickIndices.push(tickIndex)
                    }
                }
            }
        }
    }


}


function tickToWord(tick: number, tickSpacing: number): number {
    let compressed = Math.floor(tick / tickSpacing)
    if (tick < 0 && tick % tickSpacing !== 0) {
        compressed -= 1
    }
    return tick >> 8
}