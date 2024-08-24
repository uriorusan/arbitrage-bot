// contracts/FlashLoan.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ISwapRouter} from "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import {TransferHelper} from "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {console} from "hardhat/console.sol";

contract SwapUniV3 {
    address payable owner;

    constructor() {
        owner = payable(msg.sender); // make the deployer of the contract the owner
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    /**
     *
     * @param _tokenIn address of the token to swap, sender must approve this contract to spend _amount
     * @param _tokenOut address of the token to swap to
     * @param _swapRouter address of the pool to use
     * @param _amount  amount of _tokenIn to swap
     * @param _poolFee fee tier to use for the pool, will not be used in V2
     */
    function swapSingle(
        address _tokenIn,
        address _tokenOut,
        address _swapRouter,
        uint256 _amount,
        uint24 _poolFee
    ) external returns (uint256 amountOut) {
        ISwapRouter swapRouter = ISwapRouter(_swapRouter);

        // This transaction needs to be approved by the msg.sender
        // It shall do tokenIn.approve(SwapContractAddress, _amount) before calling this function
        TransferHelper.safeTransferFrom(
            _tokenIn,
            msg.sender,
            address(this),
            _amount
        );

        TransferHelper.safeApprove(_tokenIn, _swapRouter, _amount);

        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter
            .ExactInputSingleParams({
                tokenIn: _tokenIn,
                tokenOut: _tokenOut,
                fee: _poolFee,
                recipient: msg.sender,
                deadline: block.timestamp,
                amountIn: _amount,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            });

        amountOut = swapRouter.exactInputSingle(params);

        return amountOut;
    }
}
