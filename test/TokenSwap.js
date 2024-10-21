const {
  loadFixture
} = require('@nomicfoundation/hardhat-toolbox/network-helpers')
const { expect } = require('chai')
const { bigint } = require('hardhat/internal/core/params/argumentTypes')

describe('TokenFlow', function () {
  const initialSupplyA = 1000000
  const initialSupplyB = 50000000
  const addAmountTokenA = 100000
  const addAmountTokenB = 200000
  const swapA = 10000
  const swapB = 15000
  const feeRate = 100
  const withdrawFee = 10

  async function deployTokenFlowFixture () {
    const [owner, addr1, addr2] = await ethers.getSigners()

    const tokenA = await ethers.deployContract('ERC20Mock', [initialSupplyA])
    const tokenB = await ethers.deployContract('ERC20Mock', [initialSupplyB])

    const feeCollector = await ethers.deployContract('FeeCollector')

    const feeCollectorAddress = await feeCollector.getAddress()

    const tokenFlow = await ethers.deployContract('TokenFlow', [
      feeCollectorAddress,
      feeRate
    ])

    await tokenA.mint(addr1.address, initialSupplyA)
    await tokenB.mint(addr1.address, initialSupplyB)

    return { feeCollector, tokenA, tokenB, tokenFlow, owner, addr1, addr2 }
  }

  describe('Deployment', function () {
    it('Should correctly deploy the tokenFlow contract and assign tokens to owner', async function () {
      const { feeCollector, tokenA, tokenB, tokenFlow, owner } =
        await loadFixture(deployTokenFlowFixture)

      const ownerABalance = await tokenA.balanceOf(owner.address)
      expect(ownerABalance).to.equal(initialSupplyA)

      const ownerBBalance = await tokenB.balanceOf(owner.address)
      expect(ownerBBalance).to.equal(initialSupplyB)

      const feeRate = await tokenFlow.feeRate()
      expect(feeRate).to.equal(feeRate)

      const feeCollectorOwner = await feeCollector.owner()
      expect(feeCollectorOwner).to.equal(owner.address)

      const tokenFlowOwner = await tokenFlow.owner()
      expect(tokenFlowOwner).to.equal(owner.address)

      const feeCollectorontractAddress = await feeCollector.getAddress()
      const tokenFlowContractAddress = await tokenFlow.getAddress()

      const feeCollectorABalance = await tokenA.balanceOf(
        feeCollectorontractAddress
      )
      const feeCollectorBBalance = await tokenB.balanceOf(
        feeCollectorontractAddress
      )
      expect(feeCollectorABalance).to.equal(0)
      expect(feeCollectorBBalance).to.equal(0)

      const tokenFlowABalance = await tokenA.balanceOf(tokenFlowContractAddress)
      const tokenFlowBalance = await tokenB.balanceOf(tokenFlowContractAddress)

      expect(tokenFlowABalance).to.equal(0)
      expect(tokenFlowBalance).to.equal(0)
    })
  })

  describe('Add Liquidity', function () {
    it('Should allow owner to add liquidity to the contract', async function () {
      const { feeCollector, tokenA, tokenB, tokenFlow, owner } =
        await loadFixture(deployTokenFlowFixture)

      const tokenFlowContractAddress = await tokenFlow.getAddress()
      const tokenAAddress = await tokenA.getAddress()
      const tokenBAddress = await tokenB.getAddress()

      initialOwnerBalanceA = await tokenA.balanceOf(owner.address)
      initialOwnerBalanceB = await tokenB.balanceOf(owner.address)
      initialTokenFlowBalanceA = await tokenA.balanceOf(
        tokenFlowContractAddress
      )
      initialTokenFlowBalanceB = await tokenB.balanceOf(
        tokenFlowContractAddress
      )

      await tokenA.approve(tokenFlowContractAddress, addAmountTokenA)
      await tokenB.approve(tokenFlowContractAddress, addAmountTokenB)

      await expect(
        tokenFlow.addLiquidity(
          tokenAAddress,
          tokenBAddress,
          addAmountTokenA,
          addAmountTokenB
        )
      ).to.not.be.reverted

      expect(await tokenA.balanceOf(tokenFlowContractAddress)).to.equal(
        initialTokenFlowBalanceA + BigInt(addAmountTokenA)
      )

      expect(await tokenB.balanceOf(tokenFlowContractAddress)).to.equal(
        initialTokenFlowBalanceB + BigInt(addAmountTokenB)
      )

      expect(await tokenA.balanceOf(owner.address)).to.equal(
        initialOwnerBalanceA - BigInt(addAmountTokenA)
      )

      expect(await tokenB.balanceOf(owner.address)).to.equal(
        initialOwnerBalanceB - BigInt(addAmountTokenB)
      )
    })
    it('Should allow other users to add liquidity to the contract', async function () {
      const { feeCollector, tokenA, tokenB, tokenFlow, owner, addr1 } =
        await loadFixture(deployTokenFlowFixture)

      const tokenFlowContractAddress = await tokenFlow.getAddress()
      const tokenAAddress = await tokenA.getAddress()
      const tokenBAddress = await tokenB.getAddress()

      initialAddr1BalanceA = await tokenA.balanceOf(addr1)
      initialAddr1BalanceB = await tokenB.balanceOf(addr1)
      initialTokenFlowBalanceA = await tokenA.balanceOf(
        tokenFlowContractAddress
      )
      initialTokenFlowBalanceB = await tokenB.balanceOf(
        tokenFlowContractAddress
      )

      await tokenA
        .connect(addr1)
        .approve(tokenFlowContractAddress, addAmountTokenA)
      await tokenB
        .connect(addr1)
        .approve(tokenFlowContractAddress, addAmountTokenB)

      await expect(
        tokenFlow
          .connect(addr1)
          .addLiquidity(
            tokenAAddress,
            tokenBAddress,
            addAmountTokenA,
            addAmountTokenB
          )
      ).to.not.be.reverted

      expect(await tokenA.balanceOf(tokenFlowContractAddress)).to.equal(
        initialTokenFlowBalanceA + BigInt(addAmountTokenA)
      )

      expect(await tokenB.balanceOf(tokenFlowContractAddress)).to.equal(
        initialTokenFlowBalanceB + BigInt(addAmountTokenB)
      )

      expect(await tokenA.balanceOf(addr1)).to.equal(
        initialAddr1BalanceA - BigInt(addAmountTokenA)
      )

      expect(await tokenB.balanceOf(addr1)).to.equal(
        initialAddr1BalanceB - BigInt(addAmountTokenB)
      )
    })
  })

  describe('Swap', function () {
    it('Should allow the owner to swap tokenA for tokenB', async function () {
      const { feeCollector, tokenA, tokenB, tokenFlow, owner, addr1 } =
        await loadFixture(deployTokenFlowFixture)

      const feeCollectorontractAddress = await feeCollector.getAddress()
      const tokenFlowContractAddress = await tokenFlow.getAddress()

      const tokenAAddres = await tokenA.getAddress()
      const tokenBAddress = await tokenB.getAddress()

      const feeRate = await tokenFlow.feeRate()

      await tokenA.approve(tokenFlowContractAddress, addAmountTokenA)
      await tokenB.approve(tokenFlowContractAddress, addAmountTokenB)

      await tokenFlow.addLiquidity(
        tokenAAddres,
        tokenBAddress,
        addAmountTokenA,
        addAmountTokenB
      )

      initialOwnerBalanceA = await tokenA.balanceOf(owner.address)
      initialOwnerBalanceB = await tokenB.balanceOf(owner.address)
      initialFeeCollectorBalanceA = await tokenB.balanceOf(
        feeCollectorontractAddress
      )

      await tokenA.approve(tokenFlowContractAddress, swapA)
      await tokenFlow.swap(tokenAAddres, tokenBAddress, swapA)

      const expectedFee = (BigInt(swapA) * BigInt(feeRate)) / BigInt(10000)

      expect(await tokenA.balanceOf(owner.address)).to.equal(
        initialOwnerBalanceA - BigInt(swapA)
      )

      expect(await tokenB.balanceOf(owner.address)).to.equal(
        initialOwnerBalanceB + BigInt(swapA) - expectedFee
      )

      expect(await tokenA.balanceOf(feeCollectorontractAddress)).to.equal(
        initialFeeCollectorBalanceA + expectedFee
      )
    })
    it('Should allow the owner to swap tokenB for tokenA', async function () {
      const { feeCollector, tokenA, tokenB, tokenFlow, owner, addr1 } =
        await loadFixture(deployTokenFlowFixture)

      const feeCollectorontractAddress = await feeCollector.getAddress()
      const tokenFlowContractAddress = await tokenFlow.getAddress()

      const tokenAAddres = await tokenA.getAddress()
      const tokenBAddress = await tokenB.getAddress()

      const feeRate = await tokenFlow.feeRate()

      await tokenA.approve(tokenFlowContractAddress, addAmountTokenA)
      await tokenB.approve(tokenFlowContractAddress, addAmountTokenB)

      await tokenFlow.addLiquidity(
        tokenAAddres,
        tokenBAddress,
        addAmountTokenA,
        addAmountTokenB
      )

      initialOwnerBalanceA = await tokenA.balanceOf(owner.address)
      initialOwnerBalanceB = await tokenB.balanceOf(owner.address)
      initialFeeCollectorBalanceB = await tokenB.balanceOf(
        feeCollectorontractAddress
      )

      await tokenB.approve(tokenFlowContractAddress, swapB)
      await tokenFlow.swap(tokenBAddress, tokenAAddres, swapB)

      const expectedFee = (BigInt(swapB) * BigInt(feeRate)) / BigInt(10000)

      expect(await tokenB.balanceOf(owner.address)).to.equal(
        initialOwnerBalanceB - BigInt(swapB)
      )

      expect(await tokenA.balanceOf(owner.address)).to.equal(
        initialOwnerBalanceA + BigInt(swapB) - expectedFee
      )

      expect(await tokenB.balanceOf(feeCollectorontractAddress)).to.equal(
        initialFeeCollectorBalanceB + expectedFee
      )
    })
  })

  describe('Withdraw Fees', function () {
    it('Should allow the owner to withdraw fees', async function () {
      const { feeCollector, tokenA, tokenB, tokenFlow, owner, addr1, addr2 } =
        await loadFixture(deployTokenFlowFixture)

      const feeCollectorontractAddress = await feeCollector.getAddress()
      const tokenFlowContractAddress = await tokenFlow.getAddress()
      const tokenAAddress = await tokenA.getAddress()
      const tokenBAddress = await tokenB.getAddress()

      await tokenA.approve(tokenFlowContractAddress, addAmountTokenA)
      await tokenB.approve(tokenFlowContractAddress, addAmountTokenB)

      await expect(
        tokenFlow.addLiquidity(
          tokenAAddress,
          tokenBAddress,
          addAmountTokenA,
          addAmountTokenB
        )
      ).to.not.be.reverted

      await tokenA.connect(addr1).approve(tokenFlowContractAddress, swapA)
      await tokenFlow.connect(addr1).swap(tokenAAddress, tokenBAddress, swapA)

      initialFeeCollectorBalanceA = await tokenA.balanceOf(
        feeCollectorontractAddress
      )

      await tokenFlow.withdrawFees(tokenAAddress, withdrawFee)

      expect(await tokenA.balanceOf(feeCollectorontractAddress)).to.equal(
        initialFeeCollectorBalanceA - BigInt(withdrawFee)
      )
    })
    it('Should not alow other accounts to withdraw fees', async function () {
      const { feeCollector, tokenA, tokenB, tokenFlow, owner, addr1, addr2 } =
        await loadFixture(deployTokenFlowFixture)

      const feeCollectorontractAddress = await feeCollector.getAddress()
      const tokenFlowContractAddress = await tokenFlow.getAddress()
      const tokenAAddress = await tokenA.getAddress()
      const tokenBAddress = await tokenB.getAddress()

      await tokenA.approve(tokenFlowContractAddress, addAmountTokenA)
      await tokenB.approve(tokenFlowContractAddress, addAmountTokenB)

      await expect(
        tokenFlow.addLiquidity(
          tokenAAddress,
          tokenBAddress,
          addAmountTokenA,
          addAmountTokenB
        )
      ).to.not.be.reverted

      await tokenA.connect(addr1).approve(tokenFlowContractAddress, swapA)
      await tokenFlow.connect(addr1).swap(tokenAAddress, tokenBAddress, swapA)

      await expect(
        tokenFlow.connect(addr2).withdrawFees(tokenAAddress, withdrawFee)
      ).to.be.revertedWith('Not the owner')
    })
  })
})
