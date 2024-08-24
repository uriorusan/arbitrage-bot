// contracts/FlashLoan.sol
// SPDX-License-Identifier: MIT
pragma solidity =0.6.6;

import {IUniswapV2Router02} from "@uniswap/v2-periphery/contracts/UniswapV2Router02.sol";
import {IERC20} from "@uniswap/v2-periphery/contracts/interfaces/IERC20.sol";
import {console} from "hardhat/console.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";

contract SwapUniV2 {
    address payable owner;

    constructor() public {
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
     */
    function swapSingle(
        address _tokenIn,
        address _tokenOut,
        address _swapRouter,
        uint256 _amount
    ) external returns (uint256[] memory amountOut) {
        IUniswapV2Router02 swapRouter = IUniswapV2Router02(_swapRouter);

        // This transaction needs to be approved by the msg.sender
        // It shall do tokenIn.approve(SwapContractAddress, _amount) before calling this function
        TransferHelper.safeTransferFrom(
            _tokenIn,
            msg.sender,
            address(this),
            _amount
        );

        TransferHelper.safeApprove(_tokenIn, _swapRouter, _amount);

        address[] memory path = new address[](2);
        path[0] = _tokenIn;
        path[1] = _tokenOut;

        amountOut = swapRouter.swapExactTokensForTokens(
            _amount, // amountIn
            0, // amountOutMin
            path, // path
            msg.sender, // to
            block.timestamp // deadline
        );

        return amountOut;
    }
}
