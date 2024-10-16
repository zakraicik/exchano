const {
  loadFixture
} = require('@nomicfoundation/hardhat-toolbox/network-helpers')
const { expect } = require('chai')

describe('TokenSwap', function () {
  async function deployTokenSwapFixture () {
    const [owner, addr1, addr2] = await ethers.getSigners()

    const tokenA = await ethers.deployContract('ERC20Mock', [1000000])
    const tokenB = await ethers.deployContract('ERC20Mock', [50000000])

    const tokenSwap = await ethers.deployContract('TokenSwap', [
      await tokenA.getAddress(),
      await tokenB.getAddress(),
      100
    ])

    await tokenA.mint(addr1.address, 10000)
    await tokenB.mint(addr1.address, 10000)

    return { tokenA, tokenB, tokenSwap, owner, addr1, addr2 }
  }

  describe('Deployment', function () {
    it('Should correctly deploy the TokenSwap contract and assign tokens to owner', async function () {
      const { tokenA, tokenB, tokenSwap, owner } = await loadFixture(
        deployTokenSwapFixture
      )

      const ownerABalance = await tokenA.balanceOf(owner.address)
      expect(ownerABalance).to.equal(1000000)

      const ownerBBalance = await tokenB.balanceOf(owner.address)
      expect(ownerBBalance).to.equal(50000000)

      const feeRate = await tokenSwap.feeRate()
      expect(feeRate).to.equal(100)

      const tokenAAddress = await tokenSwap.tokenA()
      expect(tokenAAddress).to.equal(await tokenA.getAddress())

      const tokenBAddress = await tokenSwap.tokenB()
      expect(tokenBAddress).to.equal(await tokenB.getAddress())

      const tokenSwapOwner = await tokenSwap.owner()
      expect(tokenSwapOwner).to.equal(owner.address)

      const tokenSwapContractAddress = await tokenSwap.getAddress()
      const contractABalance = await tokenA.balanceOf(tokenSwapContractAddress)
      const contractBBalance = await tokenB.balanceOf(tokenSwapContractAddress)

      expect(contractABalance).to.equal(0)
      expect(contractBBalance).to.equal(0)
    })
  })

  describe('Add Liquidity', function () {
    it('Should allow owner to add liquidity to the contract', async function () {
      const { tokenA, tokenB, tokenSwap, owner, addr1, addr2 } =
        await loadFixture(deployTokenSwapFixture)

      const tokenSwapContractAddress = await tokenSwap.getAddress()

      await tokenA.approve(tokenSwapContractAddress, 1000)
      await tokenB.approve(tokenSwapContractAddress, 2000)

      await tokenSwap.addLiquidity(1000, 2000)

      const tokenSwapTokenABalance = await tokenA.balanceOf(
        tokenSwapContractAddress
      )
      const tokenSwapTokenBBalance = await tokenB.balanceOf(
        tokenSwapContractAddress
      )

      expect(tokenSwapTokenABalance).to.equal(1000)
      expect(tokenSwapTokenBBalance).to.equal(2000)
    })
  })
})
