const {
  loadFixture
} = require('@nomicfoundation/hardhat-toolbox/network-helpers')
const { expect } = require('chai')

describe('TokenSwap', function () {
  async function deployTokenSwapFixture () {
    const [owner, addr1, addr2] = await ethers.getSigners()

    // Deploy mock ERC20 tokens (TokenA and TokenB)
    const Token = await ethers.getContractFactory('ERC20Mock')

    // Deploy TokenA and TokenB, minting 1,000,000 tokens to the owner
    const tokenA = await Token.deploy(ethers.parseUnits('1000000', 18))

    await tokenA.waitForDeployment()
    console.log('TokenA deployed at:', tokenA.address)

    const tokenB = await Token.deploy(ethers.parseUnits('1000000', 18))

    await tokenB.waitForDeployment()
    console.log('tokenB deployed at:', tokenB.address)

    // Deploy TokenSwap contract with a 1% fee rate (100 basis points)
    const TokenSwap = await ethers.getContractFactory('TokenSwap')
    const feeRate = 100 // 1% fee in basis points
    const tokenSwap = await TokenSwap.deploy(
      tokenA.address,
      tokenB.address,
      feeRate
    )
    await tokenSwap.waitForDeployment()
    console.log('tokenSwap deployed at:', tokenSwap.address)

    // Return the necessary variables
    return { tokenA, tokenB, tokenSwap, feeRate, owner, addr1, addr2 }
  }

  describe('Deployment', function () {
    it('Should correctly deploy the TokenSwap contract', async function () {
      const { tokenA, tokenB, tokenSwap, feeRate } = await loadFixture(
        deployTokenSwapFixture
      )

      // expect(await tokenSwap.tokenA()).to.equal(tokenA.address)
      // expect(await tokenSwap.tokenB()).to.equal(tokenB.address)
      // expect(await tokenSwap.feeRate()).to.equal(feeRate)
    })
  })

  // describe('Adding Liquidity', function () {
  //   it('Should allow adding liquidity', async function () {
  //     const { tokenA, tokenB, tokenSwap, owner } = await loadFixture(
  //       deployTokenSwapFixture
  //     )

  //     // Owner adds liquidity
  //     await tokenA.approve(tokenSwap.address, 1000)
  //     await tokenB.approve(tokenSwap.address, 1000)
  //     await tokenSwap.addLiquidity(1000, 1000)

  //     // Check balances
  //     expect(await tokenA.balanceOf(tokenSwap.address)).to.equal(1000)
  //     expect(await tokenB.balanceOf(tokenSwap.address)).to.equal(1000)
  //   })
  // })

  // describe('Swapping Tokens', function () {
  //   it('Should correctly swap Token A for Token B', async function () {
  //     const { tokenA, tokenB, tokenSwap, addr1 } = await loadFixture(
  //       deployTokenSwapFixture
  //     )

  //     // Add liquidity
  //     await tokenA.approve(tokenSwap.address, 1000)
  //     await tokenB.approve(tokenSwap.address, 1000)
  //     await tokenSwap.addLiquidity(1000, 1000)

  //     // Transfer token A to addr1 and approve the contract
  //     await tokenA.transfer(addr1.address, 100)
  //     await tokenA.connect(addr1).approve(tokenSwap.address, 100)

  //     // Perform the swap from addr1
  //     await tokenSwap.connect(addr1).swapAtoB(100)

  //     // Calculate fee and amountB
  //     const fee = (100 * 100) / 10000 // 1% fee = 1 token
  //     const amountB = 100 - fee

  //     // Check balances
  //     expect(await tokenA.balanceOf(tokenSwap.address)).to.equal(1100) // 1000 + 100 (from addr1)
  //     expect(await tokenB.balanceOf(addr1.address)).to.equal(amountB) // addr1 gets 99 tokens (after fee)
  //   })

  //   it('Should fail to swap if there is insufficient Token B', async function () {
  //     const { tokenA, tokenSwap, addr1 } = await loadFixture(
  //       deployTokenSwapFixture
  //     )

  //     // Transfer token A to addr1 and approve the contract
  //     await tokenA.transfer(addr1.address, 100)
  //     await tokenA.connect(addr1).approve(tokenSwap.address, 100)

  //     // Attempt to swap without Token B liquidity
  //     await expect(tokenSwap.connect(addr1).swapAtoB(100)).to.be.revertedWith(
  //       'Insufficient TokenB in contract'
  //     )
  //   })
  // })

  // describe('Withdraw Fees', function () {
  //   it('Should allow the owner to withdraw fees', async function () {
  //     const { tokenA, tokenB, tokenSwap, owner, addr1 } = await loadFixture(
  //       deployTokenSwapFixture
  //     )

  //     // Add liquidity and perform a swap
  //     await tokenA.approve(tokenSwap.address, 1000)
  //     await tokenB.approve(tokenSwap.address, 1000)
  //     await tokenSwap.addLiquidity(1000, 1000)
  //     await tokenA.transfer(addr1.address, 100)
  //     await tokenA.connect(addr1).approve(tokenSwap.address, 100)
  //     await tokenSwap.connect(addr1).swapAtoB(100)

  //     // Calculate fee
  //     const feeAmount = (100 * 100) / 10000 // 1% fee = 1 token

  //     // Owner withdraws fees
  //     await tokenSwap.withdrawFees(owner.address)

  //     // Check balances
  //     expect(await tokenA.balanceOf(owner.address)).to.equal(feeAmount) // Owner gets the 1 token fee
  //   })

  //   it('Should not allow non-owners to withdraw fees', async function () {
  //     const { tokenA, tokenSwap, addr1 } = await loadFixture(
  //       deployTokenSwapFixture
  //     )

  //     // Add liquidity and perform a swap
  //     await tokenA.approve(tokenSwap.address, 1000)
  //     await tokenSwap.addLiquidity(1000, 0) // Just adding tokenA for simplicity
  //     await tokenA.transfer(addr1.address, 100)
  //     await tokenA.connect(addr1).approve(tokenSwap.address, 100)
  //     await tokenSwap.connect(addr1).swapAtoB(100)

  //     // Non-owner (addr1) tries to withdraw fees
  //     await expect(
  //       tokenSwap.connect(addr1).withdrawFees(addr1.address)
  //     ).to.be.revertedWith('Not the contract owner')
  //   })
  // })
})
