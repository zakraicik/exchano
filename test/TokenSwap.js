const {
  loadFixture
} = require('@nomicfoundation/hardhat-toolbox/network-helpers')
const { expect } = require('chai')

describe('TokenSwap', function () {
  async function deployTokenSwapFixture () {
    const [owner, addr1, addr2] = await ethers.getSigners()

    const Token = await ethers.deployContract('ERC20Mock', [1000000])

    return { Token, owner, addr1, addr2 }
  }

  describe('Deployment', function () {
    it('Should correctly deploy the TokenSwap contract and assign tokens to owner', async function () {
      const { Token, owner } = await loadFixture(deployTokenSwapFixture)

      const ownerBalance = await Token.balanceOf(owner.address)
      expect(ownerBalance).to.equal(1000000)
    })
  })
})
